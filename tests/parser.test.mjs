import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSource } from "../src/lib/assembler/parser.ts";
import { scanSource } from "../src/lib/assembler/scanner.ts";
import { DEFAULT_EXECUTION_LIMIT, getInstruction, INSTRUCTIONS, MAX_EXECUTION_LIMIT, MEMORY_WORDS, OPERAND_MAX, OPERAND_MIN, WORD_MAX, WORD_MIN } from "../src/lib/assembler/isa.ts";
import { EXAMPLES, INITIAL_DOCUMENT } from "../src/lib/editor/examples.ts";
import { configureAssembly, MNEMONIC_PATTERN } from "../src/lib/editor/language.ts";

const names = ["ldc", "adc", "ldl", "stl", "ldnl", "stnl", "add", "sub", "shl", "shr", "adj", "a2sp", "sp2a", "call", "return", "brz", "brlz", "br", "HALT"];
const required = new Set(["ldc", "adc", "ldl", "stl", "ldnl", "stnl", "adj", "call", "brz", "brlz", "br"]);
const relative = new Set(["call", "brz", "brlz", "br"]);
const span = (line, start, end) => ({ start: { line, column: start }, end: { line, column: end } });

function valid(source) {
  const result = parseSource(source);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics, []);
  return result.statements;
}

function diagnostic(source, code, range) {
  const result = parseSource(source);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, code);
  assert.equal(result.diagnostics[0].severity, "error");
  if (range) assert.deepEqual(result.diagnostics[0].source, range);
  return result;
}

test("ISA has exactly the conventional 19 opcodes, with no data opcode", () => {
  assert.deepEqual(INSTRUCTIONS.map(({ mnemonic }) => mnemonic), names);
  assert.deepEqual(INSTRUCTIONS.map(({ opcode }) => opcode), Array.from({ length: 19 }, (_, i) => i));
  for (const unsupported of ["MOV", "CMP", "PUSH", "POP", "HLT", "JMP", "RET", "data", "constructor", "__proto__"]) assert.equal(getInstruction(unsupported), undefined);
});

for (const [opcode, mnemonic] of names.entries()) {
  test(`${mnemonic}: opcode, operand kinds/count, addressing metadata, and case-insensitive parsing`, () => {
    const definition = getInstruction(mnemonic.toUpperCase());
    const count = required.has(mnemonic) ? 1 : 0;
    assert.equal(definition.opcode, opcode);
    assert.deepEqual(definition.operandKinds, count ? [["immediate", "symbol"]] : []);
    assert.equal(definition.operandMode, relative.has(mnemonic) ? "relative" : count ? "absolute" : "none");
    for (const spelling of [mnemonic.toLowerCase(), mnemonic.toUpperCase()]) {
      const [statement] = valid(`${spelling}${count ? " -7" : ""}`);
      assert.equal(statement.kind, "instruction");
      assert.equal(statement.mnemonic, mnemonic);
      if (count) assert.deepEqual(statement.operand, { kind: "immediate", value: -7, source: span(1, spelling.length + 2, spelling.length + 4) });
      else assert.equal(statement.operand, null);
    }
    if (count) {
      assert.equal(valid(`${mnemonic} future`)[0].operand.name, "future");
      diagnostic(mnemonic, "P004_MISSING_OPERAND");
      diagnostic(`${mnemonic} 1 2`, "P005_EXTRA_OPERAND");
    } else diagnostic(`${mnemonic} 1`, "P005_EXTRA_OPERAND");
  });
}

test("machine constants describe signed 32-bit words, signed 24-bit operands, and bounded execution", () => {
  assert.equal(MEMORY_WORDS, 65_536);
  assert.deepEqual([OPERAND_MIN, OPERAND_MAX], [-8_388_608, 8_388_607]);
  assert.deepEqual([WORD_MIN, WORD_MAX], [-2_147_483_648, 2_147_483_647]);
  assert.equal(DEFAULT_EXECUTION_LIMIT, 100_000);
  assert.equal(MAX_EXECUTION_LIMIT, 10_000_000);
});

test("labels may stand alone, be inline, touch the mnemonic, or use mnemonic-like names", () => {
  const statements = valid("entry:\n  loop : ldc 1\nadd:HALT\n_value9: data 7");
  assert.deepEqual(statements.map((s) => [s.kind, s.label.name]), [["label", "entry"], ["instruction", "loop"], ["instruction", "add"], ["data", "_value9"]]);
  assert.deepEqual(statements[0].source, span(1, 1, 7));
  assert.deepEqual(statements[0].label.source, span(1, 1, 6));
  assert.deepEqual(statements[1].label.source, span(2, 3, 7));
  assert.equal(valid("ldc :")[0].label.name, "ldc");
});

