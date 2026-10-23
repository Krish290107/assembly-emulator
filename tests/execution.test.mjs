import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleSource } from "../src/lib/assembler/index.ts";
import { createCpu, loadProgram, resetCpu, getCpuSnapshot, stepCpu, runCpuBatch, readMemory, writeMemory, writeRegister, setExecutionLimit } from "../src/lib/cpu/index.ts";
import { prepareInstruction } from "../src/lib/cpu/execution.ts";

function value(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}
function binary(source) {
  const result = assembleSource(source);
  assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
  return result.program;
}
function cpuFor(source, registers = {}, memory = []) {
  const cpu = createCpu();
  value(loadProgram(cpu, binary(source)));
  for (const [name, initial] of Object.entries(registers)) value(writeRegister(cpu, name, initial));
  for (const [address, initial] of memory) value(writeMemory(cpu, address, initial));
  return cpu;
}
function fault(cpu, code, target) {
  const before = getCpuSnapshot(cpu);
  const result = stepCpu(cpu);
  const after = getCpuSnapshot(cpu);
  assert.equal(result.status, "error");
  assert.equal(result.attempts, 1);
  assert.equal(result.attemptedInstructions, before.attemptedInstructions + 1);
  assert.equal(after.attemptedInstructions, result.attemptedInstructions);
  assert.deepEqual(after.registers, before.registers);
  assert.deepEqual(after.memory, before.memory);
  assert.equal(after.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, code);
  assert.equal(result.diagnostics[0].address, before.registers.PC);
  if (target !== undefined) assert.equal(result.diagnostics[0].target, target);
  assert.equal(stepCpu(cpu).attempts, 0);
  assert.deepEqual(getCpuSnapshot(cpu), after);
  return result;
}

const base = { A: 3, B: 9, PC: 0, SP: 10 };
for (const [source, initial, memory, expected, writes = []] of [
  ["ldc -7", { A: 10, B: 20 }, [], { A: -7, B: 10, PC: 1, SP: 10 }],
  ["adc 5", { A: 10, B: 20 }, [], { A: 15, B: 20, PC: 1, SP: 10 }],
  ["ldl -1", { A: 5, B: 6 }, [[9, -123]], { A: -123, B: 5, PC: 1, SP: 10 }],
  ["stl -1", { A: 5, B: 6 }, [], { A: 6, B: 6, PC: 1, SP: 10 }, [[9, 5]]],
  ["ldnl 2", { A: 7, B: 6 }, [[9, -12]], { A: -12, B: 6, PC: 1, SP: 10 }],
  ["stnl 2", { A: 7, B: -5 }, [], { A: 7, B: -5, PC: 1, SP: 10 }, [[9, -5]]],
  ["add", {}, [], { A: 12, B: 9, PC: 1, SP: 10 }],
  ["sub", {}, [], { A: 6, B: 9, PC: 1, SP: 10 }],
  ["shl", { A: 2, B: -7 }, [], { A: -28, B: -7, PC: 1, SP: 10 }],
  ["shr", { A: 2, B: -7 }, [], { A: -2, B: -7, PC: 1, SP: 10 }],
  ["adj -4", {}, [], { A: 3, B: 9, PC: 1, SP: 6 }],
  ["a2sp", { A: 65536 }, [], { A: 9, B: 9, PC: 1, SP: 65536 }],
  ["sp2a", { SP: 65536 }, [], { A: 65536, B: 3, PC: 1, SP: 65536 }],
  ["call 1", { A: 7 }, [], { A: 0, B: 7, PC: 2, SP: 10 }],
  ["return", {}, [], { A: 9, B: 9, PC: 4, SP: 10 }],
  ["brz 2", { A: 0 }, [], { A: 0, B: 9, PC: 3, SP: 10 }],
  ["brlz 2", { A: -1 }, [], { A: -1, B: 9, PC: 3, SP: 10 }],
  ["br 2", {}, [], { A: 3, B: 9, PC: 3, SP: 10 }],
  ["HALT", {}, [], base],
]) {
  test(`execution: ${source} uses old values and commits only its specified effects`, () => {
    const cpu = cpuFor(`${source}\nHALT`, { ...base, ...initial }, memory);
    const before = getCpuSnapshot(cpu);
    const result = stepCpu(cpu);
    assert.equal(result.status, source === "HALT" ? "halted" : "paused");
    assert.equal(result.attempts, 1);
    assert.equal(result.attemptedInstructions, 1);
    assert.deepEqual(result.diagnostics, []);
    const after = getCpuSnapshot(cpu);
    assert.deepEqual(after.registers, expected);
    for (const [address, stored] of writes) before.memory[address] = stored;
    assert.deepEqual(after.memory, before.memory);
    assert.deepEqual(after.trace, []);
  });
}

