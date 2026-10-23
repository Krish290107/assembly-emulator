"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createWorkspaceController, INITIAL_VIEW } from "./controller";

export function useExecution() {
  // Lazy construction is browser-independent; scheduling is invoked only by client actions.
  const [controller] = useState(() => createWorkspaceController({
    schedule: (callback, delay) => window.setTimeout(callback, delay),
    cancel: (handle) => window.clearTimeout(handle as number),
  }));
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => INITIAL_VIEW);
  useEffect(() => () => controller.dispose(), [controller]);
  return { controller, view };
}
