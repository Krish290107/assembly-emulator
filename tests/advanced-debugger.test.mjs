import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { isValidElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createWorkspaceController } from "../src/lib/workspace/controller.ts";
import { filterTrace, TRACE_FILTERS } from "../src/lib/workspace/debugger.ts";

// Only scheduling/event delivery is simulated; every instruction uses the real CPU.
function setup(source = "ldc 10\nadc 5\nHALT") {
  let id = 0;
  const pending = new Map();
  const callbacks = [];
  const clock = {
    schedule(callback) { pending.set(++id, callback); callbacks.push(callback); return id; },
    cancel(handle) { pending.delete(handle); },
    tick() { const next = pending.entries().next().value; assert.ok(next); pending.delete(next[0]); next[1](); },
    drain() { let ticks = 0; while (pending.size && ticks++ < 2000) this.tick(); assert.equal(pending.size, 0); },
  };
  const controller = createWorkspaceController(clock);
  controller.setSource(source); controller.assemble();
  return { controller, clock, pending, callbacks, view: () => controller.getSnapshot() };
}
const live = (view) => structuredClone({ cpu: view().cpu, memory: view().memory.map(({ value }) => value) });
const countdown = "ldc 3\nloop: brz done\nadc -1\nbr loop\ndone: HALT";

test("Run to Cursor stops before the target without a fabricated attempt or permanent breakpoint", () => {
  const { controller, clock, view } = setup();
  assert.equal(controller.runToCursor(3), true);
  clock.drain();
  assert.equal(view().status, "cursor-paused");
  assert.deepEqual(view().cpu.registers, { A: 15, B: 0, PC: 2, SP: 65536 });
  assert.equal(view().cpu.attemptedInstructions, 2);
  assert.deepEqual(view().trace.map(({ address }) => address), [0, 1]);
  assert.deepEqual(view().cursorPause, { sourceLine: 3, address: 2, modified: false });
  assert.equal(view().cursorTarget, undefined);
  assert.deepEqual(view().breakpoints, []);
  controller.run(); clock.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 3);
});

test("a cursor target at the current PC stops immediately with no timer, fetch or state change", () => {
  const { controller, view, pending } = setup("HALT");
  const before = live(view);
  assert.equal(controller.runToCursor(1), true);
  assert.equal(pending.size, 0);
  assert.equal(view().trace.length, 0);
  assert.deepEqual(live(view), before);
  controller.step();
  assert.equal(view().status, "halted");
  assert.equal(view().trace[0].step, 1);
});

test("cursor resolution rejects invalid, data, label-only, comment and blank lines without changing the CPU", () => {
  const { controller, view, pending } = setup("\uFEFF; comment\r\nlabel:\r\nstart: ldc value\r\nHALT\r\nvalue: data 99\r\n");
  const before = live(view);
  for (const line of [0, -1, 1, 2, 5, 6, 900, 1.5, NaN, Infinity, "3"]) {
    assert.equal(controller.runToCursor(line), false);
    assert.match(view().debuggerNotice, /line containing a CPU instruction/);
    assert.deepEqual(live(view), before);
    assert.equal(pending.size, 0);
  }
  assert.equal(controller.runToCursor(3), true);
  assert.equal(view().cursorPause.address, 0);
  assert.equal(view().cursorPause.sourceLine, 3);
  assert.equal(view().debuggerNotice, undefined);
});

test("Run to Cursor requires a current assembled runnable session", () => {
  const { controller, view, pending } = setup();
  controller.setSource("HALT");
  assert.equal(controller.runToCursor(1), false);
  assert.equal(view().cpu, null);
  controller.assemble(); controller.step();
  const before = live(view);
  assert.equal(controller.runToCursor(1), false);
  assert.equal(view().status, "halted");
  assert.deepEqual(live(view), before);
  assert.equal(pending.size, 0);
});

test("a cursor target behind the current PC is reached through an actual backward branch", () => {
  const { controller, clock, view } = setup("ldc 2\nloop: adc -1\nbrz done\nbr loop\ndone: HALT");
  controller.step(); controller.step(); controller.step();
  assert.equal(view().cpu.registers.PC, 3);
  controller.runToCursor(2); clock.drain();
  assert.equal(view().status, "cursor-paused");
  assert.equal(view().cpu.registers.PC, 1);
  assert.equal(view().cpu.registers.A, 1);
  assert.equal(view().cpu.attemptedInstructions, 4);
  assert.deepEqual(view().trace.map(({ address }) => address), [0, 1, 2, 3]);
});

