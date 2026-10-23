import assert from "node:assert/strict";
import { test } from "node:test";
import { firstPass } from "../src/lib/assembler/first-pass.ts";
import { parseSource } from "../src/lib/assembler/parser.ts";
import { INSTRUCTIONS, MEMORY_WORDS } from "../src/lib/assembler/isa.ts";
import { EXAMPLES, INITIAL_DOCUMENT } from "../src/lib/editor/examples.ts";

const span = (line, start, end) => ({ start: { line, column: start }, end: { line, column: end } });
const assembleFirst = (source) => firstPass(parseSource(source));
const addresses = (result) => Array.from(result.symbols, ([name, { address }]) => [name, address]);

test("first pass accepts empty source, comments, and blank lines without allocating words", () => {
  for (const source of ["", " \n; comment\r\n\t; another\n"]) {
    const result = assembleFirst(source);
    assert.equal(result.ok, true);
    assert.equal(result.wordCount, 0);
    assert.deepEqual(addresses(result), []);
    assert.deepEqual(result.statements, []);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.unresolvedReferences, []);
  }
});

test("inline labels address mixed instructions and data in words", () => {
  const result = assembleFirst("start: ldc 4\nvalue: data -2147483648\nadd\nend: HALT");
  assert.equal(result.ok, true);
  assert.equal(result.wordCount, 4);
  assert.deepEqual(addresses(result), [["start", 0], ["value", 1], ["end", 3]]);
  assert.deepEqual(result.statements.map(({ address }) => address), [0, 1, 2, 3]);
  assert.deepEqual(result.symbols.get("value").source, span(2, 1, 6));
});

test("consecutive distinct labels alias one address and label-only lines consume no words", () => {
  const result = assembleFirst("one:\ntwo:\nthree: HALT\nfour:\nfive:");
  assert.equal(result.ok, true);
  assert.equal(result.wordCount, 1);
  assert.deepEqual(addresses(result), [["one", 0], ["two", 0], ["three", 0], ["four", 1], ["five", 1]]);
  assert.deepEqual(result.statements.map(({ address }) => address), [0, 0, 0, 1, 1]);
  assert.deepEqual(addresses(assembleFirst("empty:\nalias:")), [["empty", 0], ["alias", 0]]);
});

test("labels remain case-sensitive and prototype-like names are ordinary symbols", () => {
  const result = assembleFirst("Loop: HALT\nloop: HALT\n__proto__: data 0\nconstructor: data 1");
  assert.equal(result.ok, true);
  assert.deepEqual(addresses(result), [["Loop", 0], ["loop", 1], ["__proto__", 2], ["constructor", 3]]);
  assert.equal(result.symbols.has("LOOP"), false);
});

test("duplicate labels report both exact locations and retain the first binding", () => {
  const result = assembleFirst("  entry: ldc 1\n\tentry: HALT\nentry: data 2");
  assert.equal(result.ok, false);
  assert.equal(result.wordCount, 3);
  assert.equal(result.statements.length, 3);
  assert.deepEqual(addresses(result), [["entry", 0]]);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["A001_DUPLICATE_LABEL", "A001_DUPLICATE_LABEL"]);
  for (const [index, diagnostic] of result.diagnostics.entries()) {
    assert.equal(diagnostic.severity, "error");
    assert.deepEqual(diagnostic.source, span(index + 2, index === 0 ? 2 : 1, index === 0 ? 7 : 6));
    assert.deepEqual(diagnostic.related, [{ message: "First definition of 'entry'.", source: span(1, 3, 8) }]);
    assert.match(diagnostic.message, /line 1, column 3/);
  }
});

test("a duplicate at the same location is still an error", () => {
  const result = assembleFirst("same:\nsame:\nHALT");
  assert.equal(result.ok, false);
  assert.equal(result.wordCount, 1);
  assert.equal(result.diagnostics[0].code, "A001_DUPLICATE_LABEL");
  assert.deepEqual(addresses(result), [["same", 0]]);
});

