import type { FirstPassResult } from "../../types/assembly.ts";
import type { AssemblyResult, Diagnostic, MachineCode, SourceRange } from "../../types/engine.ts";
import { getInstruction, MEMORY_WORDS, OPERAND_MAX, OPERAND_MIN, WORD_MAX, WORD_MIN } from "./isa.ts";

/** Resolve and encode a successful first pass; never expose a partial image. */
export function secondPass(first: FirstPassResult): AssemblyResult {
  const diagnostics: Diagnostic[] = [...first.diagnostics];
  const error = (code: string, message: string, source?: SourceRange) => diagnostics.push({ severity: "error", code, message, source });
  const hasErrors = () => diagnostics.some(({ severity }) => severity === "error");
  const failure = (): AssemblyResult => ({ status: "failure", diagnostics });
  const inconsistent = (message: string, source?: SourceRange) => error("A007_ENCODING_INCONSISTENCY", message, source);
  const inRange = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

  if (!first.ok || hasErrors()) {
    if (!hasErrors()) error("A004_INVALID_FIRST_PASS", "Assembly requires a successful parser and first pass.");
    return failure();
  }
  if (!inRange(first.wordCount, 0, MEMORY_WORDS)) {
    inconsistent(`First-pass word count must be an integer between 0 and ${MEMORY_WORDS}.`);
    return failure();
  }

  const words: number[] = [];
  const sourceMap: MachineCode["sourceMap"][number][] = [];
  let nextAddress = 0;

  for (const { address, statement } of first.statements) {
    const { source } = statement;
    const expectedAddress = nextAddress;
    if (statement.kind !== "label") nextAddress++;
    if (address !== expectedAddress || !inRange(address, 0, MEMORY_WORDS - 1)) {
      inconsistent(`Expected word address ${expectedAddress}, received ${address}.`, statement.source);
      continue;
    }
    if (statement.kind === "label") continue;

    let word: number;
    if (statement.kind === "data") {
      if (!inRange(statement.value, WORD_MIN, WORD_MAX)) {
        inconsistent(`data must contain a signed 32-bit integer (${WORD_MIN} to ${WORD_MAX}).`, statement.valueSource);
        continue;
      }
      word = statement.value;
    } else if (statement.kind === "instruction") {
      const definition = getInstruction(statement.mnemonic);
      if (!definition) {
        inconsistent(`No ISA encoding exists for '${statement.mnemonic}'.`, statement.mnemonicSource);
        continue;
      }
      const { operand } = statement;
      let value = 0;
      if (definition.operandMode === "none") {
        if (operand !== null) {
          inconsistent(`${definition.mnemonic} must not have an operand.`, statement.source);
          continue;
        }
      } else {
        if (!operand) {
          inconsistent(`${definition.mnemonic} requires an operand.`, statement.mnemonicSource);
          continue;
        }
        let symbolAddress: number | undefined;
        if (operand.kind === "immediate") {
          value = operand.value;
        } else if (operand.kind === "symbol") {
          const symbol = first.symbols.get(operand.name);
          if (!symbol) {
            error("A005_UNDEFINED_SYMBOL", `Label '${operand.name}' is not defined (label names are case-sensitive).`, operand.source);
            continue;
          }
          symbolAddress = symbol.address;
          value = definition.operandMode === "relative" ? symbol.address - (address + 1) : symbol.address;
        } else {
          inconsistent("Expected an immediate value or symbol operand.", statement.source);
          continue;
        }
        // Validate before shifting: bitwise conversion would silently truncate bad values.
        if (!inRange(value, OPERAND_MIN, OPERAND_MAX)) {
          error("A006_OPERAND_RANGE", `Resolved operand must be a signed 24-bit integer (${OPERAND_MIN} to ${OPERAND_MAX}); received ${value}.`, operand.source);
          continue;
        }
        if (symbolAddress !== undefined && !inRange(symbolAddress, 0, MEMORY_WORDS - 1)) {
          inconsistent(`Symbol address ${symbolAddress} is outside memory.`, operand.source);
          continue;
        }
      }
      word = (value << 8) | definition.opcode;
    } else {
      inconsistent("Expected an instruction, data directive, or label statement.", source);
      continue;
    }
    words.push(word);
    sourceMap.push({ offset: address * 4, length: 4, source: statement.source });
  }

  if (nextAddress !== first.wordCount) {
    inconsistent(`First pass declares ${first.wordCount} words, but located statements contain ${nextAddress}.`, first.statements.at(-1)?.statement.source);
  }
  if (hasErrors()) return failure();

  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((word, index) => view.setInt32(index * 4, word, true));
  return { status: "success", program: { bytes, origin: 0, sourceMap }, symbols: new Map(first.symbols), diagnostics };
}
