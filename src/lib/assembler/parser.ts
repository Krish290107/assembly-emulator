import type { ParseResult, ParsedLabel, ParsedStatement } from "../../types/assembly.ts";
import type { Diagnostic, Operand, SourceRange } from "../../types/engine.ts";
import { getInstruction, OPERAND_MAX, OPERAND_MIN, WORD_MAX, WORD_MIN } from "./isa.ts";
import { scanSource, type SourceToken } from "./scanner.ts";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INTEGER = /^[+-]?(?:[0-9]+|0[xX][0-9a-fA-F]+)$/;

export function parseSource(source: string): ParseResult {
  const statements: ParsedStatement[] = [];
  const diagnostics: Diagnostic[] = [];
  const error = (code: string, message: string, source: SourceRange) => diagnostics.push({ severity: "error", code, message, source });

  function parseOperand(token: SourceToken, data: boolean): Operand | undefined {
    if (token.kind === "atom" && INTEGER.test(token.text)) {
      const sign = token.text.startsWith("-") ? -1 : 1;
      const value = sign * Number(token.text.replace(/^[+-]/, ""));
      const min = data ? WORD_MIN : OPERAND_MIN;
      const max = data ? WORD_MAX : OPERAND_MAX;
      if (!Number.isSafeInteger(value) || value < min || value > max) {
        error("P007_OPERAND_RANGE", `Value must be between ${min} and ${max} (${data ? "32" : "24"}-bit signed).`, token.source);
        return;
      }
      return { kind: "immediate", value: value === 0 ? 0 : value, source: token.source };
    }
    if (!data && token.kind === "atom" && IDENTIFIER.test(token.text)) return { kind: "symbol", name: token.text, source: token.source };
    error("P006_INVALID_OPERAND", data ? "data requires one signed decimal or hexadecimal integer." : "Expected a signed decimal/hexadecimal integer or a label name.", token.source);
  }

  for (const { tokens } of scanSource(source)) {
    if (!tokens.length) continue;
    let cursor = 0;
    let label: ParsedLabel | undefined;
    const statementSource = { start: tokens[0].source.start, end: tokens.at(-1)!.source.end };
    if (tokens[0].kind === "colon" || tokens[1]?.kind === "colon") {
      if (tokens[0].kind !== "atom" || !IDENTIFIER.test(tokens[0].text)) {
        error("P001_INVALID_LABEL", "A label must start with an ASCII letter or underscore, followed by letters, digits, or underscores.", tokens[0].source);
        continue;
      }
      label = { name: tokens[0].text, source: tokens[0].source };
      cursor = 2;
      if (cursor === tokens.length) {
        statements.push({ kind: "label", label, source: statementSource });
        continue;
      }
      if (tokens[cursor + 1]?.kind === "colon") {
        error("P008_UNEXPECTED_TOKEN", "Only one label is allowed per line.", { start: tokens[cursor].source.start, end: tokens[cursor + 1].source.end });
        continue;
      }
    }
    const mnemonic = tokens[cursor++];
    if (mnemonic.kind !== "atom" || !IDENTIFIER.test(mnemonic.text)) {
      error("P002_EXPECTED_MNEMONIC", "Expected an instruction mnemonic or data directive.", mnemonic.source);
      continue;
    }
    const data = mnemonic.text.toLowerCase() === "data";
    const instruction = getInstruction(mnemonic.text);
    if (!data && !instruction) {
      error("P003_UNKNOWN_MNEMONIC", `Unknown mnemonic '${mnemonic.text}'.`, mnemonic.source);
      continue;
    }
    const count = data ? 1 : instruction!.operandKinds.length;
    const supplied = tokens.length - cursor;
    if (supplied < count) {
      error("P004_MISSING_OPERAND", `${mnemonic.text} requires one operand.`, { start: mnemonic.source.end, end: mnemonic.source.end });
      continue;
    }
    if (supplied > count) {
      error("P005_EXTRA_OPERAND", `${mnemonic.text} expects ${count === 0 ? "no operands" : "one operand"}.`, { start: tokens[cursor + count].source.start, end: tokens.at(-1)!.source.end });
      continue;
    }
    const operand = count ? parseOperand(tokens[cursor], data) : null;
    if (operand === undefined) continue;
    if (data) {
      if (operand?.kind === "immediate") statements.push({ kind: "data", label, value: operand.value, valueSource: operand.source, source: statementSource });
    } else {
      statements.push({ kind: "instruction", label, mnemonic: instruction!.mnemonic, mnemonicSource: mnemonic.source, operand, source: statementSource });
    }
  }
  return { ok: diagnostics.length === 0, statements, diagnostics };
}
