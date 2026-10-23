import type { CpuResult, DecodedInstruction } from "../../types/cpu.ts";
import { INSTRUCTIONS, WORD_MIN } from "../assembler/isa.ts";
import { cpuFailure } from "./diagnostics.ts";

const BY_OPCODE = new Map<number, (typeof INSTRUCTIONS)[number]>(INSTRUCTIONS.map((definition) => [definition.opcode, definition]));

/** Decode a bit pattern without fetching, executing, or changing any CPU state. */
export function decodeInstruction(word: number): CpuResult<DecodedInstruction> {
  if (!Number.isInteger(word) || word < WORD_MIN || word > 0xffff_ffff) {
    return cpuFailure("C001_INVALID_WORD", "Instruction word must be a signed or unsigned 32-bit integer.", { word });
  }
  const opcode = word & 0xff;
  const definition = BY_OPCODE.get(opcode);
  if (!definition) return cpuFailure("C002_INVALID_OPCODE", `Opcode ${opcode} is not supported; valid opcodes are 0–18.`, { word });
  const operand = word >> 8;
  if (definition.operandMode === "none" && operand !== 0) {
    return cpuFailure("C003_INVALID_ENCODING", `${definition.mnemonic} requires zero operand bits.`, { word });
  }
  return { ok: true, value: { word, opcode: definition.opcode, mnemonic: definition.mnemonic, operand } };
}
