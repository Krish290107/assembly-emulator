export interface SourceDocument {
  code: string;
  filename: string;
}

export interface AssemblyExample extends SourceDocument {
  id: string;
  title: string;
  description: string;
}

export type SaveState = "loading" | "saving" | "saved" | "unavailable";
export type ToolPanel = "info" | "tests" | null;
export type OutputTab = "output" | "errors" | "trace" | "disassembly";
export type ExecutionAction = "assemble" | "run" | "step" | "pause" | "reset";

// Contracts for a future engine. Undefined data means no execution has occurred.
export interface CpuSnapshot {
  registers: Partial<Record<"A" | "B" | "PC" | "SP", number>>;
  memory?: Uint8Array;
}

export interface TraceEntry {
  address: number;
  sourceLine: number;
  instruction: string;
}

export interface DisassemblyEntry {
  address: number;
  bytes: readonly number[];
  instruction: string;
}

export interface DebuggerState {
  breakpoints: readonly number[];
  instructionsPerSecond?: number;
}
