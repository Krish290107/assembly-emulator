import type { Diagnostic } from "../../types/engine.ts";

/** Keep exact one-based, exclusive source positions, including insertion ranges. */
export function editorMarkers(diagnostics: readonly Diagnostic[]) {
  return diagnostics.flatMap((diagnostic) => diagnostic.source ? [{
    startLineNumber: diagnostic.source.start.line, startColumn: diagnostic.source.start.column,
    endLineNumber: diagnostic.source.end.line, endColumn: diagnostic.source.end.column,
    severity: diagnostic.severity, code: diagnostic.code, message: diagnostic.message,
  }] : []);
}
