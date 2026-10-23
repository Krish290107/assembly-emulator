import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleSource } from "../src/lib/assembler/index.ts";
import { createCpu, getCpuSnapshot, loadProgram, runCpuBatch, setExecutionLimit, writeMemory, writeRegister } from "../src/lib/cpu/index.ts";
import { createWorkspaceController } from "../src/lib/workspace/controller.ts";
import { createTestExecution, createTestSuiteExecution, runTestCase, runTestSuite, TEST_BATCH_SIZE, validateTestDefinition } from "../src/lib/testing/index.ts";
import { PREDEFINED_TEST_CASES } from "../src/lib/testing/fixtures.ts";

const definition = (overrides = {}) => ({ id: "case", name: "Example", source: "ldc 10\nadc 5\nHALT", assertions: [], ...overrides });
const register = (name, expected) => ({ target: "register", register: name, expected });
const memory = (address, expected) => ({ target: "memory", address, expected });
const quick = { yieldControl: () => Promise.resolve() };
function finish(session) {
  let progress = session.getProgress(), count = 0;
  while (!progress.done && count++ < 2000) progress = session.advance();
  assert.equal(progress.done, true);
  return progress.result;
}

test("valid serializable definitions normalize defaults without mutating inputs", () => {
  const input = definition({ description: "A small example", assertions: [register("A", 15)] });
  const before = structuredClone(input);
  const validation = validateTestDefinition(input);
  assert.deepEqual(validation.diagnostics, []);
  assert.equal(validation.definition.expectedStatus, "halted");
  assert.equal(validation.definition.limits.maxInstructions, 100000);
  assert.deepEqual(input, before);
  assert.deepEqual(JSON.parse(JSON.stringify(validation.definition)), validation.definition);
});

test("only selected fields are asserted, with HALT as the mandatory default completion", async () => {
  const result = await runTestCase(definition({ assertions: [register("A", 15)] }));
  assert.equal(result.outcome, "PASS");
  assert.equal(result.assembly.status, "success"); assert.equal(result.assembly.wordCount, 3);
  assert.equal(result.executionStatus, "halted"); assert.equal(result.attemptedInstructions, 3);
  assert.deepEqual(result.assertions.map(({ target }) => target), ["status", "register"]);
  assert.deepEqual(result.finalState, { registers: { A: 15, B: 0, PC: 2, SP: 65536 }, memory: [] });
  assert.equal(result.budget, 100000); assert.deepEqual(result.failureReasons, []);
});

test("all A/B/PC/SP assertions and address endpoints support exact architecture boundaries", async () => {
  const result = await runTestCase(definition({ source: "HALT", expectedAttempts: 1,
    initialState: { registers: { A: -2147483648, B: 2147483647, PC: 65535, SP: 65536 }, memory: [{ address: 65535, value: 18 }] },
    assertions: [register("A", -2147483648), register("B", 2147483647), register("PC", 65535), register("SP", 65536), memory(0, 18), memory(65535, 18)],
  }));
  assert.equal(result.outcome, "PASS"); assert.equal(result.attemptedInstructions, 1);
  assert.equal(result.assertions.length, 8);
  assert.deepEqual(result.finalState.memory, [{ address: 0, value: 18 }, { address: 65535, value: 18 }]);
});

test("multiple mismatches report exact expected/actual values without stopping assertion evaluation", async () => {
  const result = await runTestCase(definition({ expectedAttempts: 2, assertions: [register("A", 20), register("B", 5), memory(65535, 42)] }));
  assert.equal(result.outcome, "FAIL"); assert.equal(result.phase, "assertions");
  assert.deepEqual(result.assertions.map(({ label, expected, actual, outcome }) => [label, expected, actual, outcome]), [
    ["Execution status", "halted", "halted", "PASS"], ["Attempted instructions", 2, 3, "FAIL"],
    ["Register A", 20, 15, "FAIL"], ["Register B", 5, 0, "FAIL"], ["Memory[65535]", 42, 0, "FAIL"],
  ]);
  assert.equal(result.failureReasons.length, 4);
});

