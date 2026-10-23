import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleSource } from "../src/lib/assembler/index.ts";
import { createCpu, loadProgram, getCpuSnapshot, resetCpu, runCpuBatch, stepCpu, stepCpuTraced, setExecutionLimit } from "../src/lib/cpu/index.ts";
import { createWorkspaceController } from "../src/lib/workspace/controller.ts";
import { breakpointLocations, sourceOffset, TRACE_CAPACITY } from "../src/lib/workspace/debugger.ts";

function binary(source) {
  const result = assembleSource(source);
  assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
  return result.program;
}
function cpuFor(source, limit = 100000) {
  const cpu = createCpu();
  assert.equal(loadProgram(cpu, binary(source)).ok, true);
  assert.equal(setExecutionLimit(cpu, limit).ok, true);
  return cpu;
}
function setup(source) {
  let id = 0;
  const pending = new Map();
  const callbacks = [];
  const scheduler = {
    schedule(callback) { pending.set(++id, callback); callbacks.push(callback); return id; },
    cancel(handle) { pending.delete(handle); },
    tick() { const next = pending.entries().next().value; assert.ok(next); pending.delete(next[0]); next[1](); },
    drain(max = 2000) { let count = 0; while (pending.size && count++ < max) this.tick(); assert.equal(pending.size, 0); },
  };
  const controller = createWorkspaceController(scheduler);
  controller.setSource(source); controller.assemble();
  return { controller, scheduler, pending, callbacks, view: () => controller.getSnapshot() };
}
const reference = "ldc 10\nadc 5\nHALT";
const countdown = "ldc 3\nloop: brz done\nadc -1\nbr loop\ndone: HALT";

test("modified fault traces omit stale source positions while retaining the real diagnostic", () => {
  const { controller, scheduler, view } = setup("ldc 255\nldc next\nstnl 0\nnext: HALT");
  controller.run(); scheduler.drain();
  const fault = view().trace.at(-1);
  assert.equal(fault.step, 4);
  assert.equal(fault.word, 255);
  assert.equal(fault.modified, true);
  assert.equal(fault.source, undefined);
  assert.equal(fault.diagnostic.source, undefined);
  assert.equal(fault.diagnostic.code, view().cpu.diagnostics[0].code);
  assert.deepEqual(fault.before, fault.after);
});

test("instructions written beyond the image are marked modified against reset zero memory", () => {
  const { controller, scheduler, view } = setup("ldc 18\nldc 20\nstnl 0\nbr 16");
  controller.run(); scheduler.drain();
  const halt = view().trace.at(-1);
  assert.equal(halt.address, 20);
  assert.equal(halt.word, 18);
  assert.equal(halt.status, "halted");
  assert.equal(halt.modified, true);
  assert.equal(halt.source, undefined);
  assert.equal(view().cpu.attemptedInstructions, 5);
});

test("breakpoints create, deduplicate by source line/address, disable, remove and clear", () => {
  const { controller, view } = setup(reference);
  assert.equal(controller.toggleBreakpoint(1), true);
  assert.equal(view().breakpoints.length, 1);
  assert.deepEqual(view().breakpoints[0], { id: "line-1", sourceLine: 1, enabled: true, address: 0, resolution: "resolved", modified: false, message: "Word 0. Stops before execution." });
  controller.toggleBreakpoint(1);
  assert.equal(view().breakpoints.length, 0);
  controller.toggleBreakpoint(1); controller.toggleBreakpoint(2);
  assert.equal(new Set(view().breakpoints.map(({ address }) => address)).size, 2);
  controller.setBreakpointEnabled("line-1", false);
  assert.equal(view().breakpoints[0].enabled, false);
  controller.removeBreakpoint("line-1");
  assert.deepEqual(view().breakpoints.map(({ sourceLine }) => sourceLine), [2]);
  controller.clearBreakpoints();
  assert.deepEqual(view().breakpoints, []);
});

test("only exact CPU instruction lines resolve: labels, comments, data and blank lines do not slide", () => {
  const source = "; heading\r\nlabel:\r\n\r\nvalue: data 18\r\ninline: ldc value\r\nHALT";
  assert.deepEqual([...breakpointLocations(source, binary(source))], [[5, 1], [6, 2]]);
  const { controller, view } = setup(source);
  for (let line = 1; line <= 6; line++) controller.toggleBreakpoint(line);
  assert.deepEqual(view().breakpoints.map(({ address }) => address), [undefined, undefined, undefined, undefined, 1, 2]);
  assert.match(view().breakpoints[0].message, /No CPU instruction/);
  for (const line of [-1, 0, 7, 1.5, NaN, Infinity]) assert.equal(controller.toggleBreakpoint(line), false);
});

