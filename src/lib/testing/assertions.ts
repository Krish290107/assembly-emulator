import type { CpuOverview } from "../../types/cpu.ts";
import type { TestAssertionResult, TestFinalState, ValidatedTestDefinition } from "../../types/testing.ts";

/** Exact comparisons only, with a result for each explicit or completion assertion. */
export function evaluateAssertions(definition: ValidatedTestDefinition, overview: CpuOverview | null, state: TestFinalState | null, skipped?: string): TestAssertionResult[] {
  const results: TestAssertionResult[] = [];
  function check(target: TestAssertionResult["target"], label: string, expected: number | string, actual: number | string | null) {
    results.push({ target, label, expected, actual: skipped ? null : actual,
      outcome: skipped ? "SKIPPED" : expected === actual ? "PASS" : "FAIL",
      message: skipped ? `${label}: not evaluated (${skipped}).` : `${label}: expected ${expected}, actual ${actual ?? "unavailable"}.`,
    });
  }
  check("status", "Execution status", definition.expectedStatus, overview?.status ?? null);
  if (definition.expectedFaultCode !== undefined) check("fault", "Runtime fault code", definition.expectedFaultCode, overview?.diagnostics.at(-1)?.code ?? null);
  if (definition.expectedAttempts !== undefined) check("attempts", "Attempted instructions", definition.expectedAttempts, overview?.attemptedInstructions ?? null);
  const memory = new Map(state?.memory.map(({ address, value }) => [address, value]));
  for (const assertion of definition.assertions) {
    if (assertion.target === "register") check("register", `Register ${assertion.register}`, assertion.expected, state?.registers[assertion.register] ?? null);
    else check("memory", `Memory[${assertion.address}]`, assertion.expected, memory.get(assertion.address) ?? null);
  }
  return results;
}
