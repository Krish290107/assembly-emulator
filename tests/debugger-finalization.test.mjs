import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { handleIdeShortcut } from "../src/lib/editor/shortcuts.ts";
import { handleDebuggerShortcut, DEBUGGER_SHORTCUTS } from "../src/lib/workspace/shortcuts.ts";
import { createWorkspaceController, DEFAULT_SPEED, MEMORY_WINDOW, parseAddress, SPEEDS } from "../src/lib/workspace/controller.ts";
import { filterTrace, runtimeDiagnosticContext, traceDownload } from "../src/lib/workspace/debugger.ts";

// Browser scheduling/key delivery is simulated. Assembler/CPU semantics are real.
function setup(source = "ldc 10\nadc 5\nHALT", assemble = true) {
  let id = 0;
  const pending = new Map();
  const callbacks = [];
  const clock = {
    schedule(callback, delay) { pending.set(++id, callback); callbacks.push({ callback, delay }); return id; },
    cancel(handle) { pending.delete(handle); },
    tick() { const next = pending.entries().next().value; assert.ok(next); pending.delete(next[0]); next[1](); },
    drain() { let ticks = 0; while (pending.size && ticks++ < 2000) this.tick(); assert.equal(pending.size, 0); },
  };
  const controller = createWorkspaceController(clock);
  controller.setSource(source); if (assemble) controller.assemble();
  return { controller, clock, pending, callbacks, view: () => controller.getSnapshot() };
}
function key(controller, key, eventOverrides = {}, contextOverrides = {}) {
  let prevented = 0;
  const calls = { run: 0, step: 0, reset: 0, breakpoint: 0 };
  const event = { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false, preventDefault() { prevented++; }, ...eventOverrides };
  const context = { active: true, dialogOpen: false, unrelatedInput: false, sourceInput: true, sourceLine: 1, ...contextOverrides };
  const handled = handleDebuggerShortcut(event, context, controller.getSnapshot(), {
    run() { calls.run++; controller.run(); }, step() { calls.step++; controller.step(); },
    reset() { calls.reset++; controller.reset(); }, breakpoint(line) { calls.breakpoint++; controller.toggleBreakpoint(line); },
  });
  return { handled, prevented, calls, event };
}
const live = (view) => structuredClone({ cpu: view().cpu, memory: view().memory.map(({ value }) => value) });
async function exported(view) { return JSON.parse(await traceDownload(view()).blob.text()); }

test("F5/F10/Shift+F5 invoke real Run/Step/Reset and respect terminal state", () => {
  assert.deepEqual(DEBUGGER_SHORTCUTS, { run: "F5", step: "F10", reset: "Shift+F5", breakpoint: "F9" });
  const { controller, clock, view } = setup();
  assert.equal(key(controller, "F10").calls.step, 1);
  assert.equal(view().cpu.registers.A, 10);
  assert.equal(view().cpu.attemptedInstructions, 1);
  assert.equal(key(controller, "F5").calls.run, 1); clock.drain();
  assert.equal(view().status, "halted");
  assert.equal(view().cpu.attemptedInstructions, 3);
  const before = live(view);
  for (const command of ["F5", "F10"]) {
    const result = key(controller, command);
    assert.equal(result.handled, true); assert.equal(result.prevented, 1);
    assert.equal(Object.values(result.calls).reduce((sum, value) => sum + value, 0), 0);
  }
  assert.deepEqual(live(view), before);
  assert.equal(key(controller, "F5", { shiftKey: true }).calls.reset, 1);
  assert.equal(view().cpu.attemptedInstructions, 0);
  assert.equal(view().trace.length, 0);
  assert.equal(view().speed, DEFAULT_SPEED);
});

