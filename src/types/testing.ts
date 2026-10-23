import type { CpuDiagnosticCode } from "./cpu.ts";
import type { CpuState, Diagnostic, ExecutionStatus, MemoryCell, TestCase } from "./engine.ts";

export type TestCompletionStatus = "halted" | "error" | "limit-reached";
export type TestFaultCode = Extract<CpuDiagnosticCode,
  "C001_INVALID_WORD" | "C002_INVALID_OPCODE" | "C003_INVALID_ENCODING" | "C004_INVALID_PC" |
  "C005_INVALID_ADDRESS" | "C012_INVALID_SP" | "C013_INVALID_SHIFT" | "C014_INVALID_TARGET">;

/** JSON data only. Reuses the existing source/assertion/initial-state contract. */
export interface TestDefinition extends TestCase {
  description?: string;
  expectedStatus?: TestCompletionStatus;
  expectedFaultCode?: TestFaultCode;
  expectedAttempts?: number;
}

export interface ValidatedTestDefinition extends TestDefinition {
  expectedStatus: TestCompletionStatus;
  limits: { maxInstructions: number };
}
export interface TestDiagnostic extends Diagnostic { path?: string }
export interface TestAssertionResult {
  target: "register" | "memory" | "status" | "fault" | "attempts";
  label: string;
  expected: number | string;
  actual: number | string | null;
  outcome: "PASS" | "FAIL" | "SKIPPED";
  message: string;
}
export interface TestFinalState {
  registers: CpuState["registers"];
  /** Only explicitly asserted memory cells, in assertion declaration order. */
  memory: readonly MemoryCell[];
}
export interface TestResult {
  id: string;
  name: string;
  outcome: "PASS" | "FAIL";
  phase: "validation" | "assembly" | "setup" | "execution" | "assertions" | "cancelled";
  assembly: { status: "not-run" | "success" | "failure"; wordCount: number | null; diagnostics: readonly Diagnostic[] };
  executionStatus: ExecutionStatus | null;
  attemptedInstructions: number;
  budget: number | null;
  finalState: TestFinalState | null;
  assertions: readonly TestAssertionResult[];
  diagnostics: readonly TestDiagnostic[];
  failureReasons: readonly string[];
  cancelled: boolean;
}
export interface TestProgress {
  done: boolean;
  attemptedInstructions: number;
  executionStatus: ExecutionStatus | null;
  result: TestResult | null;
}
export interface TestExecution {
  /** At most TEST_BATCH_SIZE CPU attempts; no implicit timers. */
  advance: () => TestProgress;
  cancel: (reason?: string) => TestProgress;
  getProgress: () => TestProgress;
}
export interface TestSuiteResult {
  outcome: "PASS" | "FAIL";
  total: number;
  passed: number;
  failed: number;
  cancelled: boolean;
  results: readonly TestResult[];
  diagnostics: readonly TestDiagnostic[];
}
export interface TestSuiteProgress {
  done: boolean;
  total: number;
  completed: number;
  activeTestId: string | null;
  result: TestSuiteResult | null;
}
export interface TestSuiteExecution {
  /** Advances one case by at most one bounded batch. Cases never run in parallel. */
  advance: () => TestSuiteProgress;
  cancel: (reason?: string) => TestSuiteProgress;
  getProgress: () => TestSuiteProgress;
}
export interface TestRunOptions {
  signal?: AbortSignal;
  /** Defaults to setTimeout(0), yielding the browser event loop between batches. */
  yieldControl?: () => Promise<void>;
}