for (const [source, A, B, expected] of [
  ["adc 1", 2147483647, 17, -2147483648], ["adc -1", -2147483648, 17, 2147483647],
  ["adc 8388607", 2147483647, 17, -2139095042],
  ["add", 2147483647, 2147483647, -2], ["add", -2147483648, -2147483648, 0],
  ["sub", -1, 2147483647, -2147483648], ["sub", 1, -2147483648, 2147483647],
  ["sub", -2147483648, 2147483647, -1],
]) {
  test(`${source} wraps signed arithmetic exactly for A=${A}, B=${B}`, () => {
    const cpu = cpuFor(`${source}\nHALT`, { A, B });
    assert.equal(stepCpu(cpu).status, "paused");
    assert.deepEqual(getCpuSnapshot(cpu).registers, { A: expected, B, PC: 1, SP: 65536 });
  });
}

for (const [source, A, B, expected] of [
  ["shl", 0, -2147483648, -2147483648], ["shl", 1, -2147483648, 0],
  ["shl", 31, 1073741825, -2147483648], ["shl", 30, 2147483647, -1073741824],
  ["shr", 0, -1, -1], ["shr", 1, -3, -2], ["shr", 31, -2147483648, -1], ["shr", 31, 2147483647, 0],
]) {
  test(`${source} preserves exact bits for count ${A} and value ${B}`, () => {
    const cpu = cpuFor(`${source}\nHALT`, { A, B });
    assert.equal(stepCpu(cpu).status, "paused");
    assert.equal(getCpuSnapshot(cpu).registers.A, expected);
    assert.equal(getCpuSnapshot(cpu).registers.B, B);
  });
}

test("negative and oversized shift counts fault before JavaScript can mask them", () => {
  for (const source of ["shl", "shr"]) {
    for (const A of [-2147483648, -1, 32, 2147483647]) fault(cpuFor(source, { A, B: 23 }), "C013_INVALID_SHIFT", A);
  }
});

test("invalid fetched opcodes and zero-operand payloads fault atomically", () => {
  const invalidOpcode = fault(cpuFor("data -1"), "C002_INVALID_OPCODE");
  assert.equal(invalidOpcode.diagnostics[0].word, -1);
  assert.deepEqual(invalidOpcode.diagnostics[0].source, { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } });
  fault(cpuFor("data 262"), "C003_INVALID_ENCODING");
});

test("all memory instructions check mathematical addresses without wrapping", () => {
  for (const [source, initial, target] of [
    ["ldl 0", { SP: 65536 }, 65536], ["stl -1", { SP: 0, A: 9, B: 8 }, -1],
    ["ldnl 1", { A: 2147483647 }, 2147483648], ["stnl -1", { A: -2147483648, B: 9 }, -2147483649],
  ]) fault(cpuFor(source, initial), "C005_INVALID_ADDRESS", target);
});

test("adj and a2sp reject invalid SP without committing other register effects", () => {
  for (const [source, initial, target] of [
    ["adj -1", { SP: 0 }, -1], ["adj 1", { SP: 65536 }, 65537],
    ["a2sp", { A: -1, B: 8 }, -1], ["a2sp", { A: 65537, B: 8 }, 65537],
  ]) fault(cpuFor(source, initial), "C012_INVALID_SP", target);
});

