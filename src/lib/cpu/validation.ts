import type { RegisterName } from "../../types/engine.ts";
import { MAX_EXECUTION_LIMIT, MEMORY_WORDS, WORD_MAX, WORD_MIN } from "../assembler/isa.ts";

const integerInRange = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

export const isSignedWord = (value: number) => integerInRange(value, WORD_MIN, WORD_MAX);
export const isMemoryAddress = (value: number) => integerInRange(value, 0, MEMORY_WORDS - 1);
export const isValidPc = isMemoryAddress;
export const isValidSp = (value: number) => integerInRange(value, 0, MEMORY_WORDS);
export const isValidImageSize = (byteLength: number) => integerInRange(byteLength, 0, MEMORY_WORDS * 4) && byteLength % 4 === 0;
export const isValidExecutionLimit = (value: number) => integerInRange(value, 1, MAX_EXECUTION_LIMIT);

export function isValidRegisterValue(register: RegisterName, value: number): boolean {
  switch (register) {
    case "A": case "B": return isSignedWord(value);
    case "PC": return isValidPc(value);
    case "SP": return isValidSp(value);
    default: return false;
  }
}
