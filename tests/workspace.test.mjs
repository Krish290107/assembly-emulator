import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceController, DISASSEMBLY_WINDOW, MEMORY_WINDOW, parseAddress, SPEEDS } from "../src/lib/workspace/controller.ts";
import { editorMarkers } from "../src/lib/workspace/markers.ts";
import { createCpu, getCpuOverview, getCpuSnapshot } from "../src/lib/cpu/index.ts";

// Only browser timing is simulated; every assembly, load, and instruction is real.
function scheduler() {
  let id = 0;
  const pending = new Map();
  const history = [];
  return {
    pending, history,
    schedule(callback, delay) { const handle = ++id; pending.set(handle, callback); history.push({ handle, callback, delay }); return handle; },
    cancel(handle) { pending.delete(handle); },
    tick() { const next = pending.entries().next().value; assert.ok(next, "A batch must be scheduled"); pending.delete(next[0]); next[1](); },
    drain(max = 2000) { let ticks = 0; while (pending.size && ticks < max) { this.tick(); ticks++; } assert.equal(pending.size, 0, "Run must stop within bounded test ticks"); return ticks; },
  };
}
function setup(source) {
  const clock = scheduler();
  const controller = createWorkspaceController(clock);
  if (source !== undefined) { controller.setSource(source); controller.assemble(); }
  return { clock, controller, view: () => controller.getSnapshot() };
}
const reference = "ldc 10\nadc 5\nHALT";

test("workspace starts without fabricated CPU state or machine words", () => {
  const { controller, view, clock } = setup();
  assert.equal(view().status, "unassembled");
  assert.equal(view().cpu, null);
  assert.deepEqual(view().memory, []);
  assert.deepEqual(view().disassembly, []);
  controller.run(); controller.step(); controller.reset();
  assert.equal(clock.pending.size, 0);
  assert.equal(view().cpu, null);
});

test("assembly success loads exact display words and maps source without executing", () => {
  const { view } = setup("; heading\r\nentry: ldc 10\r\nadc 5\r\nHALT");
  assert.equal(view().status, "ready");
  assert.equal(view().wordCount, 3);
  assert.equal(view().symbolCount, 1);
  assert.deepEqual(view().cpu.registers, { A: 0, B: 0, PC: 0, SP: 65536 });
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.deepEqual(view().disassembly.map(({ hex, instruction, line }) => [hex, instruction, line]), [["00000A00", "ldc 10", 2], ["00000501", "adc 5", 3], ["00000012", "HALT", 4]]);
  assert.deepEqual(view().currentSource, { start: { line: 2, column: 1 }, end: { line: 2, column: 14 } });
  assert.match(view().logs.at(-1), /3 words \(12 bytes\).*Nothing executed/);
});

test("assembly errors display exact diagnostics and cannot retain an old executable", () => {
  const { controller, view, clock } = setup(reference);
  controller.assemble("ldc missing\nMOV 1");
  assert.equal(view().assembled, false);
  assert.equal(view().cpu, null);
  assert.equal(view().disassembly.length, 0);
  assert.equal(view().diagnostics[0].code, "P003_UNKNOWN_MNEMONIC");
  assert.deepEqual(view().diagnostics[0].source, { start: { line: 2, column: 1 }, end: { line: 2, column: 4 } });
  controller.run(); controller.step();
  assert.equal(clock.pending.size, 0);
  controller.assemble("ldc missing");
  assert.equal(view().diagnostics[0].code, "A005_UNDEFINED_SYMBOL");
  controller.assemble("same: HALT\nsame: HALT");
  assert.equal(view().diagnostics[0].code, "A001_DUPLICATE_LABEL");
  assert.ok(view().diagnostics[0].related[0].source);
});

test("empty source assembles but cannot run or step", () => {
  const { controller, clock, view } = setup("");
  assert.equal(view().assembled, true);
  assert.equal(view().status, "idle");
  assert.equal(view().wordCount, 0);
  controller.run(); controller.step();
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(clock.pending.size, 0);
});

test("Step attempts exactly one instruction and highlights real register changes", () => {
  const { controller, view } = setup(reference);
  controller.step();
  assert.equal(view().status, "paused");
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.deepEqual(view().cpu.registers, { A: 10, B: 0, PC: 1, SP: 65536 });
  assert.deepEqual(view().changedRegisters, ["A", "PC"]);
  assert.equal(view().currentSource.start.line, 2);
  controller.step(); controller.step();
  assert.equal(view().status, "halted");
  assert.deepEqual(view().cpu.registers, { A: 15, B: 0, PC: 2, SP: 65536 });
  assert.equal(view().cpu.attemptedInstructions, 3);
  controller.step(); controller.run();
  assert.equal(view().cpu.attemptedInstructions, 3);
});