test("stack boundary addresses and one-past-end SP remain distinct", () => {
  const cpu = cpuFor("ldl -1\nadj -65536\nstl 0\na2sp\nHALT", { A: 9, B: 8 }, [[65535, 65536]]);
  stepCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu).registers, { A: 65536, B: 9, PC: 1, SP: 65536 });
  stepCpu(cpu);
  assert.equal(getCpuSnapshot(cpu).registers.SP, 0);
  stepCpu(cpu);
  assert.equal(value(readMemory(cpu, 0)), 65536);
  value(writeRegister(cpu, "A", 65536));
  stepCpu(cpu);
  assert.equal(getCpuSnapshot(cpu).registers.SP, 65536);
});

test("call stores its original nonzero PC and old A without touching SP or memory", () => {
  const cpu = cpuFor("HALT\nHALT\ncall done\nHALT\ndone: HALT", { A: 23, B: 99, PC: 2 });
  const before = getCpuSnapshot(cpu);
  stepCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu).registers, { A: 2, B: 23, PC: 4, SP: 65536 });
  assert.deepEqual(getCpuSnapshot(cpu).memory, before.memory);
});

test("return uses old A + 1 and old B without requiring a preceding call", () => {
  const cpu = cpuFor("return", { A: 65534, B: -44 });
  stepCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu).registers, { A: -44, B: -44, PC: 65535, SP: 65536 });
});

test("taken and untaken conditional branches never pop registers", () => {
  for (const [source, A, expectedPC] of [["brz 2", 0, 3], ["brz 2", -1, 1], ["brlz 2", -1, 3], ["brlz 2", 0, 1], ["brlz 2", 1, 1]]) {
    const cpu = cpuFor(source, { A, B: 88 });
    stepCpu(cpu);
    assert.deepEqual(getCpuSnapshot(cpu).registers, { A, B: 88, PC: expectedPC, SP: 65536 });
  }
});

test("untaken branches ignore invalid targets; taken branches reject them", () => {
  for (const [source, untaken, taken] of [["brz 8388607", 1, 0], ["brlz -8388608", 0, -1]]) {
    const cpu = cpuFor(source, { A: untaken });
    assert.equal(stepCpu(cpu).status, "paused");
    assert.equal(getCpuSnapshot(cpu).registers.PC, 1);
    fault(cpuFor(source, { A: taken }), "C014_INVALID_TARGET");
  }
});

test("branch, call, and return targets fault without wrapping or partial effects", () => {
  for (const [source, initial, target] of [
    ["br -2", {}, -1], ["call 8388607", { A: 9, B: 8 }, 8388608],
    ["return", { A: 2147483647, B: 8 }, 2147483648], ["return", { A: -2, B: 8 }, -1],
  ]) fault(cpuFor(source, initial), "C014_INVALID_TARGET", target);
});

test("HALT at address 65,535 succeeds and preserves its PC", () => {
  const cpu = cpuFor("HALT", { A: 7, B: -9, PC: 65535 });
  value(writeMemory(cpu, 65535, 18));
  value(setExecutionLimit(cpu, 1));
  const result = stepCpu(cpu);
  assert.equal(result.status, "halted");
  assert.equal(result.attempts, 1);
  assert.deepEqual(getCpuSnapshot(cpu).registers, { A: 7, B: -9, PC: 65535, SP: 65536 });
});

test("every non-HALT fallthrough/zero-displacement result at the last word faults before commit", () => {
  for (const source of ["ldc 1", "adc 1", "ldl 0", "stl 0", "ldnl 0", "stnl 0", "add", "sub", "shl", "shr", "adj 0", "a2sp", "sp2a", "call 0", "return", "brz 0", "brlz 0", "br 0"]) {
    const bytes = binary(source).bytes;
    const word = new DataView(bytes.buffer, bytes.byteOffset, 4).getInt32(0, true);
    const cpu = cpuFor("HALT", { PC: 65535, SP: 0, A: source === "return" ? 65535 : 1, B: 8 });
    value(writeMemory(cpu, 65535, word));
    fault(cpu, "C014_INVALID_TARGET", 65536);
  }
});