test("forward references preserve case-sensitive names without resolution, addresses, or machine code", () => {
  const result = parseSource("br Future\nldc missing\nFuture: HALT\nFuture: HALT\nfuture: HALT");
  assert.equal(result.ok, true);
  assert.deepEqual(result.statements[0].operand, { kind: "symbol", name: "Future", source: span(1, 4, 10) });
  assert.equal(result.statements[1].operand.name, "missing");
  assert.equal(result.statements[4].label.name, "future");
  for (const field of ["symbols", "bytes", "program"]) assert.equal(field in result, false);
  assert.equal("address" in result.statements[2].label, false);
});

test("signed decimal and hexadecimal forms have exact integer values", () => {
  for (const [literal, value] of [["0", 0], ["-0", 0], ["+0x0", 0], ["007", 7], ["-12", -12], ["+12", 12], ["0x7f", 127], ["+0XAb", 171], ["-0x10", -16]]) {
    assert.equal(valid(`ldc ${literal}`)[0].operand.value, value);
  }
});

test("instruction integer boundaries are inclusive and do not interpret large positive hex as negative", () => {
  for (const [literal, expected] of [["-8388608", OPERAND_MIN], ["8388607", OPERAND_MAX], ["-0x800000", OPERAND_MIN], ["0x7fffff", OPERAND_MAX]]) assert.equal(valid(`ldc ${literal}`)[0].operand.value, expected);
  for (const literal of ["-8388609", "8388608", "-0x800001", "0x800000", "0xFFFFFF", "9".repeat(400)]) diagnostic(`ldc ${literal}`, "P007_OPERAND_RANGE", span(1, 5, literal.length + 5));
});

test("data is a distinct case-insensitive directive with one signed 32-bit numeric value", () => {
  for (const [literal, expected] of [["-2147483648", WORD_MIN], ["2147483647", WORD_MAX], ["-0x80000000", WORD_MIN], ["0x7fffffff", WORD_MAX], ["-1", -1]]) {
    const [statement] = valid(`word: DaTa ${literal}`);
    assert.equal(statement.kind, "data");
    assert.equal(statement.value, expected);
    assert.equal("opcode" in statement, false);
  }
  for (const literal of ["-2147483649", "2147483648", "0xFFFFFFFF", "-0x80000001"]) diagnostic(`data ${literal}`, "P007_OPERAND_RANGE");
  diagnostic("data label", "P006_INVALID_OPERAND", span(1, 6, 11));
  diagnostic("data", "P004_MISSING_OPERAND", span(1, 5, 5));
  diagnostic("data 1 2", "P005_EXTRA_OPERAND", span(1, 8, 9));
});

test("comments, blank lines, tabs, CRLF, bare CR, final newline, and an initial BOM are handled", () => {
  assert.deepEqual(valid("\n\t ; notes\r\n\r"), []);
  assert.deepEqual(valid(""), []);
  const [first, last] = valid("\uFEFF\tldc\t+1 ; ignored : MOV\r\n; comment\rHALT;end\n");
  assert.deepEqual(first.mnemonicSource, span(1, 2, 5));
  assert.deepEqual(first.operand.source, span(1, 6, 8));
  assert.deepEqual(last.mnemonicSource, span(3, 1, 5));
});

test("scanner preserves token text and exclusive UTF-16 spans without interpreting source", () => {
  const scanned = scanSource("\tloop: ldc -0x2 ; comment\r\nHALT");
  assert.deepEqual(scanned[0].tokens.map(({ kind, text, source }) => [kind, text, source.start.column, source.end.column]), [["atom", "loop", 2, 6], ["colon", ":", 6, 7], ["atom", "ldc", 8, 11], ["atom", "-0x2", 12, 16]]);
  assert.equal(scanned[1].tokens[0].source.start.line, 2);
  diagnostic("😀: HALT", "P001_INVALID_LABEL", span(1, 1, 3));
});

test("malformed operands reject floats, expressions, binary/octal prefixes, commas, and brackets", () => {
  for (const operand of ["1.5", "1e2", "0x", "-0x", "0b10", "0o10", "1_000", "label+1", "[SP]", "1,2", "'x'", "\"x\"", "-", "NaN!"]) diagnostic(`ldc ${operand}`, "P006_INVALID_OPERAND");
  // Bare identifiers are symbols, even if they resemble register or constant names.
  assert.equal(valid("ldc A")[0].operand.name, "A");
  assert.equal(valid("ldc NaN")[0].operand.name, "NaN");
});

