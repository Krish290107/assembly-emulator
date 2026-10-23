import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleSource } from "../src/lib/assembler/index.ts";
import { secondPass } from "../src/lib/assembler/second-pass.ts";
import { firstPass } from "../src/lib/assembler/first-pass.ts";
import { parseSource } from "../src/lib/assembler/parser.ts";
import { MEMORY_WORDS } from "../src/lib/assembler/isa.ts";
import { EXAMPLES } from "../src/lib/editor/examples.ts";

const span = (line, start, end) => ({ start: { line, column: start }, end: { line, column: end } });
const passOne = (source) => firstPass(parseSource(source));
const words = ({ program }) => {
  const view = new DataView(program.bytes.buffer, program.bytes.byteOffset, program.bytes.byteLength);
  return Array.from({ length: program.bytes.length / 4 }, (_, index) => view.getUint32(index * 4, true));
};
function success(source) {
  const result = assembleSource(source);
  assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
  assert.ok(result.program.bytes instanceof Uint8Array);
  assert.equal(result.program.origin, 0);
  assert.equal(result.program.sourceMap.length * 4, result.program.bytes.length);
  return result;
}
function failure(result) {
  assert.equal(result.status, "failure");
  assert.deepEqual(Object.keys(result).sort(), ["diagnostics", "status"]);
  assert.ok(result.diagnostics.some(({ severity }) => severity === "error"));
  return result.diagnostics;
}

// Expected words are fixed ISA fixtures, independent of the encoder/metadata.
for (const [source, expected] of [
  ["ldc 10", 0x00000a00], ["adc 5", 0x00000501], ["ldl -2", 0xfffffe02],
  ["stl 3", 0x00000303], ["ldnl 4", 0x00000404], ["stnl -5", 0xfffffb05],
  ["add", 0x00000006], ["sub", 0x00000007], ["shl", 0x00000008], ["shr", 0x00000009],
  ["adj -1", 0xffffff0a], ["a2sp", 0x0000000b], ["sp2a", 0x0000000c],
  ["call 0", 0x0000000d], ["return", 0x0000000e], ["brz 1", 0x0000010f],
  ["brlz -2", 0xfffffe10], ["br -1", 0xffffff11], ["HALT", 0x00000012],
]) {
  test(`assembler encodes ${source} as ${expected.toString(16).padStart(8, "0")}`, () => {
    assert.deepEqual(words(success(source)), [expected]);
  });
}

test("end-to-end instructions serialize to exact little-endian bytes", () => {
  assert.deepEqual([...success("ldc 10\nadc 5\nHALT\nbr -1").program.bytes], [
    0x00, 0x0a, 0x00, 0x00, 0x01, 0x05, 0x00, 0x00,
    0x12, 0x00, 0x00, 0x00, 0x11, 0xff, 0xff, 0xff,
  ]);
});

test("signed 24-bit boundaries retain every operand bit", () => {
  assert.deepEqual(words(success("ldc -8388608\nadc +0x7fffff\nldc -1\nadc 0")), [0x80000000, 0x7fffff01, 0xffffff00, 0x00000001]);
});

test("data emits full signed 32-bit words, including both boundaries", () => {
  const result = success("data 10\ndata -1\ndata -2147483648\ndata 2147483647");
  assert.deepEqual(words(result), [0x0000000a, 0xffffffff, 0x80000000, 0x7fffffff]);
  assert.deepEqual([...result.program.bytes], [10, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 128, 255, 255, 255, 127]);
});

test("mixed labels, data, call, and backward branch produce an exact complete image", () => {
  const result = success("; fixture\nstart: ldc value\ncall done\ndata -1\nvalue: data 10\ndone: br start\nHALT");
  assert.deepEqual([...result.program.bytes], [
    0x00, 0x03, 0x00, 0x00, 0x0d, 0x02, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff,
    0x0a, 0x00, 0x00, 0x00, 0x11, 0xfb, 0xff, 0xff, 0x12, 0x00, 0x00, 0x00,
  ]);
  assert.deepEqual([...result.symbols].map(([name, { address }]) => [name, address]), [["start", 0], ["value", 3], ["done", 4]]);
});