test("untaken last-word branches validate fallthrough even if their unused target is valid", () => {
  for (const [source, A] of [["brz -1", 1], ["brlz -1", 0]]) {
    const bytes = binary(source).bytes;
    const cpu = cpuFor("HALT", { PC: 65535, A });
    value(writeMemory(cpu, 65535, new DataView(bytes.buffer).getInt32(0, true)));
    fault(cpu, "C014_INVALID_TARGET", 65536);
  }
});

test("the pure preparation phase rejects bad PC/shift values and never mutates inputs", () => {
  const state = { registers: { A: 1, B: 9, PC: 0, SP: 0 }, memory: new Int32Array([3]) };
  Object.freeze(state.registers);
  const before = structuredClone(state);
  const prepared = value(prepareInstruction(state));
  assert.deepEqual(prepared.write, { address: 0, value: 1 });
  assert.deepEqual(state, before);
  for (const PC of [-1, 65536, 0.5, NaN, Infinity]) {
    const result = prepareInstruction({ ...state, registers: { ...state.registers, PC } });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostic.code, "C004_INVALID_PC");
  }
  const fractionalShift = prepareInstruction({ registers: { ...state.registers, A: 1.5 }, memory: new Int32Array([8]) });
  assert.equal(fractionalShift.ok, false);
  assert.equal(fractionalShift.diagnostic.code, "C013_INVALID_SHIFT");
});

test("runtime validation order checks memory/shift/SP before resulting PC", () => {
  for (const [source, initial, code] of [["stl 0", { SP: 65536 }, "C005_INVALID_ADDRESS"], ["shl", { A: 32 }, "C013_INVALID_SHIFT"], ["a2sp", { A: -1 }, "C012_INVALID_SP"]]) {
    const bytes = binary(source).bytes;
    const cpu = cpuFor("HALT", { ...initial, PC: 65535 });
    value(writeMemory(cpu, 65535, new DataView(bytes.buffer).getInt32(0, true)));
    fault(cpu, code);
  }
});

test("reference program executes identically by stepping or batching", () => {
  const source = "ldc 10\nadc 5\nHALT";
  const stepped = cpuFor(source);
  assert.equal(getCpuSnapshot(stepped).status, "ready");
  assert.equal(stepCpu(stepped).status, "paused");
  assert.deepEqual(getCpuSnapshot(stepped).registers, { A: 10, B: 0, PC: 1, SP: 65536 });
  assert.equal(stepCpu(stepped).status, "paused");
  const result = stepCpu(stepped);
  assert.deepEqual(result, { status: "halted", attempts: 1, attemptedInstructions: 3, diagnostics: [] });
  const batched = cpuFor(source);
  assert.deepEqual(runCpuBatch(batched, 10), { status: "halted", attempts: 3, attemptedInstructions: 3, diagnostics: [] });
  assert.deepEqual(getCpuSnapshot(stepped).registers, { A: 15, B: 0, PC: 2, SP: 65536 });
  assert.deepEqual(getCpuSnapshot(batched), getCpuSnapshot(stepped));
});

test("terminating countdown follows forward and backward branches", () => {
  const cpu = cpuFor("ldc 3\nloop: brz done\nadc -1\nbr loop\ndone: HALT");
  const result = runCpuBatch(cpu, 20);
  assert.equal(result.status, "halted");
  assert.equal(result.attempts, 12);
  assert.deepEqual(getCpuSnapshot(cpu).registers, { A: 0, B: 0, PC: 4, SP: 65536 });
});

test("descending-stack store/load program restores SP and preserves its stored word", () => {
  const cpu = cpuFor("adj -1\nldc 42\nstl 0\nldl 0\nadj 1\nHALT");
  assert.equal(runCpuBatch(cpu, 10).attempts, 6);
  const state = getCpuSnapshot(cpu);
  assert.equal(state.status, "halted");
  assert.deepEqual(state.registers, { A: 42, B: 0, PC: 5, SP: 65536 });
  assert.equal(state.memory[65535], 42);
});

test("A-relative data store/load uses old B and the shared memory model", () => {
  const cpu = cpuFor("ldc -7\nldc cell\nstnl 0\nldnl 0\nHALT\ncell: data 0");
  assert.equal(runCpuBatch(cpu, 20).attempts, 5);
  const state = getCpuSnapshot(cpu);
  assert.equal(state.status, "halted");
  assert.deepEqual(state.registers, { A: -7, B: -7, PC: 4, SP: 65536 });
  assert.equal(state.memory[5], -7);
});

