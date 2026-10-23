import type { ShortcutEvent } from "../editor/shortcuts.ts";
import type { WorkspaceView } from "./controller.ts";

export const DEBUGGER_SHORTCUTS = { run: "F5", step: "F10", reset: "Shift+F5", breakpoint: "F9" } as const;
type DebuggerCommand = keyof typeof DEBUGGER_SHORTCUTS;

/** Called only by the IDE's capture handler, before Monaco processes these keys. */
export function handleDebuggerShortcut(
  event: ShortcutEvent,
  context: { active: boolean; dialogOpen: boolean; unrelatedInput: boolean; sourceInput: boolean; sourceLine: number },
  view: Pick<WorkspaceView, "cpu" | "running" | "assembled">,
  actions: { run: () => void; step: () => void; reset: () => void; breakpoint: (line: number) => void },
): boolean {
  if (!context.active || context.dialogOpen || context.unrelatedInput || event.defaultPrevented || event.isComposing
    || event.ctrlKey || event.metaKey || event.altKey) return false;
  const key = event.key.toUpperCase();
  let command: DebuggerCommand;
  if (key === "F5") command = event.shiftKey ? "reset" : "run";
  else if (key === "F10" && !event.shiftKey) command = "step";
  else if (key === "F9" && !event.shiftKey && context.sourceInput) command = "breakpoint";
  else return false;

  // Consume a recognized IDE command even when disabled, so F5 cannot refresh
  // the page mid-session. Outside the scoped IDE/context it stays a browser key.
  event.preventDefault();
  if (event.repeat) return true;
  const executable = !!view.cpu && !view.running && ["ready", "paused"].includes(view.cpu.status);
  if (command === "breakpoint") {
    if (Number.isInteger(context.sourceLine) && context.sourceLine > 0) actions.breakpoint(context.sourceLine);
  } else if (command === "reset" ? view.assembled : executable) actions[command]();
  return true;
}