test("Run schedules bounded work and produces exact reference final state", () => {
  const { controller, clock, view } = setup(reference);
  controller.run();
  assert.equal(view().status, "running");
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(clock.pending.size, 1);
  clock.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().running, false);
  assert.deepEqual(view().cpu.registers, { A: 15, B: 0, PC: 2, SP: 65536 });
  assert.equal(view().cpu.attemptedInstructions, 3);
  assert.deepEqual(view().diagnostics, []);
  assert.match(view().logs.at(-1), /Halted after 3 attempts/);
});

test("Pause and Resume cancel real schedules and preserve registers/memory/attempts", () => {
  const { controller, clock, view } = setup(reference);
  controller.setSpeed("slow"); controller.run(); clock.tick();
  const registers = structuredClone(view().cpu.registers);
  const memory = view().memory.map(({ value }) => value);
  const stale = clock.history.at(-1).callback;
  controller.pause();
  assert.equal(view().status, "paused");
  assert.equal(clock.pending.size, 0);
  stale();
  assert.deepEqual(view().cpu.registers, registers);
  assert.deepEqual(view().memory.map(({ value }) => value), memory);
  assert.equal(view().cpu.attemptedInstructions, 1);
  controller.run(); clock.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 3);
  assert.equal(view().cpu.registers.A, 15);
});

test("Pause before the first batch prevents all execution", () => {
  const { controller, clock, view } = setup(reference);
  controller.run(); const stale = clock.history.at(-1).callback; controller.pause(); stale();
  assert.equal(clock.pending.size, 0);
  assert.equal(view().cpu.attemptedInstructions, 0);
  controller.run(); clock.drain();
  assert.equal(view().cpu.attemptedInstructions, 3);
});

test("Reset cancels pending execution and restores the original loaded image", () => {
  const { controller, clock, view } = setup("ldc 18\nldc target\nstnl 0\nbr target\ntarget: data -1");
  controller.run(); clock.drain();
  assert.equal(view().memory[4].value, 18);
  controller.reset();
  assert.equal(view().status, "ready");
  assert.equal(view().memory[4].value, -1);
  assert.deepEqual(view().cpu.registers, { A: 0, B: 0, PC: 0, SP: 65536 });
  assert.equal(view().cpu.attemptedInstructions, 0);
  controller.run(); const stale = clock.history.at(-1).callback; controller.reset(); stale();
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(clock.pending.size, 0);
});

test("source edits clear CPU, diagnostics, markers and binary, requiring fresh assembly", () => {
  const { controller, clock, view } = setup(reference);
  controller.step(); controller.setSource("ldc 99\nHALT");
  assert.equal(view().status, "unassembled");
  assert.equal(view().cpu, null);
  assert.deepEqual(view().memory, []);
  assert.deepEqual(view().disassembly, []);
  assert.equal(view().currentSource, undefined);
  controller.run(); controller.step(); controller.reset();
  assert.equal(clock.pending.size, 0);
  controller.assemble(); controller.run(); clock.drain();
  assert.equal(view().cpu.registers.A, 99);
});

test("source replacement invalidates even an identical source session", () => {
  const { controller, clock, view } = setup(reference);
  controller.run(); const stale = clock.history.at(-1).callback;
  controller.setSource(reference, true); stale();
  assert.equal(view().cpu, null);
  assert.equal(clock.pending.size, 0);
});

test("stale callbacks cannot execute a newly assembled CPU session", () => {
  const { controller, clock, view } = setup(reference);
  controller.run(); const stale = clock.history.at(-1).callback;
  controller.setSource("ldc 8\nHALT"); controller.assemble(); controller.run();
  stale();
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(clock.pending.size, 1);
  clock.drain();
  assert.equal(view().cpu.registers.A, 8);
  assert.equal(view().cpu.attemptedInstructions, 2);
});

test("reassembly while running cancels old work, including a failed reassembly", () => {
  const { controller, clock, view } = setup(reference);
  controller.run(); const stale = clock.history.at(-1).callback;
  controller.assemble("MOV 1"); stale();
  assert.equal(clock.pending.size, 0);
  assert.equal(view().cpu, null);
  assert.equal(view().diagnostics[0].code, "P003_UNKNOWN_MNEMONIC");
});

