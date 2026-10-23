import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createWorkspaceController } from "../src/lib/workspace/controller.ts";

// Compile the real TSX with the installed TypeScript package. No DOM library,
// browser binary, mocked React hooks, or substitute CPU is required.
const require = createRequire(import.meta.url);
function componentModule(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  const resolved = outputText.replace(/from (["'])([^"']+)\1/g, (_match, _quote, specifier) =>
    `from ${JSON.stringify(dependencies[specifier] ?? pathToFileURL(require.resolve(specifier)).href)}`);
  return `data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`;
}
const tableModule = componentModule("../src/components/panels/trace-table.tsx");
const { TraceTable } = await import(tableModule);
const { DebuggerPanel } = await import(componentModule("../src/components/panels/debugger-panel.tsx", {
  "./trace-table": tableModule,
  "@/lib/workspace/controller": new URL("../src/lib/workspace/controller.ts", import.meta.url).href,
  "@/lib/workspace/debugger": new URL("../src/lib/workspace/debugger.ts", import.meta.url).href,
}));

function setup(source = "ldc 10\nadc 5\nHALT", fast = false) {
  let id = 0;
  const pending = new Map();
  const controller = createWorkspaceController({
    schedule(callback) { pending.set(++id, callback); return id; },
    cancel(handle) { pending.delete(handle); },
  });
  controller.setSource(source); controller.assemble();
  if (fast) controller.setSpeed("fast");
  controller.run();
  const tick = () => { const [handle, callback] = pending.entries().next().value; pending.delete(handle); callback(); };
  tick();
  return { controller, pending, tick };
}
function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  if (!isValidElement(tree)) return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
function rows(controller) {
  const view = controller.getSnapshot();
  const tree = TraceTable({ entries: view.trace, selectedStep: view.selectedTrace?.step, onSelect: controller.selectTrace });
  return elements(tree, (element) => element.type === "tr" && element.key !== null);
}
function activate(row, target = row, detail = 1) {
  let stopped = false;
  const event = { detail, target, currentTarget: target, stopPropagation() { stopped = true; } };
  if (target !== row) target.props.onClick?.(event);
  if (!stopped) { event.currentTarget = row; row.props.onClick?.(event); }
}
const button = (row) => elements(row, (element) => element.type === "button")[0];
const renderPanel = (controller) => renderToStaticMarkup(createElement(DebuggerPanel, { view: controller.getSnapshot(), actions: controller }));
const liveState = (controller) => ({ cpu: controller.getSnapshot().cpu, memory: controller.getSnapshot().memory.map(({ value }) => value) });

test("clicking any trace row cell selects its attempt, including outside the Step button", () => {
  for (let cell = 0; cell < 4; cell++) {
    const { controller, pending } = setup();
    const live = structuredClone(liveState(controller));
    const row = rows(controller)[0];
    const cells = elements(row, (element) => element.type === "td");
    activate(row, cells[cell]);
    assert.equal(controller.getSnapshot().selectedTrace?.step, 1, `cell ${cell}`);
    assert.equal(controller.getSnapshot().selectedTrace.after.A, 10);
    assert.ok(rows(controller)[0].props.className.includes("at-pc"));
    assert.equal(button(rows(controller)[0]).props["aria-pressed"], true);
    assert.deepEqual(liveState(controller), live);
    assert.equal(pending.size, 0);
  }
});

test("Step button selection does not bubble into a duplicate row selection", () => {
  const { controller } = setup();
  let publications = 0;
  controller.subscribe(() => publications++);
  const row = rows(controller)[0];
  activate(row, button(row));
  assert.equal(publications, 1);
  assert.equal(controller.getSnapshot().selectedTrace.step, 1);
  activate(row, button(row));
  assert.equal(publications, 2);
  assert.equal(controller.getSnapshot().cpu.attemptedInstructions, 3);
});

test("trace selection retains native keyboard buttons and supports keyboard-generated click activation", () => {
  const { controller } = setup();
  for (const step of [1, 2, 3, 1]) {
    const row = rows(controller).find((entry) => entry.key === String(step));
    const control = button(row);
    assert.equal(control.type, "button");
    assert.equal(control.props.type, "button");
    assert.notEqual(control.props.disabled, true);
    assert.notEqual(control.props.tabIndex, -1);
    assert.equal(control.props["aria-label"], `Inspect trace step ${step}`);
    // Native Enter/Space activation emits click with detail 0; do not add a
    // second key handler that would double-select alongside that native click.
    assert.equal(control.props.onKeyDown, undefined);
    activate(row, control, 0);
    assert.equal(controller.getSnapshot().selectedTrace.step, step);
    assert.equal(button(rows(controller)[step - 1]).props["aria-pressed"], true);
  }
  assert.deepEqual(controller.getSnapshot().cpu.registers, { A: 15, B: 0, PC: 2, SP: 65536 });
  assert.equal(controller.getSnapshot().cpu.attemptedInstructions, 3);
});

test("selected trace details render historical A=10 and update across entries without altering the live CPU", () => {
  const { controller } = setup();
  const live = structuredClone(liveState(controller));
  assert.ok(renderPanel(controller).includes("Select a retained trace step"));
  for (const [step, beforeA, afterA] of [[1, 0, 10], [2, 10, 15], [3, 15, 15]]) {
    const row = rows(controller).find((entry) => entry.key === String(step));
    activate(row, button(row));
    const html = renderPanel(controller);
    assert.ok(html.includes(`aria-label="Trace step ${step} details"`));
    assert.ok(html.includes(`<th scope="row">A</th><td>${beforeA}</td><td>${afterA}</td>`));
    assert.equal(elements(TraceTable({ entries: controller.getSnapshot().trace, selectedStep: step, onSelect: controller.selectTrace }), (element) => element.type === "button" && element.props["aria-pressed"]).length, 1);
    assert.deepEqual(liveState(controller), live);
  }
  assert.ok(renderPanel(controller).includes("Result: halted"));
  assert.equal(live.cpu.status, "halted");
  assert.equal(live.cpu.attemptedInstructions, 3);
});

test("trace selection uses cumulative attempt IDs after ring rollover, not row indexes or PC", () => {
  const { controller } = setup("br -1", true);
  controller.pause();
  const live = structuredClone(liveState(controller));
  assert.equal(rows(controller)[0].key, "13");
  for (const step of [13, 512]) {
    const row = rows(controller).find((entry) => entry.key === String(step));
    activate(row, button(row));
    assert.equal(controller.getSnapshot().selectedTrace.step, step);
    assert.equal(controller.getSnapshot().selectedTrace.address, 0);
    assert.ok(renderPanel(controller).includes(`aria-label="Trace step ${step} details"`));
    assert.deepEqual(liveState(controller), live);
  }
  controller.selectTrace(1);
  assert.equal(controller.getSnapshot().selectedTrace.step, 512);
});

test("clearing trace removes selected details without changing terminal CPU state", () => {
  const { controller } = setup();
  const live = structuredClone(liveState(controller));
  const row = rows(controller)[0];
  activate(row, button(row));
  controller.clearTrace();
  const html = renderPanel(controller);
  assert.ok(html.includes("No attempts recorded."));
  assert.ok(!html.includes("Trace step 1 details"));
  assert.equal(controller.getSnapshot().selectedTrace, undefined);
  assert.deepEqual(liveState(controller), live);
});