test("forward, backward, and undefined references are retained without resolving values", () => {
  const parsed = parseSource("start: ldc future\nbr start\ncall future\nfuture: HALT\nldc missing");
  const result = firstPass(parsed);
  assert.equal(result.ok, true);
  assert.deepEqual(addresses(result), [["start", 0], ["future", 3]]);
  assert.deepEqual(result.unresolvedReferences, [
    { name: "future", address: 0, source: span(1, 12, 18), mode: "absolute" },
    { name: "start", address: 1, source: span(2, 4, 9), mode: "relative" },
    { name: "future", address: 2, source: span(3, 6, 12), mode: "relative" },
    { name: "missing", address: 4, source: span(5, 5, 12), mode: "absolute" },
  ]);
  for (const [index, located] of result.statements.entries()) assert.equal(located.statement, parsed.statements[index]);
  assert.equal(result.statements[0].statement.operand.kind, "symbol");
  assert.deepEqual(result.diagnostics, []);
});

test("reference modes cover every operand-taking instruction without evaluating offsets", () => {
  const required = INSTRUCTIONS.filter(({ operandMode }) => operandMode !== "none");
  const result = assembleFirst(required.map(({ mnemonic }) => `${mnemonic} target`).join("\n"));
  assert.equal(result.ok, true);
  assert.deepEqual(result.unresolvedReferences.map(({ mode }) => mode), ["absolute", "absolute", "absolute", "absolute", "absolute", "absolute", "absolute", "relative", "relative", "relative", "relative"]);
  assert.deepEqual(result.unresolvedReferences.map(({ address }) => address), Array.from({ length: 11 }, (_, index) => index));
});

test("all 19 CPU instructions allocate exactly one word", () => {
  const result = assembleFirst(INSTRUCTIONS.map(({ mnemonic, operandMode }) => `${mnemonic}${operandMode === "none" ? "" : " 0"}`).join("\n"));
  assert.equal(result.ok, true);
  assert.equal(result.wordCount, 19);
  assert.deepEqual(result.statements.map(({ address }) => address), Array.from({ length: 19 }, (_, index) => index));
});

test("signed numeric boundaries and literal branch displacements stay unchanged", () => {
  const result = assembleFirst("ldc -8388608\nadc 0x7fffff\nbr -1\ndata -0x80000000\ndata +2147483647");
  assert.equal(result.ok, true);
  assert.equal(result.wordCount, 5);
  assert.deepEqual(result.statements.map(({ statement }) => statement.kind === "data" ? statement.value : statement.operand.value), [-8388608, 8388607, -1, -2147483648, 2147483647]);
  assert.deepEqual(result.unresolvedReferences, []);
});

test("comments, BOM, tabs, CRLF, and blank lines preserve source coordinates", () => {
  const result = assembleFirst("\uFEFF; heading\r\n\tstart: ; alias\r\n\r\n  ldc end ; forward\r\nend: HALT\r\n");
  assert.equal(result.ok, true);
  assert.equal(result.wordCount, 2);
  assert.deepEqual(addresses(result), [["start", 0], ["end", 1]]);
  assert.deepEqual(result.symbols.get("start").source, span(2, 2, 7));
  assert.deepEqual(result.unresolvedReferences[0].source, span(4, 7, 10));
});

test("parser recovery omits invalid lines and their labels while preserving diagnostics", () => {
  const parsed = parseSource("bad: MOV 1\ngood: ldc 2\nmissing: adc\nnumber: data 2147483648\nend: HALT");
  const result = firstPass(parsed);
  assert.equal(result.ok, false);
  assert.equal(result.wordCount, 2);
  assert.deepEqual(addresses(result), [["good", 0], ["end", 1]]);
  assert.deepEqual(result.statements.map(({ address }) => address), [0, 1]);
  assert.equal(result.diagnostics.length, 3);
  for (const [index, diagnostic] of parsed.diagnostics.entries()) assert.equal(result.diagnostics[index], diagnostic);
});

test("malformed definitions cannot create spurious duplicate labels", () => {
  const result = assembleFirst("same: ldc\nsame: HALT");
  assert.equal(result.ok, false);
  assert.deepEqual(addresses(result), [["same", 0]]);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["P004_MISSING_OPERAND"]);
});

test("parser diagnostics precede pass diagnostics in deterministic phase order", () => {
  const parsed = parseSource("a: HALT\na: HALT\nMOV 1");
  const result = firstPass(parsed);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0], parsed.diagnostics[0]);
  assert.equal(result.diagnostics[1].code, "A001_DUPLICATE_LABEL");
  assert.deepEqual(result, firstPass(parsed));
});