const malformed = [
  ["null", null], ["undefined", undefined], ["array", []], ["string", "HALT"], ["class instance", new Date()],
  ["missing ID", definition({ id: undefined })], ["blank name", definition({ name: " " })],
  ["source type", definition({ source: 7 })], ["missing assertions", definition({ assertions: undefined })],
  ["null status", definition({ expectedStatus: null })], ["nonterminal status", definition({ expectedStatus: "paused" })],
  ["bad description", definition({ description: () => "text" })], ["unknown hook", definition({ onStep() { throw new Error("must not run"); } })],
  ["invalid target", definition({ assertions: [{ target: "output", expected: 1 }] })],
  ["unknown register", definition({ assertions: [register("X", 0)] })],
  ["A overflow", definition({ assertions: [register("A", 2147483648)] })],
  ["B underflow", definition({ assertions: [register("B", -2147483649)] })],
  ["PC overflow", definition({ assertions: [register("PC", 65536)] })],
  ["SP overflow", definition({ assertions: [register("SP", 65537)] })],
  ["numeric string", definition({ assertions: [register("A", "15")] })],
  ["fraction", definition({ assertions: [register("A", 1.5)] })],
  ["NaN", definition({ assertions: [register("A", NaN)] })],
  ["infinity", definition({ assertions: [register("A", Infinity)] })],
  ["negative memory", definition({ assertions: [memory(-1, 0)] })],
  ["memory overflow", definition({ assertions: [memory(65536, 0)] })],
  ["memory value overflow", definition({ assertions: [memory(0, 2147483648)] })],
  ["zero budget", definition({ limits: { maxInstructions: 0 } })],
  ["fractional budget", definition({ limits: { maxInstructions: 1.5 } })],
  ["oversized budget", definition({ limits: { maxInstructions: 10000001 } })],
  ["negative attempts", definition({ expectedAttempts: -1 })],
  ["attempts beyond budget", definition({ expectedAttempts: 3, limits: { maxInstructions: 2 } })],
  ["attempt string", definition({ expectedAttempts: "3" })],
  ["fault without error status", definition({ expectedFaultCode: "C005_INVALID_ADDRESS" })],
  ["error without code", definition({ expectedStatus: "error" })],
  ["unknown fault code", definition({ expectedStatus: "error", expectedFaultCode: "C999_UNKNOWN" })],
  ["setup-only fault code", definition({ expectedStatus: "error", expectedFaultCode: "C015_INVALID_BATCH_SIZE" })],
  ["bad initial register", definition({ initialState: { registers: { PC: -1 } } })],
  ["initial register string", definition({ initialState: { registers: { A: "1" } } })],
  ["unknown initial register", definition({ initialState: { registers: { X: 1 } } })],
  ["bad initial memory address", definition({ initialState: { memory: [{ address: 65536, value: 0 }] } })],
  ["bad initial memory value", definition({ initialState: { memory: [{ address: 0, value: 0xffffffff }] } })],
  ["sparse assertions", definition({ assertions: new Array(1) })],
];
for (const [label, input] of malformed) {
  test(`invalid definition: ${label} is reported before assembly or execution`, async () => {
    const result = await runTestCase(input);
    assert.equal(result.outcome, "FAIL"); assert.equal(result.phase, "validation");
    assert.equal(result.assembly.status, "not-run"); assert.equal(result.executionStatus, null);
    assert.equal(result.attemptedInstructions, 0); assert.equal(result.finalState, null);
    assert.ok(result.diagnostics.some(({ code }) => code === "T001_INVALID_DEFINITION"));
  });
}

for (const [label, changes] of [
  ["duplicate equal memory", { assertions: [memory(100, 1), memory(100, 1)] }],
  ["conflicting memory", { assertions: [memory(100, 1), memory(100, 2)] }],
  ["duplicate register", { assertions: [register("A", 1), register("A", 1)] }],
  ["duplicate initial memory", { initialState: { memory: [{ address: 100, value: 1 }, { address: 100, value: 2 }] } }],
]) {
  test(`${label} is invalid rather than silently overwritten`, async () => {
    const result = await runTestCase(definition(changes));
    assert.equal(result.phase, "validation"); assert.equal(result.outcome, "FAIL");
    assert.ok(result.diagnostics.some(({ code }) => code === "T002_DUPLICATE_TARGET"));
  });
}

test("malformed accessors, cyclic data and inherited definitions cannot execute or throw from validation", async () => {
  const accessor = definition(); Object.defineProperty(accessor, "source", { get() { throw new Error("bad getter"); } });
  const cyclic = definition(); cyclic.initialState = { memory: [cyclic] };
  for (const input of [accessor, cyclic, Object.create(definition())]) {
    const result = await runTestCase(input);
    assert.equal(result.outcome, "FAIL"); assert.equal(result.assembly.status, "not-run");
  }
});