test("every symbolic operand mode uses word addresses and next-instruction-relative offsets", () => {
  const result = success("ldc target\nadc target\nldl target\nstl target\nldnl target\nstnl target\nadj target\ncall target\nbrz target\nbrlz target\nbr target\ntarget: HALT");
  assert.deepEqual(words(result), [0xb00, 0xb01, 0xb02, 0xb03, 0xb04, 0xb05, 0xb0a, 0x30d, 0x20f, 0x110, 0x11, 0x12]);
});

test("all four relative symbolic instructions resolve backward references", () => {
  assert.deepEqual(words(success("home: HALT\ncall home\nbrz home\nbrlz home\nbr home")), [0x12, 0xfffffe0d, 0xfffffd0f, 0xfffffc10, 0xfffffb11]);
});

test("a symbol at the next instruction resolves to zero displacement", () => {
  assert.deepEqual(words(success("br next\nnext: call tail\ntail: HALT")), [0x11, 0x0d, 0x12]);
});

test("numeric relative operands are literal displacements even for out-of-memory targets", () => {
  assert.deepEqual(words(success("HALT\nbr 0\ncall -1\nbrz -8388608\nbrlz 8388607")), [0x12, 0x11, 0xffffff0d, 0x8000000f, 0x7fffff10]);
});

test("case-sensitive symbols and prototype-like identifiers resolve normally", () => {
  assert.deepEqual(words(success("Loop: ldc loop\nloop: ldc Loop\n__proto__: ldc constructor\nconstructor: HALT")), [0x100, 0x000, 0x300, 0x12]);
  const [diagnostic] = failure(assembleSource("Loop: HALT\nbr loop"));
  assert.equal(diagnostic.code, "A005_UNDEFINED_SYMBOL");
  assert.deepEqual(diagnostic.source, span(2, 4, 8));
  assert.match(diagnostic.message, /'loop'.*case-sensitive/);
});

test("undefined references collect independent errors with exact operand spans", () => {
  const diagnostics = failure(assembleSource(" ldc missing\ncall other\nbr missing"));
  assert.deepEqual(diagnostics.map(({ code }) => code), Array(3).fill("A005_UNDEFINED_SYMBOL"));
  assert.deepEqual(diagnostics.map(({ source }) => source), [span(1, 6, 13), span(2, 6, 11), span(3, 4, 11)]);
});

test("one undefined reference prevents exposing otherwise valid encoded words", () => {
  failure(assembleSource("ldc 10\nHALT\nbr missing\ndata -1"));
});

test("duplicate definitions propagate both source locations without success artifacts", () => {
  const first = passOne("same: HALT\nsame: data 2");
  const diagnostics = failure(secondPass(first));
  assert.equal(diagnostics[0], first.diagnostics[0]);
  assert.equal(diagnostics[0].code, "A001_DUPLICATE_LABEL");
  assert.deepEqual(diagnostics[0].source, span(2, 1, 5));
  assert.deepEqual(diagnostics[0].related[0].source, span(1, 1, 5));
});

test("parser errors preserve their codes and spans and prevent all binary output", () => {
  const source = "ldc\nMOV 1\ndata 2147483648\nHALT";
  const parsed = parseSource(source);
  const diagnostics = failure(assembleSource(source));
  assert.deepEqual(diagnostics, parsed.diagnostics);
  failure(assembleSource("ldc 8388608"));
  failure(assembleSource("ldc -8388609"));
  failure(assembleSource("data -2147483649"));
});

