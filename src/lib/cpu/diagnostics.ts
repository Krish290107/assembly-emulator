import type { CpuDiagnosticCode, RuntimeDiagnostic } from "../../types/cpu.ts";

export function cpuFailure(code: CpuDiagnosticCode, message: string, details: Pick<RuntimeDiagnostic, "address" | "word"> = {}): { ok: false; diagnostic: RuntimeDiagnostic } {
  return { ok: false, diagnostic: { severity: "error", code, message, ...details } };
}