test("pending gutter definitions resolve after assembly, including BOM and CRLF positions", () => {
  const { controller, view } = setup("");
  controller.setSource("\uFEFF; heading\r\n\tldc 1\r\nHALT");
  controller.toggleBreakpoint(2);
  assert.equal(view().breakpoints[0].resolution, "pending");
  assert.equal(view().breakpoints[0].address, undefined);
  controller.assemble();
  assert.equal(view().breakpoints[0].resolution, "resolved");
  assert.equal(view().breakpoints[0].address, 0);
});

test("malformed/out-of-bounds source maps cannot bind a breakpoint", () => {
  const source = reference;
  const program = binary(source);
  for (const mutated of [
    { ...program, origin: 1 }, { ...program, bytes: new Uint8Array(1) },
    { ...program, sourceMap: [] }, { ...program, sourceMap: Array(3) },
    ...[-4, 1, 262144, NaN].map((offset) => ({ ...program, sourceMap: [{ ...program.sourceMap[0], offset }, ...program.sourceMap.slice(1)] })),
    { ...program, sourceMap: [{ ...program.sourceMap[0], length: 8 }, ...program.sourceMap.slice(1)] },
    { ...program, sourceMap: [{ ...program.sourceMap[0], source: { start: { line: 900, column: 1 }, end: { line: 900, column: 7 } } }, ...program.sourceMap.slice(1)] },
  ]) assert.equal(breakpointLocations(source, mutated).size, 0);
  assert.equal(breakpointLocations("MOV 1", program).size, 0);
});

test("initial breakpoint stops before the first attempt with exact machine state preserved", () => {
  const { controller, scheduler, view, pending } = setup(reference);
  controller.toggleBreakpoint(1);
  const before = structuredClone(view().cpu);
  const memory = structuredClone(view().memory);
  controller.run(); scheduler.tick();
  assert.equal(view().status, "breakpoint-paused");
  assert.deepEqual(view().cpu, before);
  assert.deepEqual(view().memory, memory);
  assert.equal(view().trace.length, 0);
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(view().breakpointPause.address, 0);
  assert.equal(pending.size, 0);
});

test("multiple breakpoints cannot be crossed blindly by one fast bounded batch", () => {
  const { controller, scheduler, view } = setup(reference);
  controller.setSpeed("fast"); controller.toggleBreakpoint(2); controller.toggleBreakpoint(3);
  controller.run(); scheduler.drain();
  assert.equal(view().breakpointPause.address, 1);
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.deepEqual(view().trace.map(({ address }) => address), [0]);
  controller.run(); scheduler.drain();
  assert.equal(view().breakpointPause.address, 2);
  assert.equal(view().cpu.attemptedInstructions, 2);
  controller.run(); scheduler.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 3);
});

test("Resume passes the stopped address once and breakpoint triggers on later loop revisits", () => {
  const { controller, scheduler, view } = setup(countdown);
  controller.toggleBreakpoint(2);
  for (const count of [1, 4, 7, 10]) {
    controller.run(); scheduler.drain();
    assert.equal(view().status, "breakpoint-paused");
    assert.equal(view().cpu.attemptedInstructions, count);
    assert.equal(view().trace.length, count);
    assert.equal(view().cpu.registers.PC, 1);
  }
  controller.run(); scheduler.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 12);
  assert.deepEqual(view().trace.map(({ address }) => address), [0, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 4]);
});

test("Step bypasses a stopped breakpoint for exactly one counted attempt", () => {
  const { controller, scheduler, view } = setup("br -1");
  controller.toggleBreakpoint(1); controller.run(); scheduler.drain();
  controller.step();
  assert.equal(view().status, "paused");
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.equal(view().trace.length, 1);
  controller.run(); scheduler.drain();
  assert.equal(view().status, "breakpoint-paused");
  assert.equal(view().cpu.attemptedInstructions, 1);
});

test("disabled and non-executable breakpoints do not interrupt Run", () => {
  const { controller, scheduler, view } = setup("; comment\nldc 3\nHALT\ndata 18");
  controller.toggleBreakpoint(1); controller.toggleBreakpoint(2); controller.toggleBreakpoint(4);
  controller.setBreakpointEnabled("line-2", false);
  controller.run(); scheduler.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 2);
});