for (const [source, target, path] of [
  ["br target\nldc 99\ntarget: adc 5\nHALT", 3, [0]],
  ["ldc 7\ncall fn\nHALT\nfn: return", 3, [0, 1, 3]],
]) {
  test(`cursor target ${target} follows actual branches/call/return from ${source.split("\n")[0]}`, () => {
    const { controller, clock, view } = setup(source);
    controller.runToCursor(target); clock.drain();
    assert.equal(view().status, "cursor-paused");
    assert.deepEqual(view().trace.map(({ address }) => address), path);
    assert.equal(view().cpu.attemptedInstructions, path.length);
    assert.equal(view().cpu.registers.PC, 2);
  });
}

test("earlier permanent breakpoints stop first, then Resume continues to the pending cursor target", () => {
  const { controller, clock, view } = setup();
  controller.toggleBreakpoint(2);
  const definitions = structuredClone(view().breakpoints);
  controller.runToCursor(3); clock.drain();
  assert.equal(view().status, "breakpoint-paused");
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.equal(view().cursorTarget.address, 2);
  controller.run(); clock.drain();
  assert.equal(view().status, "cursor-paused");
  assert.equal(view().cpu.attemptedInstructions, 2);
  assert.deepEqual(view().breakpoints, definitions);
  controller.run(); clock.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 3);
});

test("a shared cursor/breakpoint address stops once and Resume bypasses it once on later looping visits", () => {
  const { controller, clock, view } = setup("br -1\nHALT");
  controller.toggleBreakpoint(1);
  controller.runToCursor(1);
  assert.equal(view().status, "cursor-paused");
  for (const attempts of [1, 2, 3]) {
    controller.run(); clock.drain();
    assert.equal(view().status, "breakpoint-paused");
    assert.equal(view().cpu.attemptedInstructions, attempts);
    assert.equal(view().trace.length, attempts);
    assert.equal(view().cursorTarget, undefined);
  }
});

test("repeated loop breakpoint resumes retain the cursor goal with exact cumulative attempts", () => {
  const { controller, clock, view } = setup(countdown);
  controller.toggleBreakpoint(2);
  controller.runToCursor(5); clock.drain();
  for (const attempts of [1, 4, 7, 10]) {
    assert.equal(view().status, "breakpoint-paused");
    assert.equal(view().cpu.attemptedInstructions, attempts);
    assert.equal(view().cursorTarget.address, 4);
    controller.run(); clock.drain();
  }
  assert.equal(view().status, "cursor-paused");
  assert.equal(view().cpu.attemptedInstructions, 11);
  controller.run(); clock.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 12);
  assert.deepEqual(view().trace.map(({ step }) => step), Array.from({ length: 12 }, (_, index) => index + 1));
});

test("Run to Cursor from a stopped breakpoint bypasses the current address only once", () => {
  const { controller, clock, view } = setup(countdown);
  controller.toggleBreakpoint(2); controller.run(); clock.drain();
  assert.equal(view().cpu.attemptedInstructions, 1);
  controller.runToCursor(5); clock.drain();
  assert.equal(view().status, "breakpoint-paused");
  assert.equal(view().cpu.attemptedInstructions, 4);
  assert.equal(view().cursorTarget.address, 4);
});

test("Step from an intervening breakpoint cancels the temporary goal and attempts exactly one instruction", () => {
  const { controller, clock, view } = setup();
  controller.toggleBreakpoint(2); controller.runToCursor(3); clock.drain();
  controller.step();
  assert.equal(view().cpu.attemptedInstructions, 2);
  assert.equal(view().cursorTarget, undefined);
  assert.equal(view().breakpointPause, undefined);
  assert.equal(view().status, "paused");
  controller.run(); clock.drain();
  assert.equal(view().status, "halted");
});

test("Pause cancels a pending cursor goal even while stopped at an intervening breakpoint", () => {
  const { controller, clock, view } = setup();
  controller.toggleBreakpoint(2); controller.runToCursor(3); clock.drain();
  const before = live(view);
  controller.pause();
  assert.equal(view().cursorTarget, undefined);
  assert.deepEqual(live(view), before);
  controller.run(); clock.drain();
  assert.equal(view().status, "halted");
});

