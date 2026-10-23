import type { InstructionDefinition } from "../../types/engine.ts";

export const MEMORY_WORDS = 65_536;
export const WORD_MIN = -2_147_483_648;
export const WORD_MAX = 2_147_483_647;
export const OPERAND_MIN = -8_388_608;
export const OPERAND_MAX = 8_388_607;
export const DEFAULT_EXECUTION_LIMIT = 100_000;
export const MAX_EXECUTION_LIMIT = 10_000_000;

const VALUE = [["immediate", "symbol"]] as const;

// Effects use old register values, p = fetched PC, and N = p + 1.
export const INSTRUCTIONS = [
  { mnemonic: "ldc", opcode: 0, operandKinds: VALUE, operandMode: "absolute", description: "Load constant", effect: "B ← A; A ← operand; PC ← N" },
  { mnemonic: "adc", opcode: 1, operandKinds: VALUE, operandMode: "absolute", description: "Add constant", effect: "A ← wrap32(A + operand); PC ← N" },
  { mnemonic: "ldl", opcode: 2, operandKinds: VALUE, operandMode: "absolute", description: "Load local", effect: "B ← A; A ← M[SP + operand]; PC ← N" },
  { mnemonic: "stl", opcode: 3, operandKinds: VALUE, operandMode: "absolute", description: "Store local", effect: "M[SP + operand] ← A; A ← B; PC ← N" },
  { mnemonic: "ldnl", opcode: 4, operandKinds: VALUE, operandMode: "absolute", description: "Load nonlocal", effect: "A ← M[A + operand]; PC ← N" },
  { mnemonic: "stnl", opcode: 5, operandKinds: VALUE, operandMode: "absolute", description: "Store nonlocal", effect: "M[A + operand] ← B; PC ← N" },
  { mnemonic: "add", opcode: 6, operandKinds: [], operandMode: "none", description: "Add registers", effect: "A ← wrap32(B + A); PC ← N" },
  { mnemonic: "sub", opcode: 7, operandKinds: [], operandMode: "none", description: "Subtract registers", effect: "A ← wrap32(B − A); PC ← N" },
  { mnemonic: "shl", opcode: 8, operandKinds: [], operandMode: "none", description: "Shift left", effect: "A ← wrap32(B shifted left by A); PC ← N" },
  { mnemonic: "shr", opcode: 9, operandKinds: [], operandMode: "none", description: "Arithmetic shift right", effect: "A ← B shifted right by A, sign extended; PC ← N" },
  { mnemonic: "adj", opcode: 10, operandKinds: VALUE, operandMode: "absolute", description: "Adjust stack pointer", effect: "SP ← SP + operand; PC ← N" },
  { mnemonic: "a2sp", opcode: 11, operandKinds: [], operandMode: "none", description: "Move A to stack pointer", effect: "SP ← A; A ← B; PC ← N" },
  { mnemonic: "sp2a", opcode: 12, operandKinds: [], operandMode: "none", description: "Load stack pointer", effect: "B ← A; A ← SP; PC ← N" },
  { mnemonic: "call", opcode: 13, operandKinds: VALUE, operandMode: "relative", description: "Call relative target", effect: "B ← A; A ← p; PC ← N + operand" },
  { mnemonic: "return", opcode: 14, operandKinds: [], operandMode: "none", description: "Return through A", effect: "PC ← A + 1; A ← B" },
  { mnemonic: "brz", opcode: 15, operandKinds: VALUE, operandMode: "relative", description: "Branch if A is zero", effect: "PC ← (A = 0 ? N + operand : N)" },
  { mnemonic: "brlz", opcode: 16, operandKinds: VALUE, operandMode: "relative", description: "Branch if A is negative", effect: "PC ← (A < 0 ? N + operand : N)" },
  { mnemonic: "br", opcode: 17, operandKinds: VALUE, operandMode: "relative", description: "Unconditional branch", effect: "PC ← N + operand" },
  { mnemonic: "HALT", opcode: 18, operandKinds: [], operandMode: "none", description: "Halt normally", effect: "PC remains p; registers and memory unchanged; status ← halted" },
] as const satisfies readonly InstructionDefinition[];

export type InstructionMnemonic = (typeof INSTRUCTIONS)[number]["mnemonic"];
export type InstructionOpcode = (typeof INSTRUCTIONS)[number]["opcode"];
const BY_NAME = new Map<string, (typeof INSTRUCTIONS)[number]>(INSTRUCTIONS.map((instruction) => [instruction.mnemonic.toLowerCase(), instruction]));

export function getInstruction(mnemonic: string) {
  return BY_NAME.get(mnemonic.toLowerCase());
}