test("JSON validation never invokes accessor hooks and rejects oversized sparse input arrays promptly", async () => {
  let invoked = false;
  const getter = definition(); Object.defineProperty(getter, "source", { get() { invoked = true; return "HALT"; } });
  const cells = []; Object.defineProperty(cells, "0", { get() { invoked = true; return { address: 0, value: 18 }; } });
  for (const input of [getter, definition({ initialState: { memory: cells } }), definition({ assertions: new Array(1000000000) })]) {
    const result = await runTestCase(input); assert.equal(result.outcome, "FAIL"); assert.equal(result.assembly.status, "not-run");
  }
  assert.equal(invoked, false);
});

test("assembly failure preserves real codes/source spans and marks assertions unevaluated", async () => {
  const assembled = assembleSource("ldc missing\nHALT");
  const result = await runTestCase(definition({ source: "ldc missing\nHALT", assertions: [register("A", 0)], expectedAttempts: 0 }));
  assert.equal(result.outcome, "FAIL"); assert.equal(result.phase, "assembly");
  assert.equal(result.assembly.status, "failure"); assert.equal(result.finalState, null);
  assert.equal(result.attemptedInstructions, 0); assert.equal(result.executionStatus, null);
  assert.deepEqual(result.assembly.diagnostics, assembled.diagnostics);
  assert.ok(result.assertions.every(({ outcome, actual }) => outcome === "SKIPPED" && actual === null));
});

for (const source of ["", "; comment\nlabel:\n"]) {
  test("empty assembled images cannot pass or execute initial memory as a program", async () => {
    const result = await runTestCase(definition({ source, initialState: { memory: [{ address: 0, value: 18 }] } }));
    assert.equal(result.assembly.status, "success"); assert.equal(result.assembly.wordCount, 0);
    assert.equal(result.outcome, "FAIL"); assert.equal(result.executionStatus, "idle");
    assert.equal(result.attemptedInstructions, 0);
    assert.ok(result.diagnostics.some(({ code }) => code === "T004_NO_RUNNABLE_IMAGE"));
  });
}

for (const [source, code] of [
  ["data 255", "C002_INVALID_OPCODE"], ["data 262", "C003_INVALID_ENCODING"],
  ["ldc 65536\nldnl 0", "C005_INVALID_ADDRESS"], ["adj 1", "C012_INVALID_SP"],
  ["ldc 32\nshl", "C013_INVALID_SHIFT"], ["br 65535", "C014_INVALID_TARGET"],
]) {
  test(`fault ${code} passes only with explicit matching error status/code`, async () => {
    const unexpected = await runTestCase(definition({ source }));
    assert.equal(unexpected.outcome, "FAIL"); assert.equal(unexpected.executionStatus, "error");
    assert.equal(unexpected.assertions[0].outcome, "FAIL");
    const expected = await runTestCase(definition({ source, expectedStatus: "error", expectedFaultCode: code }));
    assert.equal(expected.outcome, "PASS"); assert.equal(expected.assertions[1].actual, code);
    assert.equal(expected.diagnostics.at(-1).code, code); assert.ok(expected.diagnostics.at(-1).source);
    const wrong = await runTestCase(definition({ source, expectedStatus: "error", expectedFaultCode: code === "C002_INVALID_OPCODE" ? "C005_INVALID_ADDRESS" : "C002_INVALID_OPCODE" }));
    assert.equal(wrong.outcome, "FAIL"); assert.equal(wrong.assertions[1].outcome, "FAIL");
  });
}

test("a HALT cannot satisfy an expected fault or a wrong attempt count", async () => {
  const result = await runTestCase(definition({ source: "HALT", expectedStatus: "error", expectedFaultCode: "C005_INVALID_ADDRESS", expectedAttempts: 0 }));
  assert.equal(result.outcome, "FAIL");
  assert.deepEqual(result.assertions.map(({ outcome }) => outcome), ["FAIL", "FAIL", "FAIL"]);
  assert.equal(result.assertions[1].actual, null);
});