for (const action of ["pause", "reset", "edit", "replace", "assemble", "failed assembly", "dispose"]) {
  test(`${action} cancels Run to Cursor and late work cannot restore its target or append attempts`, () => {
    const { controller, clock, callbacks, pending, view } = setup();
    controller.setSpeed("slow"); controller.runToCursor(3); clock.tick();
    const stale = callbacks.at(-1);
    assert.equal(view().cpu.attemptedInstructions, 1);
    if (action === "edit") controller.setSource("HALT");
    else if (action === "replace") controller.setSource("ldc 10\nadc 5\nHALT", true);
    else if (action === "failed assembly") controller.assemble("ldc missing");
    else controller[action]();
    const before = structuredClone(view());
    stale();
    assert.deepEqual(view(), before);
    assert.equal(view().cursorTarget, undefined);
    assert.equal(pending.size, 0);
  });
}

test("speed changes reschedule one cursor session and preserve the temporary target", () => {
  const { controller, clock, callbacks, pending, view } = setup();
  controller.runToCursor(3);
  const stale = callbacks.at(-1);
  controller.setSpeed("slow"); stale();
  assert.equal(pending.size, 1);
  assert.equal(view().cpu.attemptedInstructions, 0);
  clock.tick();
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.equal(view().cursorTarget.address, 2);
  controller.setSpeed("fast");
  clock.tick();
  assert.equal(view().status, "cursor-paused");
  assert.equal(view().cpu.attemptedInstructions, 2);
  assert.equal(pending.size, 0);
});

test("rapid cursor/Run/Pause/Step/Reset actions never duplicate sessions or attempts", () => {
  const { controller, clock, callbacks, pending, view } = setup();
  controller.runToCursor(3); controller.run(); controller.step();
  assert.equal(controller.runToCursor(2), false);
  assert.equal(view().cursorTarget.address, 2);
  assert.equal(pending.size, 1);
  clock.drain();
  assert.equal(view().status, "cursor-paused");
  assert.equal(view().debuggerNotice, undefined);
  controller.reset(); controller.runToCursor(3);
  controller.pause(); controller.runToCursor(2); controller.reset();
  callbacks.forEach((callback) => callback());
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(pending.size, 0);
  controller.runToCursor(2); clock.drain();
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.deepEqual(view().trace.map(({ step }) => step), [1]);
});

test("disposed execution actions cannot restart timers or notify, while a new subscription revives Strict Mode safely", () => {
  const { controller, clock, pending, callbacks, view } = setup();
  let publications = 0;
  controller.subscribe(() => publications++);
  controller.runToCursor(3); controller.dispose();
  const count = publications;
  const before = live(view);
  controller.run(); controller.step();
  assert.equal(controller.runToCursor(3), false);
  callbacks.forEach((callback) => callback());
  assert.equal(pending.size, 0);
  assert.equal(publications, count);
  assert.deepEqual(live(view), before);
  const unsubscribe = controller.subscribe(() => publications++);
  controller.runToCursor(3); clock.drain();
  assert.equal(view().status, "cursor-paused");
  assert.equal(view().cpu.attemptedInstructions, 2);
  assert.ok(publications > count);
  unsubscribe(); controller.dispose();
});

for (const [source, line, status, attempts] of [
  ["HALT\nadc 1", 2, "halted", 1],
  ["ldc 65536\nldnl 0\nHALT", 3, "error", 2],
  ["br -1\nHALT", 2, "limit-reached", 100000],
]) {
  test(`${status} before the cursor target clears it and retains real terminal trace/attempt semantics`, () => {
    const { controller, clock, view } = setup(source);
    controller.setSpeed("fast"); controller.runToCursor(line); clock.drain();
    assert.equal(view().status, status);
    assert.equal(view().cpu.attemptedInstructions, attempts);
    assert.equal(view().cursorTarget, undefined);
    assert.equal(view().cursorPause, undefined);
    assert.equal(view().trace.at(-1).status, status);
    assert.equal(view().trace.at(-1).step, attempts);
    assert.equal(filterTrace(view().trace, "terminal").length, 1);
    assert.ok(view().trace.length <= 500);
    const before = live(view);
    controller.run(); controller.step();
    assert.equal(controller.runToCursor(1), false);
    assert.deepEqual(live(view), before);
  });
}