test("failed first pass and error diagnostics refuse encoding even if flags disagree", () => {
  const first = passOne("HALT");
  assert.equal(failure(secondPass({ ...first, ok: false }))[0].code, "A004_INVALID_FIRST_PASS");
  const diagnostic = { severity: "error", code: "test-error", message: "Earlier error", source: span(1, 1, 5) };
  assert.equal(failure(secondPass({ ...first, diagnostics: [diagnostic] }))[0], diagnostic);
});

test("warnings survive successful assembly without mutating the input diagnostic list", () => {
  const warning = { severity: "warning", code: "test-warning", message: "Earlier warning" };
  const first = { ...passOne("HALT"), diagnostics: Object.freeze([warning]) };
  const result = secondPass(first);
  assert.equal(result.status, "success");
  assert.deepEqual(result.diagnostics, [warning]);
  assert.notEqual(result.diagnostics, first.diagnostics);
});

test("empty, comment-only, and label-only sources assemble to zero-word images", () => {
  for (const source of ["", "; comment\r\n\t", "entry:\nalias:"]) {
    const result = success(source);
    assert.deepEqual([...result.program.bytes], []);
    assert.deepEqual(result.program.sourceMap, []);
    if (source.startsWith("entry")) assert.deepEqual([...result.symbols.keys()], ["entry", "alias"]);
  }
});

test("source maps use byte offsets and full exclusive statement spans, omitting labels", () => {
  const result = success(" ; header\r\n entry:\r\n\talias: ldc end ; comment\r\n\r\n  data -1\r\nend: HALT\r\ntrailing:");
  assert.deepEqual(result.program.sourceMap, [
    { offset: 0, length: 4, source: span(3, 2, 16) },
    { offset: 4, length: 4, source: span(5, 3, 10) },
    { offset: 8, length: 4, source: span(6, 1, 10) },
  ]);
  assert.equal(result.symbols.get("trailing").address, 3);
});

test("trailing symbols inside memory may reference beyond the emitted image", () => {
  assert.deepEqual(words(success("ldc end\nbr end\nend:")), [0x200, 0x11]);
});

// Real first-pass symbols are at most 65,535; modified typed inputs exercise
// defensive range checks that normal source cannot reach through symbols.
test("resolved absolute and relative operands cannot silently truncate outside 24 bits", () => {
  for (const [source, address] of [["ldc target", -8388609], ["ldc target", 8388608], ["br target", -8388608], ["br target", 8388609]]) {
    const first = passOne(`${source}\ntarget: HALT`);
    const symbols = new Map(first.symbols);
    symbols.set("target", { ...symbols.get("target"), address });
    const [diagnostic] = failure(secondPass({ ...first, symbols }));
    assert.equal(diagnostic.code, "A006_OPERAND_RANGE");
    assert.deepEqual(diagnostic.source, first.statements[0].statement.operand.source);
  }
});

const replaceStatement = (first, statement) => ({ ...first, statements: [{ ...first.statements[0], statement }] });

test("invalid numeric operands are rejected before bitwise conversion", () => {
  const first = passOne("ldc 1");
  for (const value of [-8388609, 8388608, 1.5, NaN, Infinity]) {
    const statement = { ...first.statements[0].statement, operand: { kind: "immediate", value, source: span(1, 5, 6) } };
    assert.equal(failure(secondPass(replaceStatement(first, statement)))[0].code, "A006_OPERAND_RANGE");
  }
});

test("internal data inconsistencies fail without coercing non-32-bit values", () => {
  const first = passOne("data 0");
  for (const value of [-2147483649, 2147483648, 0.5, NaN]) {
    const [diagnostic] = failure(secondPass(replaceStatement(first, { ...first.statements[0].statement, value })));
    assert.equal(diagnostic.code, "A007_ENCODING_INCONSISTENCY");
    assert.deepEqual(diagnostic.source, span(1, 6, 7));
  }
});

