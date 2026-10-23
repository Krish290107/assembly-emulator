export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  preventDefault: () => void;
}

export function handleIdeShortcut(
  event: ShortcutEvent,
  context: { active: boolean; dialogOpen: boolean; unrelatedInput: boolean },
  actions: { download: () => void; create: () => void },
): boolean {
  if (!context.active || context.dialogOpen || context.unrelatedInput || event.defaultPrevented
    || event.isComposing || !event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  const key = event.key.toLowerCase();
  if (key !== "s" && key !== "n") return false;
  event.preventDefault();
  if (!event.repeat) (key === "s" ? actions.download : actions.create)();
  return true;
}