test("HALT and faults keep precedence on the final allowed attempt", async () => {
  const halt = await runTestCase(definition({ source: "HALT", limits: { maxInstructions: 1 }, expectedAttempts: 1 }));
  assert.equal(halt.outcome, "PASS"); assert.equal(halt.executionStatus, "halted");
  const fault = await runTestCase(definition({ source: "data 255", limits: { maxInstructions: 1 }, expectedStatus: "error", expectedFaultCode: "C002_INVALID_OPCODE", expectedAttempts: 1 }));
  assert.equal(fault.outcome, "PASS"); assert.equal(fault.executionStatus, "error");
  const limit = await runTestCase(definition({ source: "ldc 7\nHALT", limits: { maxInstructions: 1 }, expectedStatus: "limit-reached", expectedAttempts: 1, assertions: [register("A", 7), register("PC", 1)] }));
  assert.equal(limit.outcome, "PASS"); assert.equal(limit.executionStatus, "limit-reached");
});

test("default-policy infinite loops are bounded at 100000 and fail unless a limit is explicitly expected", async () => {
  const unexpected = await runTestCase(definition({ source: "br -1" }), quick);
  assert.equal(unexpected.outcome, "FAIL"); assert.equal(unexpected.executionStatus, "limit-reached");
  assert.equal(unexpected.attemptedInstructions, 100000); assert.equal(unexpected.budget, 100000);
  const expected = await runTestCase(definition({ source: "br -1", limits: { maxInstructions: 513 }, expectedStatus: "limit-reached", expectedAttempts: 513 }), quick);
  assert.equal(expected.outcome, "PASS"); assert.equal(expected.attemptedInstructions, 513);
});

test("incremental execution advances at most 256 attempts and is idempotent after completion", () => {
  assert.equal(TEST_BATCH_SIZE, 256);
  const session = createTestExecution(definition({ source: "br -1", limits: { maxInstructions: 600 }, expectedStatus: "limit-reached", expectedAttempts: 600 }));
  assert.deepEqual(session.getProgress(), { done: false, executionStatus: null, attemptedInstructions: 0, result: null });
  assert.equal(session.advance().attemptedInstructions, 256);
  assert.equal(session.advance().attemptedInstructions, 512);
  const result = session.advance().result;
  assert.equal(result.outcome, "PASS"); assert.equal(result.attemptedInstructions, 600);
  assert.deepEqual(session.advance().result, result); assert.deepEqual(session.cancel().result, result);
});

test("async execution yields real event-loop turns between bounded CPU batches", async () => {
  let timerRan = false;
  const running = runTestCase(definition({ source: "br -1", limits: { maxInstructions: 1024 }, expectedStatus: "limit-reached" }));
  setTimeout(() => { timerRan = true; }, 0);
  assert.equal((await running).outcome, "PASS"); assert.equal(timerRan, true);
});

test("cancellation before assembly and after a batch is always FAIL with skipped assertions", () => {
  const cold = createTestExecution(definition({ assertions: [register("A", 15)] }));
  const cancelled = cold.cancel().result;
  assert.equal(cancelled.outcome, "FAIL"); assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.assembly.status, "not-run"); assert.equal(cancelled.executionStatus, null);
  assert.ok(cancelled.assertions.every(({ outcome }) => outcome === "SKIPPED"));
  assert.deepEqual(cold.advance().result, cancelled);
  const active = createTestExecution(definition({ source: "br -1", expectedStatus: "limit-reached", limits: { maxInstructions: 1000 } }));
  active.advance(); const stopped = active.cancel().result;
  assert.equal(stopped.outcome, "FAIL"); assert.equal(stopped.attemptedInstructions, 256);
  assert.equal(stopped.executionStatus, "paused"); assert.equal(stopped.phase, "cancelled");
  assert.deepEqual(active.advance().result, stopped);
});

test("pre-aborted async execution does not assemble or execute", async () => {
  const controller = new AbortController(); controller.abort();
  const result = await runTestCase(definition(), { signal: controller.signal });
  assert.equal(result.outcome, "FAIL"); assert.equal(result.cancelled, true);
  assert.equal(result.assembly.status, "not-run"); assert.equal(result.attemptedInstructions, 0);
});

test("abort while a scheduler is waiting resolves cancellation and late scheduler completion cannot resume", async () => {
  const controller = new AbortController(); let resume;
  const running = runTestCase(definition({ source: "br -1", expectedStatus: "limit-reached" }), { signal: controller.signal, yieldControl: () => new Promise((resolve) => { resume = resolve; }) });
  await Promise.resolve(); assert.equal(typeof resume, "function"); controller.abort();
  const result = await running;
  assert.equal(result.outcome, "FAIL"); assert.equal(result.cancelled, true); assert.equal(result.attemptedInstructions, 256);
  const before = structuredClone(result); resume(); await Promise.resolve();
  assert.deepEqual(result, before);
});