test("parse failure or an error diagnostic prevents success; warnings alone do not", () => {
  const base = parseSource("HALT");
  assert.equal(firstPass({ ...base, ok: false }).ok, false);
  assert.equal(firstPass({ ...base, diagnostics: [{ severity: "error", code: "test", message: "error" }] }).ok, false);
  assert.equal(firstPass({ ...base, diagnostics: [{ severity: "warning", code: "test", message: "warning" }] }).ok, true);
});

// Shared read-only parser fixture keeps the full-memory cases inexpensive.
const fullMemory = parseSource("HALT\n".repeat(MEMORY_WORDS));
const appendToFullMemory = (tail) => parseSource("HALT\n".repeat(MEMORY_WORDS) + tail);

test("exactly 65,536 words fit with the last statement at address 65,535", () => {
  const result = firstPass(fullMemory);
  assert.equal(result.ok, true);
  assert.equal(result.wordCount, MEMORY_WORDS);
  assert.equal(result.statements.length, MEMORY_WORDS);
  assert.equal(result.statements.at(-1).address, MEMORY_WORDS - 1);
  assert.deepEqual(result.diagnostics, []);
});

test("one word beyond capacity fails with a precise span and no wrapped allocation", () => {
  const result = firstPass(appendToFullMemory("data 7"));
  assert.equal(result.ok, false);
  assert.equal(result.wordCount, MEMORY_WORDS + 1);
  assert.equal(result.statements.length, MEMORY_WORDS);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["A003_PROGRAM_OVERFLOW"]);
  assert.deepEqual(result.diagnostics[0].source, span(MEMORY_WORDS + 1, 1, 7));
  assert.match(result.diagnostics[0].message, /address 65536/);
});

test("distinct labels at address 65,535 are valid before the final word", () => {
  const result = assembleFirst("HALT\n".repeat(MEMORY_WORDS - 1) + "last:\nalias: HALT");
  assert.equal(result.ok, true);
  assert.equal(result.wordCount, MEMORY_WORDS);
  assert.deepEqual(addresses(result), [["last", 65535], ["alias", 65535]]);
});

test("a trailing label at 65,536 is rejected even without an emitting word", () => {
  const result = firstPass(appendToFullMemory("outside:"));
  assert.equal(result.ok, false);
  assert.equal(result.wordCount, MEMORY_WORDS);
  assert.equal(result.symbols.size, 0);
  assert.equal(result.statements.length, MEMORY_WORDS);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["A002_LABEL_ADDRESS"]);
  assert.deepEqual(result.diagnostics[0].source, span(MEMORY_WORDS + 1, 1, 8));
});

test("overflow continues counting without wrapping or creating invalid references", () => {
  const result = firstPass(appendToFullMemory("outside: br absent\noutside: data 0"));
  assert.equal(result.ok, false);
  assert.equal(result.wordCount, MEMORY_WORDS + 2);
  assert.equal(result.symbols.size, 0);
  assert.equal(result.statements.length, MEMORY_WORDS);
  assert.deepEqual(result.unresolvedReferences, []);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["A002_LABEL_ADDRESS", "A003_PROGRAM_OVERFLOW", "A001_DUPLICATE_LABEL", "A002_LABEL_ADDRESS", "A003_PROGRAM_OVERFLOW"]);
  assert.deepEqual(result.diagnostics[2].related[0].source, span(MEMORY_WORDS + 1, 1, 8));
  assert.match(result.diagnostics.at(-1).message, /address 65537/);
});

test("the first pass does not mutate parser input and creates independent tables", () => {
  const parsed = parseSource("entry: ldc later\nlater: HALT\nMOV 0");
  const before = structuredClone(parsed);
  const freeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  freeze(parsed);
  const result = firstPass(parsed);
  assert.deepEqual(parsed, before);
  assert.deepEqual(result, firstPass(parsed));
  result.symbols.clear();
  assert.deepEqual(addresses(firstPass(parsed)), [["entry", 0], ["later", 1]]);
});

test("every shipped example integrates with the first pass without machine-code output", () => {
  for (const source of [INITIAL_DOCUMENT.code, ...EXAMPLES.map(({ code }) => code)]) {
    const result = assembleFirst(source);
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.ok(result.wordCount > 0);
    for (const forbidden of ["program", "bytes", "registers", "memory"]) assert.equal(forbidden in result, false);
  }
});
