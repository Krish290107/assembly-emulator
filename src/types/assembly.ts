import type { InstructionMnemonic } from "../lib/assembler/isa.ts";
import type { Diagnostic, Operand, SourceRange } from "./engine.ts";

export interface ParsedLabel {
  name: string;
  source: SourceRange;
}

export type ParsedStatement = (
  | { kind: "label"; label: ParsedLabel }
  | { kind: "instruction"; label?: ParsedLabel; mnemonic: InstructionMnemonic; mnemonicSource: SourceRange; operand: Operand | null }
  | { kind: "data"; label?: ParsedLabel; value: number; valueSource: SourceRange }
) & { source: SourceRange };

export interface ParseResult {
  ok: boolean;
  statements: readonly ParsedStatement[];
  diagnostics: readonly Diagnostic[];
}