test("call/return program restores the link and uses no implicit stack", () => {
  const cpu = cpuFor("ldc 7\ncall fn\nHALT\nfn: return");
  const before = getCpuSnapshot(cpu);
  assert.equal(runCpuBatch(cpu, 10).attempts, 4);
  const state = getCpuSnapshot(cpu);
  assert.equal(state.status, "halted");
  assert.deepEqual(state.registers, { A: 7, B: 7, PC: 2, SP: 65536 });
  assert.deepEqual(state.memory, before.memory);
});

test("branching into data uses normal decoding and permits self-modifying code", () => {
  const cpu = cpuFor("br target\ndata -1\ntarget: data 18");
  assert.equal(runCpuBatch(cpu, 5).status, "halted");
  assert.equal(getCpuSnapshot(cpu).registers.PC, 2);
  const bad = cpuFor("br target\ntarget: data -1");
  assert.equal(runCpuBatch(bad, 5).status, "error");
  assert.equal(getCpuSnapshot(bad).attemptedInstructions, 2);
  const modified = cpuFor("stnl 0\ndata -1", { A: 1, B: 18 });
  assert.equal(runCpuBatch(modified, 5).status, "halted");
  assert.equal(value(readMemory(modified, 1)), 18);
});

test("batches pause exactly at their bound and resume the same cumulative execution", () => {
  const cpu = cpuFor("ldc 10\nadc 5\nHALT");
  assert.deepEqual(runCpuBatch(cpu, 2), { status: "paused", attempts: 2, attemptedInstructions: 2, diagnostics: [] });
  assert.deepEqual(getCpuSnapshot(cpu).registers, { A: 15, B: 0, PC: 2, SP: 65536 });
  assert.deepEqual(runCpuBatch(cpu, 1), { status: "halted", attempts: 1, attemptedInstructions: 3, diagnostics: [] });
});

test("invalid batch sizes return request diagnostics without changing state or attempts", () => {
  const cpu = cpuFor("HALT");
  const before = getCpuSnapshot(cpu);
  for (const size of [0, -1, 0.5, NaN, Infinity, 10000001, "1", null]) {
    const result = runCpuBatch(cpu, size);
    assert.equal(result.status, "ready");
    assert.equal(result.attempts, 0);
    assert.equal(result.diagnostics[0].code, "C015_INVALID_BATCH_SIZE");
    assert.deepEqual(getCpuSnapshot(cpu), before);
  }
  assert.equal(runCpuBatch(cpu, 10000000).attempts, 1);
});

test("idle CPUs cannot execute cold memory or an empty image", () => {
  const cpu = createCpu();
  value(writeMemory(cpu, 0, 18));
  assert.equal(stepCpu(cpu).status, "idle");
  assert.equal(runCpuBatch(cpu, 5).attempts, 0);
  value(loadProgram(cpu, binary("")));
  assert.deepEqual(stepCpu(cpu), { status: "idle", attempts: 0, attemptedInstructions: 0, diagnostics: [] });
});

test("step and batch share one budget, including a final committed ordinary instruction", () => {
  const cpu = cpuFor("br -1");
  value(setExecutionLimit(cpu, 3));
  assert.equal(stepCpu(cpu).status, "paused");
  assert.deepEqual(runCpuBatch(cpu, 1), { status: "paused", attempts: 1, attemptedInstructions: 2, diagnostics: [] });
  assert.deepEqual(stepCpu(cpu), { status: "limit-reached", attempts: 1, attemptedInstructions: 3, diagnostics: [] });
  const terminal = getCpuSnapshot(cpu);
  assert.equal(runCpuBatch(cpu, 100).attempts, 0);
  assert.deepEqual(getCpuSnapshot(cpu), terminal);
});

test("default budget bounds an infinite loop without exceeding 100,000 attempts", () => {
  const cpu = cpuFor("br -1");
  const result = runCpuBatch(cpu, 1000000);
  assert.equal(result.status, "limit-reached");
  assert.equal(result.attempts, 100000);
  assert.equal(result.attemptedInstructions, 100000);
  assert.equal(getCpuSnapshot(cpu).registers.PC, 0);
});