test("invalid labels, extra labels, unknown mnemonics, and stray punctuation have precise diagnostics", () => {
  diagnostic("9bad: HALT", "P001_INVALID_LABEL", span(1, 1, 5));
  diagnostic("bad-name: HALT", "P001_INVALID_LABEL", span(1, 1, 9));
  diagnostic(": HALT", "P001_INVALID_LABEL", span(1, 1, 2));
  diagnostic("a: b: HALT", "P008_UNEXPECTED_TOKEN", span(1, 4, 6));
  diagnostic("  MOV A, 1", "P003_UNKNOWN_MNEMONIC", span(1, 3, 6));
  diagnostic("a: : HALT", "P002_EXPECTED_MNEMONIC", span(1, 4, 5));
  diagnostic("1", "P002_EXPECTED_MNEMONIC", span(1, 1, 2));
  diagnostic("ldc\u00a01", "P002_EXPECTED_MNEMONIC");
});

test("missing/extra operands point to insertion positions or only the unexpected suffix", () => {
  diagnostic("\tldc ; note", "P004_MISSING_OPERAND", span(1, 5, 5));
  diagnostic("ldc 1  2 ; note", "P005_EXTRA_OPERAND", span(1, 8, 9));
  diagnostic("HALT 1 2", "P005_EXTRA_OPERAND", span(1, 6, 9));
});

test("statement, label, mnemonic, and operand source ranges exclude indentation/comments", () => {
  const [statement] = valid("  start: ldc -12  ; comment");
  assert.deepEqual(statement.source, span(1, 3, 17));
  assert.deepEqual(statement.label.source, span(1, 3, 8));
  assert.deepEqual(statement.mnemonicSource, span(1, 10, 13));
  assert.deepEqual(statement.operand.source, span(1, 14, 17));
});

test("malformed lines are omitted and recovery preserves later statements and ordered diagnostics", () => {
  const result = parseSource("bad: ldc\nldc 2\nMOV A, 1\ngood: add\ndata 2147483648\nHALT\nldc [1]");
  assert.equal(result.ok, false);
  assert.deepEqual(result.statements.map((s) => s.mnemonic), ["ldc", "add", "HALT"]);
  assert.equal(result.statements[1].label.name, "good");
  assert.deepEqual(result.diagnostics.map((d) => [d.code, d.source.start.line]), [["P004_MISSING_OPERAND", 1], ["P003_UNKNOWN_MNEMONIC", 3], ["P007_OPERAND_RANGE", 5], ["P006_INVALID_OPERAND", 7]]);
  assert.equal(result.statements.some((s) => s.label?.name === "bad"), false);
  assert.deepEqual(parseSource("HALT"), parseSource("HALT"));
});

test("source text is never executed and parsing continues after script-looking lines", () => {
  const result = parseSource("<script>throw new Error('never run')</script>\nHALT");
  assert.equal(result.ok, false);
  assert.equal(result.statements[0].mnemonic, "HALT");
});

test("deterministic malformed-input sweep never throws or loses the following line", () => {
  const alphabet = "abAD10x:;+-_ ,[]()\t\u00a0\u0000\u2028😀";
  let seed = 319;
  for (let sample = 0; sample < 300; sample++) {
    let line = "";
    for (let index = 0; index < sample % 43; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      line += alphabet[seed % alphabet.length];
    }
    const result = parseSource(`${line}\nHALT`);
    assert.equal(result.statements.at(-1).mnemonic, "HALT");
    for (const item of [...result.statements, ...result.diagnostics]) {
      const range = item.source;
      assert.ok(range.start.column >= 1);
      assert.ok(range.end.column >= range.start.column);
      assert.ok(range.end.column <= (range.start.line === 1 ? line.length : 4) + 1);
    }
  }
});

test("all shipped examples and the initial document parse using the finalized ISA", () => {
  for (const example of [...EXAMPLES, INITIAL_DOCUMENT]) assert.equal(parseSource(example.code).ok, true, example.filename);
});

test("Monaco instruction keywords come from exactly the ISA and keep data separate", () => {
  let language;
  configureAssembly({ languages: { getLanguages: () => [], register: () => {}, setMonarchTokensProvider: (_id, definition) => { language = definition; }, setLanguageConfiguration: () => {} }, editor: { defineTheme: () => {} } });
  assert.equal(language.ignoreCase, true);
  for (const mnemonic of names) assert.equal(MNEMONIC_PATTERN.test(mnemonic.toUpperCase()), true);
  for (const unsupported of ["MOV", "CMP", "PUSH", "POP", "HLT", "JMP", "RET", "data", "address"]) assert.equal(MNEMONIC_PATTERN.test(unsupported), false);
  assert.equal(language.tokenizer.root[1][1], "type.identifier");
  assert.equal(language.tokenizer.root[3][1], "keyword.directive");
});