test("Reset preserves breakpoint definitions/enabled flags and clears all history", () => {
  const { controller, scheduler, view } = setup(reference);
  controller.toggleBreakpoint(2); controller.toggleBreakpoint(3); controller.setBreakpointEnabled("line-3", false);
  controller.run(); scheduler.drain();
  controller.selectTrace(1); controller.navigateToTrace(1);
  const breakpoints = structuredClone(view().breakpoints);
  controller.reset();
  assert.deepEqual(view().breakpoints, breakpoints);
  assert.deepEqual(view().trace, []);
  assert.equal(view().traceDiscarded, 0);
  assert.equal(view().selectedTrace, undefined);
  assert.equal(view().navigation, undefined);
  assert.equal(view().breakpointPause, undefined);
  assert.equal(view().cpu.attemptedInstructions, 0);
});

test("source edits/replacements clear addresses/definitions/history and cancel late work", () => {
  const { controller, scheduler, callbacks, pending, view } = setup(reference);
  controller.toggleBreakpoint(2); controller.step(); controller.run();
  const stale = callbacks.at(-1);
  controller.setSource("HALT"); stale();
  assert.deepEqual(view().breakpoints, []);
  assert.deepEqual(view().trace, []);
  assert.equal(view().cpu, null);
  assert.equal(pending.size, 0);
  controller.assemble(); controller.toggleBreakpoint(1);
  controller.setSource("HALT", true);
  assert.deepEqual(view().breakpoints, []);
  controller.assemble(); controller.run(); scheduler.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().trace.length, 1);
});

test("same-source reassembly re-resolves breakpoints and clears trace, different source clears definitions", () => {
  const { controller, view } = setup(reference);
  controller.toggleBreakpoint(2); controller.step();
  controller.assemble();
  assert.equal(view().breakpoints[0].address, 1);
  assert.deepEqual(view().trace, []);
  controller.assemble("HALT");
  assert.deepEqual(view().breakpoints, []);
});

test("self-modified words still stop at original breakpoint addresses, without false source trace links", () => {
  const source = "ldc 18\nldc next\nstnl 0\nnext: br -1";
  const { controller, scheduler, view } = setup(source);
  controller.toggleBreakpoint(4); controller.run(); scheduler.drain();
  assert.equal(view().status, "breakpoint-paused");
  assert.equal(view().cpu.attemptedInstructions, 3);
  assert.equal(view().breakpointPause.modified, true);
  assert.equal(view().breakpoints[0].modified, true);
  controller.run(); scheduler.drain();
  const entry = view().trace.at(-1);
  assert.equal(entry.word, 18);
  assert.equal(entry.instruction, "HALT");
  assert.equal(entry.modified, true);
  assert.equal(entry.source, undefined);
  assert.equal(entry.status, "halted");
  controller.reset();
  assert.equal(view().breakpoints[0].modified, false);
});

test("trace captures actual fetched words, decoded operands, before/after registers and HALT", () => {
  const { controller, scheduler, view } = setup(reference);
  controller.run(); scheduler.drain();
  assert.deepEqual(view().trace.map(({ step, word, instruction, status }) => [step, word, instruction, status]), [[1, 2560, "ldc 10", "paused"], [2, 1281, "adc 5", "paused"], [3, 18, "HALT", "halted"]]);
  assert.deepEqual(view().trace[0].before, { A: 0, B: 0, PC: 0, SP: 65536 });
  assert.deepEqual(view().trace[0].after, { A: 10, B: 0, PC: 1, SP: 65536 });
  assert.equal(view().trace[0].decoded.operand, 10);
  assert.equal(view().trace[0].source.start.line, 1);
  assert.deepEqual(view().trace[2].before, view().trace[2].after);
});

test("store traces contain only the actual committed memory delta", () => {
  const { controller, scheduler, view } = setup("adj -1\nldc 42\nstl 0\nldl 0\nadj 1\nHALT");
  controller.run(); scheduler.drain();
  const writes = view().trace.filter(({ memoryWrite }) => memoryWrite);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].memoryWrite, { address: 65535, before: 0, after: 42 });
  assert.equal(writes[0].before.A, 42);
  assert.equal(writes[0].after.A, 0);
  assert.equal("memory" in writes[0], false);
  assert.equal("snapshot" in writes[0], false);
});

test("faulting attempts record atomic unchanged state and no invented memory write", () => {
  for (const source of ["data -1", "data 262", "ldc 65536\nstnl 0"]) {
    const { controller, scheduler, view } = setup(source);
    controller.run(); scheduler.drain();
    const entry = view().trace.at(-1);
    assert.equal(entry.status, "error");
    assert.ok(entry.diagnostic.code.startsWith("C00"));
    assert.deepEqual(entry.before, entry.after);
    assert.equal(entry.memoryWrite, undefined);
    assert.equal(entry.step, view().cpu.attemptedInstructions);
  }
});