test("held debugger keys are consumed once without repeat commands or duplicate timers", () => {
  const { controller, clock, view, pending } = setup();
  key(controller, "F9");
  assert.equal(view().breakpoints.length, 1);
  for (const command of ["F9", "F10", "F5"]) {
    const result = key(controller, command, { repeat: true });
    assert.equal(result.handled, true); assert.equal(result.prevented, 1);
    assert.ok(Object.values(result.calls).every((value) => value === 0));
  }
  assert.equal(view().breakpoints.length, 1);
  assert.equal(view().cpu.attemptedInstructions, 0);
  key(controller, "F9"); key(controller, "F5");
  key(controller, "F5", { repeat: true }); key(controller, "F5");
  assert.equal(pending.size, 1);
  clock.drain(); assert.equal(view().cpu.attemptedInstructions, 3);
  key(controller, "F5", { shiftKey: true });
  const snapshot = view();
  key(controller, "F5", { shiftKey: true, repeat: true });
  assert.equal(view(), snapshot);
});

test("debugger shortcuts leave dialogs, unrelated inputs, inactive IDEs and modifier/browser shortcuts untouched", () => {
  const { controller, pending, view } = setup();
  const before = live(view);
  for (const context of [{ active: false }, { dialogOpen: true }, { unrelatedInput: true }]) {
    for (const command of ["F5", "F10", "F9"]) {
      const result = key(controller, command, {}, context);
      assert.equal(result.handled, false); assert.equal(result.prevented, 0);
    }
  }
  for (const event of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { defaultPrevented: true }]) {
    const result = key(controller, "F5", event);
    assert.equal(result.handled, false); assert.equal(result.prevented, 0);
  }
  for (const command of ["F9", "F10"]) assert.equal(key(controller, command, { shiftKey: true }).handled, false);
  assert.equal(key(controller, "F9", {}, { sourceInput: false }).handled, false);
  assert.deepEqual(live(view), before); assert.equal(pending.size, 0);
});

test("Ctrl+S/Ctrl+N remain owned by existing file shortcuts", () => {
  const { controller } = setup();
  for (const command of ["s", "n"]) {
    const result = key(controller, command, { ctrlKey: true });
    assert.equal(result.handled, false);
    let downloads = 0, creates = 0;
    assert.equal(handleIdeShortcut(result.event, { active: true, dialogOpen: false, unrelatedInput: false }, { download() { downloads++; }, create() { creates++; } }), true);
    assert.equal(downloads, command === "s" ? 1 : 0);
    assert.equal(creates, command === "n" ? 1 : 0);
  }
});

test("unassembled controls do nothing while source F9 supports pending definitions and validates lines", () => {
  const { controller, view, pending } = setup("HALT", false);
  for (const [command, event] of [["F5", {}], ["F10", {}], ["F5", { shiftKey: true }]]) {
    const result = key(controller, command, event);
    assert.ok(Object.values(result.calls).every((value) => value === 0));
    assert.equal(result.prevented, 1);
  }
  key(controller, "F9"); assert.equal(view().breakpoints[0].resolution, "pending");
  for (const line of [0, -1, 1.5, NaN]) assert.equal(key(controller, "F9", {}, { sourceLine: line }).calls.breakpoint, 0);
  controller.assemble(); assert.equal(view().breakpoints[0].address, 0);
  assert.equal(pending.size, 0);
});

test("rapid F10 presses attempt exactly once each and never execute after HALT", () => {
  const { controller, pending, view } = setup();
  for (let press = 0; press < 20; press++) key(controller, "F10");
  assert.equal(view().cpu.attemptedInstructions, 3);
  assert.deepEqual(view().trace.map(({ step }) => step), [1, 2, 3]);
  assert.equal(pending.size, 0); assert.equal(view().status, "halted");
});