test("rapid repeated Run/Pause/Reset clicks never create duplicate execution loops", () => {
  const { controller, clock, view } = setup("br -1");
  controller.run(); controller.run(); controller.run();
  assert.equal(clock.pending.size, 1);
  controller.pause(); controller.pause(); controller.run(); controller.run();
  assert.equal(clock.pending.size, 1);
  controller.step();
  assert.equal(view().cpu.attemptedInstructions, 0);
  clock.tick();
  assert.equal(view().cpu.attemptedInstructions, SPEEDS.normal.batch);
  assert.equal(clock.pending.size, 1);
  controller.reset(); controller.reset();
  for (const { callback } of [...clock.history]) callback();
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(clock.pending.size, 0);
});

test("disposing cancels execution and ignores callbacks, with Strict Mode resubscription safe", () => {
  const { controller, clock, view } = setup(reference);
  let updates = 0;
  controller.subscribe(() => updates++);
  controller.run(); const stale = clock.history.at(-1).callback;
  controller.dispose(); const count = updates; stale();
  assert.equal(clock.pending.size, 0);
  assert.equal(updates, count);
  assert.equal(view().cpu.attemptedInstructions, 0);
  const unsubscribe = controller.subscribe(() => updates++);
  controller.step();
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.ok(updates > count);
  unsubscribe(); controller.dispose();
});

test("speed changes alter timing/batch size without stale work or semantic differences", () => {
  for (const speed of ["slow", "normal", "fast"]) {
    const { controller, clock, view } = setup(reference);
    controller.setSpeed(speed); controller.run();
    assert.equal(clock.history.at(-1).delay, SPEEDS[speed].delay);
    clock.drain();
    assert.equal(view().cpu.registers.A, 15);
    assert.equal(view().cpu.attemptedInstructions, 3);
  }
  const { controller, clock, view } = setup("br -1");
  controller.run(); const stale = clock.history.at(-1).callback;
  controller.setSpeed("slow"); stale();
  assert.equal(clock.pending.size, 1);
  clock.tick();
  assert.equal(view().cpu.attemptedInstructions, 1);
  controller.pause();
});

test("runtime faults propagate exact real diagnostics and reset clears them", () => {
  const { controller, clock, view } = setup("ldc 65536\nldnl 0\nHALT");
  controller.run(); clock.drain();
  assert.equal(view().status, "error");
  assert.equal(view().cpu.attemptedInstructions, 2);
  assert.equal(view().diagnostics[0].code, "C005_INVALID_ADDRESS");
  assert.equal(view().diagnostics[0].source.start.line, 2);
  assert.equal(editorMarkers(view().diagnostics)[0].startLineNumber, 2);
  controller.run(); controller.step();
  assert.equal(clock.pending.size, 0);
  controller.reset();
  assert.equal(view().status, "ready");
  assert.deepEqual(view().diagnostics, []);
});

test("an infinite loop yields between small batches and stops at the actual CPU limit", () => {
  const { controller, clock, view } = setup("br -1");
  controller.setSpeed("fast"); controller.run(); clock.tick();
  assert.equal(view().status, "running");
  assert.equal(view().cpu.attemptedInstructions, 512);
  assert.equal(clock.pending.size, 1);
  clock.drain();
  assert.equal(view().status, "limit-reached");
  assert.equal(view().cpu.attemptedInstructions, 100000);
  assert.equal(view().diagnostics.at(-1).code, "UI_EXECUTION_LIMIT");
  assert.equal(view().logs.length, 4);
  controller.run(); assert.equal(clock.pending.size, 0);
  controller.reset();
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.deepEqual(view().diagnostics, []);
});

for (const [name, source, expected, attempts, memory] of [
  ["countdown", "ldc 3\nloop: brz done\nadc -1\nbr loop\ndone: HALT", { A: 0, B: 0, PC: 4, SP: 65536 }, 12],
  ["stack memory", "adj -1\nldc 42\nstl 0\nldl 0\nadj 1\nHALT", { A: 42, B: 0, PC: 5, SP: 65536 }, 6, [65535, 42]],
  ["call/return", "ldc 7\ncall fn\nHALT\nfn: return", { A: 7, B: 7, PC: 2, SP: 65536 }, 4],
]) {
  test(`controller source-to-final-state integration: ${name}`, () => {
    const { controller, clock, view } = setup(source);
    controller.run(); clock.drain();
    assert.equal(view().status, "halted");
    assert.deepEqual(view().cpu.registers, expected);
    assert.equal(view().cpu.attemptedInstructions, attempts);
    if (memory) { controller.setMemoryStart(memory[0]); assert.equal(view().memory[0].value, memory[1]); }
  });
}

