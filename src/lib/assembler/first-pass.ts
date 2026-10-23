import type { FirstPassResult, LocatedStatement, ParseResult, ParsedLabel, UnresolvedSymbolReference } from "../../types/assembly.ts";
import type { Diagnostic, SymbolDefinition } from "../../types/engine.ts";
import { getInstruction, MEMORY_WORDS } from "./isa.ts";

/** Collect addresses from parser output without resolving operands or encoding words. */
export function firstPass(parsed: ParseResult): FirstPassResult {
  const symbols = new Map<string, SymbolDefinition>();
  const definitions = new Map<string, ParsedLabel>();
  const statements: LocatedStatement[] = [];
  const unresolvedReferences: UnresolvedSymbolReference[] = [];
  const diagnostics: Diagnostic[] = [...parsed.diagnostics];
  let location = 0;

  for (const statement of parsed.statements) {
    const { label } = statement;
    if (label) {
      const original = definitions.get(label.name);
      if (original) {
        diagnostics.push({
          severity: "error",
          code: "A001_DUPLICATE_LABEL",
          message: `Label '${label.name}' is already defined at line ${original.source.start.line}, column ${original.source.start.column}.`,
          source: label.source,
          related: [{ message: `First definition of '${label.name}'.`, source: original.source }],
        });
      } else {
        definitions.set(label.name, label);
      }
      if (location >= MEMORY_WORDS) {
        diagnostics.push({
          severity: "error",
          code: "A002_LABEL_ADDRESS",
          message: `Label '${label.name}' would refer to word ${location}; label addresses must be between 0 and ${MEMORY_WORDS - 1}.`,
          source: label.source,
        });
      } else if (!original) {
        symbols.set(label.name, { name: label.name, address: location, source: label.source });
      }
    }

    if (location < MEMORY_WORDS) {
      statements.push({ address: location, statement });
      if (statement.kind === "instruction" && statement.operand?.kind === "symbol") {
        const definition = getInstruction(statement.mnemonic)!;
        unresolvedReferences.push({
          name: statement.operand.name,
          address: location,
          source: statement.operand.source,
          mode: definition.operandMode === "relative" ? "relative" : "absolute",
        });
      }
    } else if (statement.kind !== "label") {
      diagnostics.push({
        severity: "error",
        code: "A003_PROGRAM_OVERFLOW",
        message: `This word requires address ${location}, but memory holds only ${MEMORY_WORDS} words (addresses 0–${MEMORY_WORDS - 1}).`,
        source: statement.source,
      });
    }
    if (statement.kind !== "label") location++;
  }

  return {
    ok: parsed.ok && !diagnostics.some(({ severity }) => severity === "error"),
    symbols,
    statements,
    wordCount: location,
    diagnostics,
    unresolvedReferences,
  };
}