test("keyboard Step/Resume preserves loop breakpoints and cancels a pending cursor goal", () => {
  const { controller, clock, view } = setup("ldc 2\nloop: brz done\nadc -1\nbr loop\ndone: HALT");
  key(controller, "F9", {}, { sourceLine: 2 });
  controller.runToCursor(5); clock.drain();
  assert.equal(view().status, "breakpoint-paused");
  assert.equal(view().cpu.attemptedInstructions, 1);
  key(controller, "F10");
  assert.equal(view().cpu.attemptedInstructions, 2);
  assert.equal(view().cursorTarget, undefined);
  key(controller, "F5"); clock.drain();
  assert.equal(view().status, "breakpoint-paused");
  assert.equal(view().cpu.attemptedInstructions, 4);
  key(controller, "F5"); clock.drain();
  assert.equal(view().cpu.attemptedInstructions, 7);
  key(controller, "F5"); clock.drain();
  assert.equal(view().status, "halted"); assert.equal(view().cpu.attemptedInstructions, 9);
});

for (const speed of ["slow", "fast"]) {
  test(`Reset during ${speed} execution cancels cursor/late batches and restores Normal speed`, () => {
    const { controller, callbacks, clock, view, pending } = setup();
    controller.toggleBreakpoint(3); controller.setSpeed(speed); controller.runToCursor(3);
    key(controller, "F5", { shiftKey: true });
    callbacks.forEach(({ callback }) => callback());
    assert.equal(view().speed, "normal");
    assert.equal(view().cpu.attemptedInstructions, 0);
    assert.equal(view().cursorTarget, undefined);
    assert.equal(view().breakpoints.length, 1); assert.equal(pending.size, 0);
    key(controller, "F5");
    assert.equal(callbacks.at(-1).delay, SPEEDS.normal.delay);
    clock.drain(); assert.equal(view().cpu.attemptedInstructions, 2);
    assert.equal(view().status, "breakpoint-paused");
  });
}

test("speed changes during execution retain one timer; Pause and source replacement invalidate late work", () => {
  const { controller, callbacks, clock, pending, view } = setup("br -1");
  controller.run();
  for (const speed of ["fast", "slow", "normal", "fast"]) {
    const stale = callbacks.at(-1).callback;
    controller.setSpeed(speed); stale();
    assert.equal(pending.size, 1);
    assert.equal(view().cpu.attemptedInstructions, 0);
  }
  clock.tick(); assert.equal(view().cpu.attemptedInstructions, 512);
  controller.pause(); const before = live(view);
  callbacks.forEach(({ callback }) => callback());
  assert.deepEqual(live(view), before); assert.equal(pending.size, 0);
  controller.setSource("HALT", true); controller.assemble();
  key(controller, "F10"); assert.equal(view().cpu.attemptedInstructions, 1);
  assert.equal(view().trace[0].instruction, "HALT");
});

test("disposed controllers cannot execute from keyboard actions or cancelled callbacks", () => {
  const { controller, callbacks, pending, view } = setup();
  controller.run(); controller.dispose();
  const before = live(view);
  key(controller, "F5"); key(controller, "F10");
  callbacks.forEach(({ callback }) => callback());
  assert.deepEqual(live(view), before); assert.equal(pending.size, 0);
});

test("memory navigation accepts endpoints and rejects malformed addresses without wrapping or CPU changes", () => {
  const { controller, clock, view } = setup("ldc -1\nldc 65535\nstnl 0\nldc -7\nldc 0\nstnl 0\nHALT");
  controller.run(); clock.drain(); const cpu = structuredClone(view().cpu);
  for (const text of ["0", " 0x0 ", "65535", "0xFFFF"]) {
    const address = parseAddress(text); controller.setMemoryStart(address);
    assert.equal(view().memory[0].address, address);
    assert.ok(view().memory.length <= MEMORY_WINDOW);
    assert.equal(view().memory[0].value, address === 0 ? -7 : -1);
    assert.equal(view().memory[0].hex, address === 0 ? "FFFFFFF9" : "FFFFFFFF");
  }
  for (const address of [-1, 65536, NaN, Infinity, 1.5]) controller.setMemoryStart(address);
  assert.equal(view().memoryStart, 65535); assert.equal(view().memory.length, 1);
  for (const text of ["-1", "65536", "0x10000", "1e2", "1.5", "", "NaN", "0x"]) assert.equal(parseAddress(text), null);
  assert.deepEqual(view().cpu, cpu); assert.equal(view().cpu.memory, undefined);
});