test("CPU traced API shares fault/HALT/limit precedence, with no entry for budget checks or terminal calls", () => {
  for (const [source, status] of [["HALT", "halted"], ["data -1", "error"], ["ldc 7", "limit-reached"]]) {
    const cpu = cpuFor(source, 1);
    const result = stepCpuTraced(cpu);
    assert.equal(result.execution.status, status);
    assert.equal(result.entry.status, status);
    assert.equal(result.entry.step, 1);
    assert.equal(stepCpuTraced(cpu).entry, undefined);
  }
  const cpu = cpuFor("br -1", 10);
  stepCpu(cpu); assert.equal(setExecutionLimit(cpu, 1).ok, true);
  const exhausted = stepCpuTraced(cpu);
  assert.equal(exhausted.execution.status, "limit-reached");
  assert.equal(exhausted.execution.attempts, 0);
  assert.equal(exhausted.entry, undefined);
  assert.equal(stepCpuTraced(createCpu()).entry, undefined);
});

test("tracing a self-write preserves the fetched old instruction word and the exact delta", () => {
  const cpu = cpuFor("ldc 18\nldc store\nstore: stnl 0\nHALT");
  stepCpuTraced(cpu); stepCpuTraced(cpu);
  const { entry } = stepCpuTraced(cpu);
  assert.equal(entry.word, 5);
  assert.equal(entry.modified, false);
  assert.deepEqual(entry.memoryWrite, { address: 2, before: 5, after: 18 });
  assert.equal(entry.source.start.line, 3);
});

test("bounded trace retains exactly the last 500 attempts and reports discarded history", () => {
  const { controller, scheduler, view } = setup("br -1");
  controller.setSpeed("fast"); controller.run(); scheduler.tick(); controller.pause();
  assert.equal(view().cpu.attemptedInstructions, 512);
  assert.equal(view().trace.length, TRACE_CAPACITY);
  assert.equal(view().traceDiscarded, 12);
  assert.equal(view().trace[0].step, 13);
  assert.equal(view().trace.at(-1).step, 512);
  controller.selectTrace(13);
  controller.run(); scheduler.tick(); controller.pause();
  assert.equal(view().trace.length, 500);
  assert.equal(view().traceDiscarded, 524);
  assert.equal(view().trace[0].step, 525);
  assert.equal(view().selectedTrace, undefined);
  controller.clearTrace();
  assert.deepEqual(view().trace, []);
  assert.equal(view().traceDiscarded, 0);
  assert.equal(view().cpu.attemptedInstructions, 1024);
  controller.step(); assert.equal(view().trace[0].step, 1025);
});

test("infinite-loop limit trace is bounded, accurate and includes the final committed attempt", () => {
  const { controller, scheduler, view } = setup("br -1");
  controller.setSpeed("fast"); controller.run(); scheduler.drain();
  assert.equal(view().status, "limit-reached");
  assert.equal(view().trace.length, 500);
  assert.equal(view().traceDiscarded, 99500);
  assert.equal(view().trace[0].step, 99501);
  assert.equal(view().trace.at(-1).step, 100000);
  assert.equal(view().trace.at(-1).status, "limit-reached");
});

test("trace selection/navigation is detached inspection, never a CPU state transition", () => {
  const { controller, scheduler, view } = setup(reference);
  controller.run(); scheduler.drain();
  const before = structuredClone(view().cpu);
  const memory = structuredClone(view().memory);
  controller.selectTrace(1); controller.navigateToTrace(1);
  assert.equal(view().selectedTrace.step, 1);
  assert.equal(view().navigation.line, 1);
  const request = view().navigation.request;
  controller.navigateToTrace(1);
  assert.ok(view().navigation.request > request);
  assert.deepEqual(view().cpu, before);
  assert.deepEqual(view().memory.map(({ value }) => value), memory.map(({ value }) => value));
  view().trace[0].before.A = 999;
  view().trace[0].source.start.line = 900;
  controller.selectTrace(1);
  assert.equal(view().selectedTrace.before.A, 0);
  assert.equal(view().selectedTrace.source.start.line, 1);
  controller.clearTrace(); controller.navigateToTrace(1);
  assert.equal(view().navigation, undefined);
});