test("scheduler failure cancels instead of rejecting or fabricating PASS", async () => {
  const result = await runTestCase(definition({ source: "br -1" }), { yieldControl: async () => { throw new Error("scheduler stopped"); } });
  assert.equal(result.outcome, "FAIL"); assert.equal(result.cancelled, true);
  assert.match(result.failureReasons[0], /scheduling failed/); assert.equal(result.attemptedInstructions, 256);
});

test("initial register/memory inputs use checked boundaries and signed values without changing source or definitions", async () => {
  const input = definition({ source: "br 0\nHALT", initialState: { registers: { PC: 1 }, memory: [{ address: 0, value: -2147483648 }, { address: 65535, value: 2147483647 }] }, assertions: [memory(0, -2147483648), memory(65535, 2147483647)] });
  const before = structuredClone(input); const image = assembleSource(input.source).program; const bytes = new Uint8Array(image.bytes);
  const result = await runTestCase(input);
  assert.equal(result.outcome, "PASS"); assert.equal(result.attemptedInstructions, 1);
  assert.deepEqual(input, before); assert.deepEqual(image.bytes, bytes);
  assert.deepEqual(result.finalState.memory, input.initialState.memory);
});

test("initial memory can modify a test's code after loading but cannot leak into the next case", async () => {
  const first = definition({ id: "patched", source: "ldc 99\nHALT", initialState: { memory: [{ address: 0, value: 18 }] }, expectedAttempts: 1, assertions: [register("A", 0)] });
  const second = definition({ id: "original", source: first.source, expectedAttempts: 2, assertions: [register("A", 99)] });
  const result = await runTestSuite([first, second]);
  assert.equal(result.outcome, "PASS"); assert.deepEqual(result.results.map(({ finalState }) => finalState.registers.A), [0, 99]);
});

test("cases and suite members are captured before caller mutation; returned snapshots are detached", () => {
  const input = definition({ assertions: [register("A", 15)] }); const session = createTestExecution(input);
  input.source = "HALT"; input.assertions[0].expected = 0;
  const result = finish(session); assert.equal(result.outcome, "PASS"); assert.equal(result.finalState.registers.A, 15);
  result.finalState.registers.A = 900; result.assertions[1].expected = 900;
  assert.equal(session.getProgress().result.finalState.registers.A, 15);
  assert.equal(session.getProgress().result.assertions[1].expected, 15);
  const a = definition({ id: "a" }), b = definition({ id: "b", assertions: [register("A", 15)] });
  const suite = createTestSuiteExecution([a, b]); b.source = "HALT"; b.assertions[0].expected = 0;
  assert.equal(finish(suite).outcome, "PASS");
});

test("sequential suites preserve declaration order and isolate invalid, failing, faulting and passing cases", async () => {
  const cases = [definition({ id: "bad", assertions: [memory(-1, 0)] }), definition({ id: "wrong", assertions: [register("A", 20)] }), definition({ id: "fault", source: "data 255" }), definition({ id: "good", assertions: [register("A", 15)] })];
  const result = await runTestSuite(cases);
  assert.deepEqual(result.results.map(({ id }) => id), ["bad", "wrong", "fault", "good"]);
  assert.deepEqual(result.results.map(({ outcome }) => outcome), ["FAIL", "FAIL", "FAIL", "PASS"]);
  assert.equal(result.total, 4); assert.equal(result.passed, 1); assert.equal(result.failed, 3);
  assert.equal(result.results[0].assembly.status, "not-run"); assert.equal(result.results[3].attemptedInstructions, 3);
});

test("duplicate suite IDs fail every conflicting case while unrelated cases still run", async () => {
  const result = await runTestSuite([definition({ id: "same" }), definition({ id: "same" }), definition({ id: "other" })]);
  assert.equal(result.failed, 2); assert.equal(result.passed, 1);
  assert.ok(result.results.slice(0, 2).every(({ diagnostics }) => diagnostics.some(({ code }) => code === "T003_DUPLICATE_ID")));
  assert.ok(result.results.slice(0, 2).every(({ assembly }) => assembly.status === "not-run"));
});

test("empty suites pass with no execution; malformed suites and sparse members are reported", async () => {
  assert.deepEqual(await runTestSuite([]), { outcome: "PASS", total: 0, passed: 0, failed: 0, cancelled: false, results: [], diagnostics: [] });
  const invalid = await runTestSuite(null); assert.equal(invalid.outcome, "FAIL"); assert.equal(invalid.total, 0); assert.ok(invalid.diagnostics.length);
  const sparse = await runTestSuite(new Array(2)); assert.equal(sparse.total, 2); assert.equal(sparse.failed, 2);
});