test("memory window displays signed/hex values and highlights actual changed cells", () => {
  const { controller, view } = setup("ldc -7\nldc cell\nstnl 0\nHALT\ncell: data 0");
  controller.step(); controller.step(); controller.step();
  const row = view().memory.find(({ address }) => address === 4);
  assert.deepEqual(row, { address: 4, value: -7, hex: "FFFFFFF9", changed: true });
  assert.equal(view().disassembly[4].modified, true);
  controller.setMemoryStart(65535);
  assert.equal(view().memory.length, 1);
  assert.equal(view().memory[0].address, 65535);
  const before = view(); controller.setMemoryStart(65536); controller.setMemoryStart(-1); controller.setMemoryStart(0.5);
  assert.equal(view(), before);
});

test("memory/code pages stay bounded even for a maximum-size image", () => {
  const { controller, view } = setup("data 0\n".repeat(65536));
  assert.equal(view().wordCount, 65536);
  assert.equal(view().memory.length, MEMORY_WINDOW);
  assert.equal(view().disassembly.length, DISASSEMBLY_WINDOW);
  controller.setDisassemblyStart(65535);
  assert.equal(view().disassembly.length, 1);
  assert.equal(view().disassembly[0].address, 65535);
  assert.equal(view().disassembly[0].line, 65536);
  assert.equal("memory" in view().cpu, false);
  assert.equal("program" in view().cpu, false);
});

test("source highlighting suppresses mappings for self-modified instruction bits", () => {
  const { controller, view } = setup("stnl 0\ndata -1");
  // Use a source-driven store to alter the next instruction before it is fetched.
  controller.assemble("ldc 18\nldc next\nstnl 0\nnext: data -1");
  controller.step(); controller.step(); controller.step();
  assert.equal(view().cpu.registers.PC, 3);
  assert.equal(view().disassembly[3].hex, "00000012");
  assert.equal(view().disassembly[3].modified, true);
  assert.equal(view().currentSource, undefined);
  controller.step(); assert.equal(view().status, "halted");
});

test("successful reassembly and edits clear old marker diagnostics", () => {
  const { controller, view } = setup("ldc");
  assert.equal(editorMarkers(view().diagnostics).length, 1);
  controller.setSource(reference);
  assert.deepEqual(editorMarkers(view().diagnostics), []);
  controller.assemble();
  assert.deepEqual(editorMarkers(view().diagnostics), []);
});

test("editor marker projection preserves exact spans, codes and insertion positions", () => {
  const { view } = setup("ldc");
  assert.deepEqual(editorMarkers(view().diagnostics)[0], {
    startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4,
    severity: "error", code: "P004_MISSING_OPERAND", message: "ldc requires one operand.",
  });
  assert.deepEqual(editorMarkers([{ severity: "error", code: "general", message: "No position" }]), []);
});

test("address inputs reject malformed/out-of-range values without wrapping", () => {
  for (const [input, expected] of [["0", 0], ["65535", 65535], [" 0xFFFF ", 65535], ["007", 7]]) assert.equal(parseAddress(input), expected);
  for (const input of ["", "-1", "65536", "0x10000", "1.5", "1e2", "Infinity", "1+2"]) assert.equal(parseAddress(input), null);
});

test("compact overview and UI projections cannot mutate the authoritative CPU", () => {
  const cpu = createCpu();
  const overview = getCpuOverview(cpu);
  assert.equal("memory" in overview, false);
  assert.equal("program" in overview, false);
  overview.registers.A = 99; overview.limits.maxInstructions = 1;
  assert.equal(getCpuSnapshot(cpu).registers.A, 0);
  assert.equal(getCpuSnapshot(cpu).limits.maxInstructions, 100000);
  const { controller, view } = setup(reference);
  view().cpu.registers.A = 999;
  view().memory[0].value = 999;
  view().currentSource.start.line = 900;
  controller.step();
  assert.deepEqual(view().cpu.registers, { A: 10, B: 0, PC: 1, SP: 65536 });
  assert.equal(view().memory[0].value, 2560);
  controller.reset();
  assert.equal(view().currentSource.start.line, 1);
});