test("HALT and faults take precedence at the final permitted attempt", () => {
  const halted = cpuFor("HALT");
  value(setExecutionLimit(halted, 1));
  assert.equal(stepCpu(halted).status, "halted");
  const failed = cpuFor("data -1");
  value(setExecutionLimit(failed, 1));
  fault(failed, "C002_INVALID_OPCODE");
  const ordinary = cpuFor("ldc 7\nHALT");
  value(setExecutionLimit(ordinary, 1));
  assert.equal(stepCpu(ordinary).status, "limit-reached");
  assert.deepEqual(getCpuSnapshot(ordinary).registers, { A: 7, B: 0, PC: 1, SP: 65536 });
});

test("an exhausted budget is checked before a fetch and counts no extra attempt", () => {
  const cpu = cpuFor("adc 1\nbr -2");
  runCpuBatch(cpu, 2);
  value(setExecutionLimit(cpu, 2));
  value(writeMemory(cpu, 0, -1));
  const before = getCpuSnapshot(cpu);
  assert.deepEqual(stepCpu(cpu), { status: "limit-reached", attempts: 0, attemptedInstructions: 2, diagnostics: [] });
  assert.deepEqual(getCpuSnapshot(cpu).registers, before.registers);
  assert.deepEqual(getCpuSnapshot(cpu).memory, before.memory);
});

test("configuration/setup changes cannot resume terminal CPUs or reset counted attempts", () => {
  for (const source of ["HALT", "data -1", "br -1"]) {
    const cpu = cpuFor(source);
    value(setExecutionLimit(cpu, 1));
    stepCpu(cpu);
    const status = getCpuSnapshot(cpu).status;
    assert.equal(setExecutionLimit(cpu, 0).ok, false);
    value(setExecutionLimit(cpu, 100));
    value(writeRegister(cpu, "PC", 0));
    value(writeMemory(cpu, 0, 18));
    assert.equal(stepCpu(cpu).status, status);
    assert.equal(runCpuBatch(cpu, 5).attempts, 0);
    assert.equal(getCpuSnapshot(cpu).attemptedInstructions, 1);
  }
  const cpu = cpuFor("br -1");
  runCpuBatch(cpu, 3);
  const before = getCpuSnapshot(cpu);
  assert.equal(setExecutionLimit(cpu, 2).ok, false);
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("reset/load clears attempts and faults and deterministically restores execution", () => {
  for (const [source, limit] of [
    ["ldc 10\nadc 5\nHALT", 10], ["data -1", 10], ["br -1", 3],
    ["ldc 18\nldc target\nstnl 0\nbr target\ntarget: data -1", 10],
  ]) {
    const cpu = cpuFor(source);
    value(setExecutionLimit(cpu, limit));
    const loaded = getCpuSnapshot(cpu);
    const first = runCpuBatch(cpu, 10);
    const terminal = getCpuSnapshot(cpu);
    resetCpu(cpu);
    assert.deepEqual(getCpuSnapshot(cpu), loaded);
    assert.deepEqual(runCpuBatch(cpu, 10), first);
    assert.deepEqual(getCpuSnapshot(cpu), terminal);
    value(loadProgram(cpu, binary("HALT")));
    assert.equal(getCpuSnapshot(cpu).attemptedInstructions, 0);
    assert.deepEqual(getCpuSnapshot(cpu).diagnostics, []);
    assert.equal(stepCpu(cpu).status, "halted");
  }
});

test("execution results and snapshots do not expose live diagnostics or memory", () => {
  const cpu = cpuFor("data -1");
  const result = stepCpu(cpu);
  const before = getCpuSnapshot(cpu);
  result.diagnostics[0].message = "changed";
  result.diagnostics[0].source.start.column = 900;
  result.status = "running";
  result.attemptedInstructions = 0;
  assert.equal("memory" in result, false);
  assert.equal("registers" in result, false);
  assert.deepEqual(getCpuSnapshot(cpu), before);
});
