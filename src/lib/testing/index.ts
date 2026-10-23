import { assembleSource } from "../assembler/index.ts";
import { createCpu, getCpuOverview, loadProgram, readMemory, runCpuBatch, setExecutionLimit, writeMemory, writeRegister, type Cpu } from "../cpu/index.ts";
import type { CpuOverview, CpuResult } from "../../types/cpu.ts";
import type { RegisterName } from "../../types/engine.ts";
import type { TestDiagnostic, TestExecution, TestFinalState, TestProgress, TestResult, TestRunOptions, TestSuiteExecution, TestSuiteProgress, TestSuiteResult } from "../../types/testing.ts";
import { evaluateAssertions } from "./assertions.ts";
import { validateTestDefinition, type DefinitionValidation } from "./validation.ts";

export { validateTestDefinition } from "./validation.ts";
export type { TestDefinition, TestResult, TestRunOptions, TestSuiteResult } from "../../types/testing.ts";
export const TEST_BATCH_SIZE = 256;

function executionFrom(validation: DefinitionValidation, extra: TestDiagnostic[] = []): TestExecution {
  const definition = validation.definition;
  let cpu: Cpu | null = null;
  let overview: CpuOverview | null = null;
  let result: TestResult | null = null;
  let assembly: TestResult["assembly"] = { status: "not-run", wordCount: null, diagnostics: [] };
  const diagnostics: TestDiagnostic[] = [...validation.diagnostics, ...extra];

  function finish(phase: TestResult["phase"], reasons: string[] = [], skipped?: string) {
    if (result) return;
    if (cpu) overview = getCpuOverview(cpu);
    let finalState: TestFinalState | null = null;
    if (cpu && overview && definition) {
      const memory: { address: number; value: number }[] = [];
      for (const assertion of definition.assertions) if (assertion.target === "memory") {
        const read = readMemory(cpu, assertion.address);
        if (read.ok) memory.push({ address: assertion.address, value: read.value });
        else { diagnostics.push(read.diagnostic); reasons.push(read.diagnostic.message); }
      }
      finalState = { registers: overview.registers, memory };
    }
    const assertions = definition ? evaluateAssertions(definition, overview, finalState, skipped) : [];
    const failureReasons = [...reasons, ...assertions.filter(({ outcome }) => outcome === "FAIL").map(({ message }) => message)];
    result = {
      id: validation.id, name: validation.name, outcome: failureReasons.length ? "FAIL" : "PASS", phase, assembly,
      executionStatus: overview?.status ?? null, attemptedInstructions: overview?.attemptedInstructions ?? 0,
      budget: definition?.limits.maxInstructions ?? null, finalState, assertions,
      diagnostics: [...diagnostics, ...(overview?.diagnostics ?? [])], failureReasons, cancelled: phase === "cancelled",
    };
    cpu = null; // Finished/cancelled sessions cannot execute again; release private memory.
  }
  function progress(): TestProgress {
    return structuredClone({ done: result !== null, executionStatus: overview?.status ?? null, attemptedInstructions: overview?.attemptedInstructions ?? 0, result });
  }
  function setupResult(operation: CpuResult<void>): boolean {
    if (operation.ok) return true;
    diagnostics.push(operation.diagnostic);
    finish("setup", [operation.diagnostic.message], "CPU setup failed");
    return false;
  }
  function prepare(): boolean {
    const assembled = assembleSource(definition!.source);
    assembly = { status: assembled.status, wordCount: assembled.status === "success" ? assembled.program.bytes.length / 4 : null, diagnostics: assembled.diagnostics };
    diagnostics.push(...assembled.diagnostics);
    if (assembled.status === "failure") { finish("assembly", ["Assembly failed; no CPU instructions executed."], "assembly failed"); return false; }
    cpu = createCpu();
    if (!setupResult(loadProgram(cpu, assembled.program)) || !setupResult(setExecutionLimit(cpu, definition!.limits.maxInstructions))) return false;
    for (const [register, value] of Object.entries(definition!.initialState?.registers ?? {})) {
      if (!setupResult(writeRegister(cpu, register as RegisterName, value))) return false;
    }
    for (const { address, value } of definition!.initialState?.memory ?? []) if (!setupResult(writeMemory(cpu, address, value))) return false;
    overview = getCpuOverview(cpu);
    if (overview.status === "idle") {
      diagnostics.push({ severity: "error", code: "T004_NO_RUNNABLE_IMAGE", message: "The assembled program has no words. Initial memory cannot make an empty image runnable." });
      finish("execution", ["No runnable image; nothing executed."]); return false;
    }
    return true;
  }
  if (!definition || diagnostics.length) finish("validation", diagnostics.map(({ message }) => message), "invalid definition");
  return {
    getProgress: progress,
    advance() {
      if (result) return progress();
      if (!cpu && !prepare()) return progress();
      const execution = runCpuBatch(cpu!, TEST_BATCH_SIZE);
      overview = getCpuOverview(cpu!);
      if (execution.status !== "paused") finish("assertions");
      return progress();
    },
    cancel(reason = "Test execution cancelled.") {
      if (!result) {
        diagnostics.push({ severity: "error", code: "T006_CANCELLED", message: reason });
        finish("cancelled", [reason], "execution cancelled");
      }
      return progress();
    },
  };
}

