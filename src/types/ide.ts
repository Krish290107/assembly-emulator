export interface SourceDocument {
  code: string;
  filename: string;
}

export interface AssemblyExample extends SourceDocument {
  id: string;
  title: string;
  description: string;
}

export type SaveState = "loading" | "saving" | "saved" | "unavailable" | "conflict";
export type ToolPanel = "info" | "tests" | null;
export type OutputTab = "output" | "errors" | "trace" | "disassembly";
export type ExecutionAction = "assemble" | "run" | "step" | "pause" | "reset";

export type { CpuSnapshot, DebuggerState, DisassemblyEntry, TraceEntry } from "./engine";