test("trace JSON exports actual instructions/registers/IDs with a safe filename and explicit retention metadata", async () => {
  const { controller, clock, view } = setup(); controller.run(); clock.drain();
  const before = live(view);
  const download = traceDownload(view());
  assert.equal(download.filename, "assembly-emulator-trace.json");
  assert.equal(download.blob.type, "application/json;charset=utf-8");
  const json = JSON.parse(await download.blob.text());
  assert.equal(json.format, "assembly-emulator-trace"); assert.equal(json.version, 1);
  assert.equal(json.attemptedInstructions, 3);
  assert.deepEqual(json.entries.map(({ attempt, pc }) => [attempt, pc]), [[1, 0], [2, 1], [3, 2]]);
  assert.deepEqual(json.entries[0].instruction, { mnemonic: "ldc", opcode: 0, operand: 10 });
  assert.equal(json.entries[0].word, 2560);
  assert.equal(json.entries[0].before.A, 0); assert.equal(json.entries[0].after.A, 10);
  assert.equal(json.entries[1].after.A, 15); assert.equal(json.entries[2].result, "halted");
  assert.equal(json.retention.capacity, 500); assert.equal(json.retention.retained, 3);
  assert.match(json.retention.limitation, /Discarded or cleared history is unavailable/);
  assert.ok(json.entries.every((entry) => !("memory" in entry) && !("snapshot" in entry)));
  assert.deepEqual(live(view), before);
});

test("trace export includes committed memory deltas and atomic runtime error details", async () => {
  const stored = setup("adj -1\nldc 42\nstl 0\nHALT"); stored.controller.run(); stored.clock.drain();
  const storeJson = await exported(stored.view);
  assert.deepEqual(storeJson.entries[2].memoryWrite, { address: 65535, before: 0, after: 42 });
  const fault = setup("ldc 65536\nldnl 0\nHALT"); fault.controller.run(); fault.clock.drain();
  const json = await exported(fault.view);
  assert.equal(json.entries.length, 2);
  assert.equal(json.entries[1].result, "error"); assert.equal(json.entries[1].memoryWrite, null);
  assert.equal(json.entries[1].error.code, "C005_INVALID_ADDRESS");
  assert.equal(json.entries[1].error.address, 1); assert.equal(json.entries[1].error.target, 65536);
  assert.deepEqual(json.entries[1].before, json.entries[1].after);
  assert.deepEqual(json.entries[1].source, fault.view().trace[1].source);
  assert.match(fault.view().logs.at(-1), /Runtime error/); assert.doesNotMatch(fault.view().logs.at(-1), /Halted|success/i);
});

test("trace export preserves modified fetched words and omits their stale source mapping", async () => {
  const { controller, clock, view } = setup("ldc 18\nldc next\nstnl 0\nnext: br -1"); controller.run(); clock.drain();
  const entry = (await exported(view)).entries.at(-1);
  assert.equal(entry.pc, 3); assert.equal(entry.word, 18);
  assert.equal(entry.instruction.mnemonic, "HALT"); assert.equal(entry.modified, true); assert.equal(entry.source, null);
});

test("export ignores filters/selection, stays detached through reset, and does not alter live state", async () => {
  const { controller, clock, view } = setup(); controller.run(); clock.drain(); controller.selectTrace(1);
  assert.equal(filterTrace(view().trace, "writes").length, 0);
  const before = structuredClone(view());
  const download = traceDownload(view());
  assert.deepEqual(view(), before);
  controller.reset();
  const json = JSON.parse(await download.blob.text());
  assert.equal(json.entries.length, 3); assert.equal(json.entries[0].after.A, 10);
  assert.equal(json.entries[2].after.A, 15); assert.equal(json.entries[2].result, "halted");
  assert.equal(view().cpu.attemptedInstructions, 0);
});