test("breakpoint source navigation works without assembly and after disabled definitions", () => {
  const { controller, view } = setup("");
  controller.setSource("; heading\nHALT"); controller.toggleBreakpoint(2);
  controller.setBreakpointEnabled("line-2", false); controller.navigateToBreakpoint("line-2");
  assert.equal(view().navigation.line, 2);
  assert.equal(view().navigation.column, 1);
  assert.equal(view().cpu, null);
});

test("fallback source offsets handle CRLF/CR/LF, BOM, UTF-16 columns and invalid lines", () => {
  assert.equal(sourceOffset("\uFEFFA\r\nB\rC\nD", 1, 1), 1);
  assert.equal(sourceOffset("\uFEFFA\r\nB\rC\nD", 2, 1), 4);
  assert.equal(sourceOffset("\uFEFFA\r\nB\rC\nD", 3, 1), 6);
  assert.equal(sourceOffset("x\n😀z", 2, 3), 4);
  assert.equal(sourceOffset("abc", 1, 999), 3);
  for (const line of [0, -1, 2, 1.5, NaN]) assert.equal(sourceOffset("x", line, 1), null);
});

test("Pause/Resume before its first resumed callback retains the one-attempt breakpoint bypass", () => {
  const { controller, scheduler, callbacks, pending, view } = setup(reference);
  controller.toggleBreakpoint(1); controller.run(); scheduler.drain();
  controller.run(); const stale = callbacks.at(-1); controller.pause(); stale();
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(pending.size, 0);
  controller.run(); scheduler.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 3);
});

test("rapid debugger actions use one timer and stale callbacks cannot append traces", () => {
  const { controller, scheduler, callbacks, pending, view } = setup(reference);
  controller.toggleBreakpoint(2); controller.run(); controller.run();
  assert.equal(pending.size, 1);
  scheduler.tick();
  assert.equal(view().trace.length, 1);
  controller.run(); controller.run();
  const stale = callbacks.at(-1);
  controller.reset(); stale();
  assert.equal(view().trace.length, 0);
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(pending.size, 0);
  controller.run(); controller.dispose(); callbacks.at(-1)();
  assert.equal(view().trace.length, 0);
});

test("React subscribers publish per bounded batch, never once per instruction", () => {
  const { controller, scheduler, view } = setup("br -1");
  controller.setSpeed("fast");
  let updates = 0;
  controller.subscribe(() => updates++);
  controller.run(); assert.equal(updates, 1);
  scheduler.tick();
  assert.equal(view().cpu.attemptedInstructions, 512);
  assert.equal(updates, 2);
  controller.pause();
});

for (const source of [reference, countdown, "adj -1\nldc 42\nstl 0\nldl 0\nadj 1\nHALT", "ldc 7\ncall fn\nHALT\nfn: return", "ldc 65536\nldnl 0", "ldc 18\nldc next\nstnl 0\nnext: data -1"]) {
  test(`debugger preserves full CPU results for ${source.split("\n")[0]}`, () => {
    const plain = cpuFor(source);
    runCpuBatch(plain, 100);
    const traced = cpuFor(source);
    while (["ready", "paused"].includes(getCpuSnapshot(traced).status)) stepCpuTraced(traced);
    assert.deepEqual(getCpuSnapshot(traced), getCpuSnapshot(plain));
    const unbroken = setup(source); unbroken.controller.run(); unbroken.scheduler.drain();
    const stepped = setup(source);
    while (["ready", "paused"].includes(stepped.view().status)) stepped.controller.step();
    const broken = setup(source);
    broken.controller.toggleBreakpoint(1);
    broken.controller.toggleBreakpoint(source.split("\n").length);
    for (let count = 0; count < 30 && !["halted", "error", "limit-reached"].includes(broken.view().status); count++) { broken.controller.run(); broken.scheduler.drain(); }
    assert.deepEqual(broken.view().cpu, unbroken.view().cpu);
    assert.deepEqual(stepped.view().cpu, unbroken.view().cpu);
    for (const start of [0, 65504]) {
      broken.controller.setMemoryStart(start); stepped.controller.setMemoryStart(start); unbroken.controller.setMemoryStart(start);
      assert.deepEqual(broken.view().memory.map(({ value }) => value), unbroken.view().memory.map(({ value }) => value));
      assert.deepEqual(stepped.view().memory.map(({ value }) => value), unbroken.view().memory.map(({ value }) => value));
    }
    assert.deepEqual(broken.view().trace, unbroken.view().trace);
    assert.deepEqual(stepped.view().trace, unbroken.view().trace);
    resetCpu(traced); assert.equal(getCpuSnapshot(traced).attemptedInstructions, 0);
  });
}