test("the final permitted instruction's limit result takes precedence over reaching the cursor PC", () => {
  const { controller, clock, view } = setup("ldc 33333\nadc 0\nloop: adc -1\nbrz target\nbr loop\ntarget: HALT");
  controller.setSpeed("fast"); controller.runToCursor(6); clock.drain();
  assert.equal(view().cpu.registers.PC, 5);
  assert.equal(view().cpu.attemptedInstructions, 100000);
  assert.equal(view().status, "limit-reached");
  assert.equal(view().cursorPause, undefined);
  assert.equal(view().trace.at(-1).decoded.mnemonic, "brz");
  assert.equal(view().trace.at(-1).status, "limit-reached");
  assert.equal(view().traceDiscarded, 99500);
});

test("self-modified cursor targets stop at their original address before fetching the modified bits", () => {
  const { controller, clock, view } = setup("ldc 18\nldc next\nstnl 0\nnext: br -1");
  controller.runToCursor(4); clock.drain();
  assert.equal(view().status, "cursor-paused");
  assert.equal(view().cursorPause.modified, true);
  assert.equal(view().currentSource, undefined);
  assert.equal(view().cpu.attemptedInstructions, 3);
  controller.run(); clock.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().trace.at(-1).modified, true);
  assert.equal(view().trace.at(-1).source, undefined);
});

test("label aliases and repeated toggles cannot create duplicate executable breakpoint addresses", () => {
  const { controller, clock, view } = setup("first:\nsecond:\ncode: HALT");
  [1, 2, 3].forEach((line) => controller.toggleBreakpoint(line));
  assert.deepEqual(view().breakpoints.filter(({ address }) => address !== undefined).map(({ address }) => address), [0]);
  assert.equal(controller.runToCursor(1), false);
  controller.run(); clock.drain();
  assert.equal(view().cpu.attemptedInstructions, 0);
  controller.run(); clock.drain();
  assert.equal(view().cpu.attemptedInstructions, 1);
  controller.reset();
  assert.equal(view().breakpoints.length, 3);
});

test("filters classify real committed writes, decoded control flow, and terminal attempts without mutation", () => {
  assert.deepEqual(TRACE_FILTERS.map(({ value }) => value), ["all", "writes", "control", "terminal"]);
  const programs = [
    ["adj -1\nldc 42\nstl 0\nldl 0\nadj 1\nHALT", [3], [6], [6]],
    ["ldc 0\nldc 30\nstnl 0\nHALT", [3], [4], [4]],
    ["ldc 0\nbrz taken\nadc 99\ntaken: ldc -1\nbrlz callsite\nadc 88\ncallsite: call fn\nbr done\nfn: return\ndone: HALT", [], [2, 4, 5, 6, 7, 8], [8]],
    ["ldc 1\nbrz last\nbrlz last\nlast: HALT", [], [2, 3, 4], [4]],
    ["ldc 65536\nstnl 0\nHALT", [], [], [2]],
    ["data 255", [], [], [1]],
    ["br 65535", [], [1], [1]],
  ];
  for (const [source, writes, control, terminal] of programs) {
    const { controller, clock, view } = setup(source);
    controller.run(); clock.drain();
    const before = structuredClone(view());
    for (const [filter, expected] of [["writes", writes], ["control", control], ["terminal", terminal]]) {
      const rows = filterTrace(view().trace, filter);
      assert.deepEqual(rows.map(({ step }) => step), expected, source);
      assert.ok(rows.every((entry) => view().trace.includes(entry)));
    }
    assert.equal(filterTrace(view().trace, "all"), view().trace);
    assert.deepEqual(view(), before);
  }
});

test("filters retain selected historical details even when that row is not among the matches", () => {
  const { controller, clock, view } = setup("adj -1\nldc 42\nstl 0\nHALT");
  controller.run(); clock.drain(); controller.selectTrace(3);
  const before = live(view);
  assert.deepEqual(filterTrace(view().trace, "control").map(({ step }) => step), [4]);
  assert.equal(view().selectedTrace.step, 3);
  assert.equal(view().selectedTrace.memoryWrite.after, 42);
  assert.deepEqual(live(view), before);
  assert.deepEqual(filterTrace([], "writes"), []);
});