test("bounded exports retain cumulative IDs after eviction and clearing without inventing history", async () => {
  const { controller, clock, view } = setup("br -1"); controller.setSpeed("fast"); controller.run(); clock.tick(); controller.pause();
  const json = await exported(view);
  assert.equal(json.entries.length, 500); assert.equal(json.entries[0].attempt, 13);
  assert.equal(json.entries.at(-1).attempt, 512); assert.equal(json.retention.discardedSinceClear, 12);
  controller.clearTrace();
  const empty = await exported(view); assert.deepEqual(empty.entries, []);
  assert.equal(empty.attemptedInstructions, 512); assert.equal(empty.retention.discardedSinceClear, 0);
  key(controller, "F10"); const next = await exported(view);
  assert.equal(next.entries.length, 1); assert.equal(next.entries[0].attempt, 513);
});

for (const [source, code, pc, fragments] of [
  ["ldc 65536\nldnl 0", "C005_INVALID_ADDRESS", 1, ["ldnl 0", "Memory address 65536"]],
  ["adj 1", "C012_INVALID_SP", 0, ["adj 1", "SP 65537"]],
  ["br 65535", "C014_INVALID_TARGET", 0, ["br 65535", "Target PC 65536"]],
  ["ldc 32\nshl", "C013_INVALID_SHIFT", 1, ["shl", "Shift count 32"]],
  ["data 255", "C002_INVALID_OPCODE", 0, ["word 000000FF", "opcode 255"]],
  ["data 262", "C003_INVALID_ENCODING", 0, ["word 00000106", "opcode 6, operand bits 1"]],
]) {
  test(`runtime context explains ${code} without changing diagnostic codes, spans or atomic fault state`, () => {
    const { controller, clock, view } = setup(source); controller.run(); clock.drain();
    const diagnostic = view().cpu.diagnostics[0]; const before = structuredClone(diagnostic);
    assert.equal(diagnostic.code, code);
    const context = runtimeDiagnosticContext(diagnostic, view().cpu);
    assert.ok(context.includes(`PC ${pc}`)); fragments.forEach((fragment) => assert.ok(context.includes(fragment), context));
    assert.deepEqual(diagnostic, before); assert.equal(view().status, "error");
    assert.deepEqual(view().trace.at(-1).before, view().trace.at(-1).after);
    assert.equal(key(controller, "F5").calls.run, 0); assert.equal(key(controller, "F10").calls.step, 0);
  });
}

test("limit context/export reports the stopped PC and 100000 attempts without inventing another fetched word", async () => {
  const { controller, clock, view } = setup("br -1"); controller.setSpeed("fast"); controller.run(); clock.drain();
  const diagnostic = view().diagnostics.at(-1);
  assert.equal(diagnostic.code, "UI_EXECUTION_LIMIT");
  const context = runtimeDiagnosticContext(diagnostic, view().cpu);
  assert.match(context, /Stopped PC 0.*100000 attempted instructions/); assert.doesNotMatch(context, /word/);
  const json = await exported(view);
  assert.equal(json.entries.length, 500); assert.equal(json.entries.at(-1).attempt, 100000);
  assert.equal(json.entries.at(-1).result, "limit-reached"); assert.equal(json.retention.discardedSinceClear, 99500);
  assert.equal(runtimeDiagnosticContext({ severity: "error", code: "P003_UNKNOWN_MNEMONIC", message: "Unknown" }), "");
});

for (const source of ["ldc 10\nadc 5\nHALT", "adj -1\nldc 42\nstl 0\nldl 0\nadj 1\nHALT", "ldc 7\ncall fn\nHALT\nfn: return", "ldc 65536\nldnl 0", "ldc 18\nldc next\nstnl 0\nnext: br -1"]) {
  test(`Slow/Normal/Fast preserve final registers/memory/attempts/history for ${source.split("\n")[0]}`, async () => {
    const results = [];
    for (const speed of ["slow", "normal", "fast"]) {
      const { controller, clock, view } = setup(source); controller.setSpeed(speed); controller.run(); clock.drain();
      controller.selectTrace(1); const before = live(view); await exported(view); assert.deepEqual(live(view), before);
      controller.setMemoryStart(65504);
      results.push({ before, stack: view().memory.map(({ value }) => value), trace: view().trace });
    }
    assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
  });
}