test("inconsistent layout or word counts cannot produce a successful partial image", () => {
  const first = passOne("HALT");
  for (const wordCount of [-1, MEMORY_WORDS + 1, 0.5, NaN, 0, 2]) {
    assert.equal(failure(secondPass({ ...first, wordCount }))[0].code, "A007_ENCODING_INCONSISTENCY");
  }
  for (const address of [-1, 1, 0.5, MEMORY_WORDS]) {
    const [diagnostic] = failure(secondPass({ ...first, statements: [{ ...first.statements[0], address }] }));
    assert.equal(diagnostic.code, "A007_ENCODING_INCONSISTENCY");
    assert.deepEqual(diagnostic.source, span(1, 1, 5));
  }
  failure(secondPass({ ...first, statements: [] }));
});

test("invalid instruction shape or symbol address yields a source-specific internal diagnostic", () => {
  const first = passOne("HALT");
  for (const statement of [
    { ...first.statements[0].statement, mnemonic: "MOV" },
    { ...first.statements[0].statement, operand: { kind: "immediate", value: 1, source: span(1, 1, 5) } },
    { ...first.statements[0].statement, mnemonic: "ldc", operand: null },
  ]) {
    const [diagnostic] = failure(secondPass(replaceStatement(first, statement)));
    assert.equal(diagnostic.code, "A007_ENCODING_INCONSISTENCY");
    assert.deepEqual(diagnostic.source, span(1, 1, 5));
  }
  const symbolic = passOne("ldc target\ntarget: HALT");
  const symbols = new Map(symbolic.symbols);
  symbols.set("target", { ...symbols.get("target"), address: MEMORY_WORDS });
  assert.equal(failure(secondPass({ ...symbolic, symbols }))[0].code, "A007_ENCODING_INCONSISTENCY");
});

test("second pass is deterministic and leaves frozen input, symbols, and references intact", () => {
  const first = passOne("start: ldc next\nbr start\nnext: data -1");
  const before = structuredClone(first);
  const freeze = (value) => {
    if (value && typeof value === "object") {
      for (const child of value instanceof Map ? value.values() : Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  freeze(first);
  const result = secondPass(first);
  assert.equal(result.status, "success");
  assert.deepEqual(first, before);
  assert.deepEqual(result, secondPass(first));
  assert.deepEqual(result, assembleSource("start: ldc next\nbr start\nnext: data -1"));
  result.program.bytes.fill(0);
  result.symbols.clear();
  assert.deepEqual(first, before);
  assert.deepEqual(words(secondPass(first)), [0x200, 0xfffffe11, 0xffffffff]);
});

test("maximum image uses 262,144 bytes and resolves symbols at both ends", () => {
  const result = success("start: ldc last\nbr last\n" + "data 0\n".repeat(MEMORY_WORDS - 3) + "last: br start");
  assert.equal(result.program.bytes.length, 262144);
  assert.deepEqual([...result.program.bytes.slice(0, 8)], [0, 255, 255, 0, 0x11, 253, 255, 0]);
  assert.deepEqual([...result.program.bytes.slice(-4)], [0x11, 0, 0, 255]);
  assert.ok(result.program.bytes.subarray(8, -4).every((byte) => byte === 0));
  assert.deepEqual(result.program.sourceMap.at(-1), { offset: 262140, length: 4, source: span(MEMORY_WORDS, 1, 15) });
  assert.equal(result.symbols.get("last").address, 65535);
});

test("overflow and labels outside memory fail through the full public pipeline", () => {
  const full = "HALT\n".repeat(MEMORY_WORDS);
  assert.equal(failure(assembleSource(full + "data 1"))[0].code, "A003_PROGRAM_OVERFLOW");
  assert.equal(failure(assembleSource(full + "outside:"))[0].code, "A002_LABEL_ADDRESS");
});

test("all shipped examples assemble successfully without executing them", () => {
  for (const { code } of EXAMPLES) assert.ok(success(code).program.bytes.length > 0);
});