test("suite advances one case/batch at a time and cancellation retains completed results and cancels the rest", () => {
  const suite = createTestSuiteExecution([definition({ id: "first", source: "HALT" }), definition({ id: "loop", source: "br -1" }), definition({ id: "last" })]);
  let progress = suite.advance(); assert.equal(progress.completed, 1); assert.equal(progress.activeTestId, "loop");
  progress = suite.advance(); assert.equal(progress.completed, 1);
  const result = suite.cancel().result;
  assert.equal(result.total, 3); assert.equal(result.passed, 1); assert.equal(result.failed, 2); assert.equal(result.cancelled, true);
  assert.equal(result.results[0].outcome, "PASS"); assert.equal(result.results[1].attemptedInstructions, 256);
  assert.equal(result.results[2].attemptedInstructions, 0); assert.equal(result.results[2].assembly.status, "not-run");
  assert.deepEqual(suite.advance().result, result);
});

test("async suite cancellation yields between cases, never launching the next CPU after abort", async () => {
  const controller = new AbortController();
  const result = await runTestSuite([definition({ id: "first" }), definition({ id: "next" })], { signal: controller.signal, yieldControl: async () => { controller.abort(); } });
  assert.equal(result.results[0].outcome, "PASS"); assert.equal(result.results[1].cancelled, true);
  assert.equal(result.results[1].assembly.status, "not-run"); assert.equal(result.passed, 1); assert.equal(result.failed, 1);
});

test("repeated runs and JSON round trips preserve stable IDs and deterministic results", async () => {
  const cases = [definition({ id: "__proto__", name: "Prototype-like ID", assertions: [register("A", 15)] }), definition({ id: "second", assertions: [register("A", 20)] })];
  const first = await runTestSuite(cases), second = await runTestSuite(JSON.parse(JSON.stringify(cases)));
  assert.deepEqual(second, first); assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test("test execution cannot modify an active debugger CPU, breakpoints, traces, source or scheduling", async () => {
  const pending = new Map(); let next = 0;
  const workspace = createWorkspaceController({ schedule(callback) { pending.set(++next, callback); return next; }, cancel(id) { pending.delete(id); } });
  workspace.setSource("ldc 10\nadc 5\nHALT"); workspace.assemble(); workspace.toggleBreakpoint(3); workspace.runToCursor(3);
  const before = structuredClone(workspace.getSnapshot()); const handles = [...pending.keys()];
  const result = await runTestSuite(PREDEFINED_TEST_CASES);
  assert.equal(result.passed, 14); assert.deepEqual(workspace.getSnapshot(), before); assert.deepEqual([...pending.keys()], handles);
  const [handle, callback] = pending.entries().next().value; pending.delete(handle); callback();
  assert.equal(workspace.getSnapshot().status, "cursor-paused"); assert.equal(workspace.getSnapshot().cpu.attemptedInstructions, 2);
  workspace.dispose();
});

for (const fixture of PREDEFINED_TEST_CASES) {
  test(`predefined ${fixture.id}: expected values match the runner and an independent direct CPU execution`, async () => {
    const before = JSON.stringify(fixture); const result = await runTestCase(fixture);
    assert.equal(result.outcome, "PASS", JSON.stringify(result.failureReasons));
    const assembled = assembleSource(fixture.source); assert.equal(assembled.status, "success");
    const cpu = createCpu(); assert.equal(loadProgram(cpu, assembled.program).ok, true);
    if (fixture.limits) assert.equal(setExecutionLimit(cpu, fixture.limits.maxInstructions).ok, true);
    for (const [name, value] of Object.entries(fixture.initialState?.registers ?? {})) assert.equal(writeRegister(cpu, name, value).ok, true);
    for (const { address, value } of fixture.initialState?.memory ?? []) assert.equal(writeMemory(cpu, address, value).ok, true);
    runCpuBatch(cpu, 100000); const direct = getCpuSnapshot(cpu);
    assert.equal(result.executionStatus, direct.status); assert.equal(result.attemptedInstructions, direct.attemptedInstructions);
    assert.deepEqual(result.finalState.registers, direct.registers);
    for (const { address, value } of result.finalState.memory) assert.equal(value, direct.memory[address]);
    assert.equal(JSON.stringify(fixture), before);
  });
}