// Real TSX server rendering uses the project's installed React/TypeScript only.
const require = createRequire(import.meta.url);
function componentModule(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path, compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  const source = outputText.replace(/from (["'])([^"']+)\1/g, (_match, _quote, specifier) => `from ${JSON.stringify(dependencies[specifier] ?? pathToFileURL(require.resolve(specifier)).href)}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const controllerModule = new URL("../src/lib/workspace/controller.ts", import.meta.url).href;
const { MemoryPanel } = await import(componentModule("../src/components/panels/memory-panel.tsx", { "@/lib/workspace/controller": controllerModule }));
const { ExecutionToolbar } = await import(componentModule("../src/components/toolbar/execution-toolbar.tsx", { "@/lib/workspace/shortcuts": new URL("../src/lib/workspace/shortcuts.ts", import.meta.url).href }));
const tableModule = componentModule("../src/components/panels/trace-table.tsx");
const { DebuggerPanel } = await import(componentModule("../src/components/panels/debugger-panel.tsx", { "@/lib/workspace/controller": controllerModule, "@/lib/workspace/debugger": new URL("../src/lib/workspace/debugger.ts", import.meta.url).href, "./trace-table": tableModule }));
function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  if (!isValidElement(tree)) return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}

test("toolbar exposes shortcut labels and actual speed selection without changing execution semantics", () => {
  const { controller, view } = setup();
  const props = { ready: true, view: view(), onAction: (action) => controller[action](), onSpeedChange: controller.setSpeed, onDebugger() {}, onRunToCursor() {} };
  const html = renderToStaticMarkup(createElement(ExecutionToolbar, props));
  for (const shortcut of ["F5", "F10", "Shift+F5"]) assert.ok(html.includes(`aria-keyshortcuts="${shortcut}"`));
  const select = elements(ExecutionToolbar(props), (element) => element.type === "select")[0];
  select.props.onChange({ target: { value: "fast" } });
  assert.equal(view().speed, "fast"); assert.equal(view().cpu.attemptedInstructions, 0);
});

test("memory renders changed markers independently of PC highlighting and exposes Program navigation", () => {
  const { controller, clock, view } = setup("ldc 18\nldc next\nstnl 0\nnext: br -1"); controller.runToCursor(4); clock.drain();
  assert.equal(view().memory[3].changed, true); assert.equal(view().cpu.registers.PC, 3);
  const html = renderToStaticMarkup(createElement(MemoryPanel, { view: view(), onAddress: controller.setMemoryStart }));
  assert.ok(html.includes("value-changed at-pc")); assert.ok(html.includes('aria-label="Changed"'));
  assert.ok(html.includes(">Program</button>")); assert.ok(html.includes("00000012"));
  assert.ok((html.match(/<tr/g) ?? []).length <= 33);
});

test("breakpoint hit indication and trace download state render from real controller data", () => {
  const { controller, clock, view } = setup();
  const render = () => renderToStaticMarkup(createElement(DebuggerPanel, { view: view(), actions: controller }));
  assert.match(render(), /<button[^>]*disabled=""[^>]*>Download Trace<\/button>/);
  controller.toggleBreakpoint(2); controller.run(); clock.drain();
  const html = render();
  assert.ok(html.includes('class="breakpoint-hit" aria-current="location"'));
  assert.ok(html.includes('class="breakpoint-hit-label">Hit</strong>'));
  assert.match(html, /<button[^>]*title="Download all retained attempts as JSON, regardless of filter">Download Trace<\/button>/);
});