/** Captures/validates the definition now; assembly and CPU allocation are lazy. */
export function createTestExecution(definition: unknown): TestExecution {
  return executionFrom(validateTestDefinition(definition));
}

/** Captures every definition, but activates only one private CPU at a time. */
export function createTestSuiteExecution(definitions: readonly unknown[]): TestSuiteExecution {
  const diagnostics: TestDiagnostic[] = [];
  const values: readonly unknown[] = Array.isArray(definitions) ? definitions : [];
  if (!Array.isArray(definitions)) diagnostics.push({ severity: "error", code: "T001_INVALID_DEFINITION", path: "suite", message: "Suite definitions must be an array." });
  const validations = Array.from(values, validateTestDefinition);
  const counts = new Map<string, number>();
  for (const validation of validations) if (validation.hasId) counts.set(validation.id, (counts.get(validation.id) ?? 0) + 1);
  const sessions = validations.map((validation) => executionFrom(validation, validation.hasId && counts.get(validation.id)! > 1 ? [{
    severity: "error", code: "T003_DUPLICATE_ID", path: "id", message: `Duplicate test ID ${validation.id}; use a unique ID for each suite case.`,
  }] : []));
  const results: TestResult[] = [];
  let index = 0;
  let cancelled = false;
  let result: TestSuiteResult | null = null;
  function complete() {
    if (index !== sessions.length || result) return;
    const passed = results.filter(({ outcome }) => outcome === "PASS").length;
    result = { outcome: diagnostics.length || cancelled || passed !== sessions.length ? "FAIL" : "PASS", total: sessions.length, passed, failed: sessions.length - passed, cancelled, results, diagnostics };
  }
  function progress(): TestSuiteProgress {
    return structuredClone({ done: result !== null, total: sessions.length, completed: index, activeTestId: result ? null : validations[index].id, result });
  }
  complete();
  return {
    getProgress: progress,
    advance() {
      if (!result) {
        const current = sessions[index].advance();
        if (current.done) { results.push(current.result!); index++; complete(); }
      }
      return progress();
    },
    cancel(reason = "Test suite cancelled.") {
      if (!result) {
        cancelled = true;
        for (; index < sessions.length; index++) results.push(sessions[index].cancel(reason).result!);
        complete();
      }
      return progress();
    },
  };
}

const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function yieldOrAbort(options: TestRunOptions): Promise<void> {
  const yieldControl = options.yieldControl ?? defaultYield;
  const signal = options.signal;
  if (!signal) return yieldControl();
  if (signal.aborted) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { cleanup(); resolve(); };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(yieldControl).then(() => { cleanup(); resolve(); }, (error: unknown) => { cleanup(); reject(error); });
    if (signal.aborted) abort();
  });
}
type Incremental<Result, Progress extends { done: boolean; result: Result | null }> = {
  getProgress: () => Progress; advance: () => Progress; cancel: (reason?: string) => Progress;
};
async function completeAsync<Result, Progress extends { done: boolean; result: Result | null }>(session: Incremental<Result, Progress>, options: TestRunOptions): Promise<Result> {
  let progress = session.getProgress();
  while (!progress.done) {
    if (options.signal?.aborted) return session.cancel().result!;
    progress = session.advance();
    if (!progress.done) {
      try { await yieldOrAbort(options); }
      catch { return session.cancel("Execution scheduling failed; test execution cancelled.").result!; }
    }
  }
  return progress.result!;
}

/** Async convenience APIs yield a browser turn between bounded advances. */
export function runTestCase(definition: unknown, options: TestRunOptions = {}): Promise<TestResult> {
  return completeAsync<TestResult, TestProgress>(createTestExecution(definition), options);
}
export function runTestSuite(definitions: readonly unknown[], options: TestRunOptions = {}): Promise<TestSuiteResult> {
  return completeAsync<TestSuiteResult, TestSuiteProgress>(createTestSuiteExecution(definitions), options);
}
