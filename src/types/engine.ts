// Transport contracts only; numeric ranges and instruction semantics await Day 3.
export type RegisterName = "A" | "B" | "PC" | "SP";

export interface SourceLocation {
  line: number;
  column: number;
}

// One-based positions; end is exclusive.
export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  source?: SourceRange;
}

export type ValueReference = { kind: "literal"; value: number } | { kind: "symbol"; name: string };
export type Operand = (
  | { kind: "register"; register: RegisterName }
  | { kind: "immediate"; value: number }
  | { kind: "symbol"; name: string }
  | { kind: "memory"; address: ValueReference }
) & { source: SourceRange };

export interface InstructionDefinition {
  mnemonic: string;
  operandKinds: readonly (readonly Operand["kind"][])[];
  description: string;
}

export interface SymbolDefinition {
  name: string;
  address: number;
  source: SourceRange;
}

export interface MachineCode {
  bytes: Uint8Array;
  origin: number;
  sourceMap: readonly { offset: number; length: number; source: SourceRange }[];
}

export type AssemblyResult =
  | { status: "success"; program: MachineCode; symbols: ReadonlyMap<string, SymbolDefinition>; diagnostics: readonly Diagnostic[] }
  | { status: "failure"; program?: never; symbols?: never; diagnostics: readonly Diagnostic[] };

export interface CpuState {
  registers: Record<RegisterName, number>;
  memory: Uint8Array;
}

export interface CpuSnapshot {
  registers: Partial<CpuState["registers"]>;
  memory?: CpuState["memory"];
}

export type ExecutionStatus = "idle" | "ready" | "running" | "paused" | "halted" | "error" | "limit-reached";

export interface ExecutionLimits {
  maxInstructions: number;
}

export interface TraceEntry {
  step: number;
  address: number;
  instruction: string;
  source?: SourceRange;
  snapshot?: CpuSnapshot;
}

export interface DisassemblyEntry {
  address: number;
  bytes: readonly number[];
  instruction: string;
}

export interface Breakpoint {
  id: string;
  sourceLine: number;
  enabled: boolean;
  address?: number;
}

export interface DebuggerState {
  breakpoints: readonly Breakpoint[];
  instructionsPerSecond?: number;
}

export interface MemoryCell {
  address: number;
  value: number;
}

export type StateAssertion =
  | { target: "register"; register: RegisterName; expected: number }
  | { target: "memory"; address: number; expected: number };

export interface TestCase {
  id: string;
  name: string;
  source: string;
  initialState?: { registers?: Partial<CpuState["registers"]>; memory?: readonly MemoryCell[] };
  assertions: readonly StateAssertion[];
  limits?: ExecutionLimits;
}