test("eviction removes selection/details while filtering retains the last 500 original attempt IDs", () => {
  const { controller, clock, view } = setup("br -1");
  controller.setSpeed("fast"); controller.run(); clock.tick();
  controller.selectTrace(13);
  assert.equal(view().selectedTrace.step, 13);
  clock.tick(); controller.pause();
  assert.equal(view().selectedTrace, undefined);
  assert.equal(view().trace.length, 500);
  assert.equal(view().traceDiscarded, 524);
  assert.equal(filterTrace(view().trace, "control")[0].step, 525);
  assert.equal(view().cpu.attemptedInstructions, 1024);
  const before = live(view);
  controller.selectTrace(13); controller.navigateToTrace(13);
  assert.equal(view().selectedTrace, undefined);
  assert.deepEqual(live(view), before);
});

// Render and exercise the actual existing TSX navigation controls using only
// installed React/TypeScript, preserving the Day 9 row/button regression suite.
const require = createRequire(import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(new URL("../src/components/panels/trace-table.tsx", import.meta.url), "utf8"), {
  fileName: "trace-table.tsx", compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});
const compiled = outputText.replace(/from (["'])([^"']+)\1/g, (_match, _quote, specifier) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
const { TraceNavigation } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
function buttons(tree) {
  if (Array.isArray(tree)) return tree.flatMap(buttons);
  if (!isValidElement(tree)) return [];
  return [...(tree.type === "button" ? [tree] : []), ...buttons(tree.props.children)];
}

test("Previous/Next navigate filtered cumulative IDs with native keyboard-accessible buttons", () => {
  const { controller, clock, view } = setup("adj -1\nldc 42\nstl 0\nHALT");
  controller.run(); clock.drain();
  const before = live(view);
  const controls = (filter) => TraceNavigation({ entries: filterTrace(view().trace, filter), selectedStep: view().selectedTrace?.step, onSelect: controller.selectTrace });
  let [previous, next] = buttons(controls("writes"));
  assert.equal(previous.props.disabled, true);
  assert.equal(next.props.disabled, false);
  assert.equal(next.props.type, "button");
  assert.equal(next.props["aria-label"], "Inspect next matching trace entry");
  next.props.onClick();
  assert.equal(view().selectedTrace.step, 3);
  [, next] = buttons(controls("control")); next.props.onClick();
  assert.equal(view().selectedTrace.step, 4);
  [previous, next] = buttons(controls("writes"));
  assert.equal(next.props.disabled, true);
  previous.props.onClick();
  assert.equal(view().selectedTrace.step, 3);
  assert.ok(buttons(TraceNavigation({ entries: [], onSelect: controller.selectTrace })).every(({ props }) => props.disabled));
  assert.ok(renderToStaticMarkup(createElement(TraceNavigation, { entries: [], onSelect: controller.selectTrace })).includes("Trace entry navigation"));
  assert.deepEqual(live(view), before);
});

for (const [source, target] of [
  ["ldc 10\nadc 5\nHALT", 3], [countdown, 5],
  ["adj -1\nldc 42\nstl 0\nldl 0\nadj 1\nHALT", 6],
  ["ldc 7\ncall fn\nHALT\nfn: return", 3],
  ["ldc 65536\nldnl 0\nHALT", 3],
  ["ldc 18\nldc next\nstnl 0\nnext: br -1", 4],
]) {
  test(`cursor/breakpoint/filter interaction preserves final CPU/trace results: ${source.split("\n")[0]}`, () => {
    const plain = setup(source); plain.controller.run(); plain.clock.drain();
    const debug = setup(source);
    debug.controller.toggleBreakpoint(1);
    debug.controller.runToCursor(target); debug.clock.drain();
    let resumes = 0;
    while (!["halted", "error", "limit-reached"].includes(debug.view().status) && resumes++ < 30) {
      TRACE_FILTERS.forEach(({ value }) => filterTrace(debug.view().trace, value));
      debug.controller.run(); debug.clock.drain();
    }
    assert.ok(resumes < 30);
    assert.deepEqual(debug.view().cpu, plain.view().cpu);
    assert.deepEqual(debug.view().trace, plain.view().trace);
    for (const start of [0, 65504]) {
      debug.controller.setMemoryStart(start); plain.controller.setMemoryStart(start);
      assert.deepEqual(debug.view().memory.map(({ value }) => value), plain.view().memory.map(({ value }) => value));
    }
    assert.equal(debug.pending.size, 0);
  });
}
