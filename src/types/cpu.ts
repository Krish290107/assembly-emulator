import type { InstructionMnemonic, InstructionOpcode } from "../lib/assembler/isa.ts";
import type { CpuState, Diagnostic, ExecutionLimits, ExecutionStatus, MachineCode, TraceEntry } from "./engine.ts";

export type CpuDiagnosticCode =
  | "C001_INVALID_WORD" | "C002_INVALID_OPCODE" | "C003_INVALID_ENCODING"
  | "C004_INVALID_PC" | "C005_INVALID_ADDRESS" | "C006_INVALID_REGISTER"
  | "C007_INVALID_MEMORY_VALUE" | "C008_INVALID_ORIGIN" | "C009_INVALID_IMAGE_SIZE"
  | "C010_INVALID_EXECUTION_LIMIT" | "C011_INVALID_IMAGE_TYPE"
  | "C012_INVALID_SP" | "C013_INVALID_SHIFT" | "C014_INVALID_TARGET" | "C015_INVALID_BATCH_SIZE";

export interface RuntimeDiagnostic extends Diagnostic {
  severity: "error";
  code: CpuDiagnosticCode;
  address?: number;
  word?: number;
  target?: number;
}

export type CpuResult<T> = { ok: true; value: T } | { ok: false; diagnostic: RuntimeDiagnostic };

export interface DecodedInstruction {
  /** Exact input number; signed and unsigned 32-bit representations are accepted. */
  word: number;
  opcode: InstructionOpcode;
  mnemonic: InstructionMnemonic;
  operand: number;
}

/** Detached snapshot: callers may change it without changing the CPU. */
export interface CpuFoundationSnapshot extends CpuState {
  status: ExecutionStatus;
  attemptedInstructions: number;
  limits: ExecutionLimits;
  program: MachineCode | null;
  diagnostics: readonly RuntimeDiagnostic[];
  trace: readonly TraceEntry[];
}

/** Lightweight detached result; attempts counts this call, attemptedInstructions the total. */
export interface CpuExecutionResult {
  status: ExecutionStatus;
  attempts: number;
  attemptedInstructions: number;
  diagnostics: readonly RuntimeDiagnostic[];
}

/** Detached compact state for visualization without copying memory/program bytes. */
export type CpuOverview = Pick<CpuFoundationSnapshot, "registers" | "status" | "attemptedInstructions" | "limits" | "diagnostics">;

/** Compact record of one counted attempt, including a faulting attempt. */
export interface CpuAttemptTrace extends TraceEntry {
  word?: number;
  decoded?: DecodedInstruction;
  before: CpuState["registers"];
  after: CpuState["registers"];
  memoryWrite?: { address: number; before: number; after: number };
  status: ExecutionStatus;
  diagnostic?: RuntimeDiagnostic;
  modified: boolean;
}

export interface TracedStepResult {
  execution: CpuExecutionResult;
  entry?: CpuAttemptTrace;
}
