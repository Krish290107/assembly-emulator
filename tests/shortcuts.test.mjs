import assert from "node:assert/strict";
import { test } from "node:test";
import { handleIdeShortcut } from "../src/lib/editor/shortcuts.ts";

function invoke(eventOverrides = {}, contextOverrides = {}) {
  const calls = { prevented: 0, download: 0, create: 0 };
  const event = { key: "s", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false, preventDefault: () => { calls.prevented++; }, ...eventOverrides };
  const handled = handleIdeShortcut(event, { active: true, dialogOpen: false, unrelatedInput: false, ...contextOverrides }, { download: () => { calls.download++; }, create: () => { calls.create++; } });
  return { handled, ...calls };
}

test("Ctrl+S requests one download and suppresses browser Save", () => {
  assert.deepEqual(invoke(), { handled: true, prevented: 1, download: 1, create: 0 });
});

test("Ctrl+N requests the existing guarded create action", () => {
  assert.deepEqual(invoke({ key: "n" }), { handled: true, prevented: 1, download: 0, create: 1 });
});

test("shortcuts are ignored outside the active IDE, in dialogs, and in unrelated inputs", () => {
  for (const context of [{ active: false }, { dialogOpen: true }, { unrelatedInput: true }]) {
    assert.deepEqual(invoke({}, context), { handled: false, prevented: 0, download: 0, create: 0 });
  }
});

test("ordinary Monaco keys, F5/F10, modifier variants, and composition remain untouched", () => {
  for (const event of [{ key: "z" }, { key: "f" }, { key: "F5", ctrlKey: false }, { key: "F10", ctrlKey: false }, { ctrlKey: false }, { shiftKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true }]) {
    assert.deepEqual(invoke(event), { handled: false, prevented: 0, download: 0, create: 0 });
  }
});

test("holding a shortcut suppresses browser defaults without repeating file actions", () => {
  assert.deepEqual(invoke({ repeat: true }), { handled: true, prevented: 1, download: 0, create: 0 });
});
