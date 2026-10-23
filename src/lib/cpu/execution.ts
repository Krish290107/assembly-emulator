import type { CpuResult } from "../../types/cpu.ts";
import type { CpuState } from "../../types/engine.ts";
import { fetchDecodedInstruction } from "./decoder.ts";
import { cpuFailure } from "./diagnostics.ts";
import { isMemoryAddress, isValidPc, isValidSp } from "./validation.ts";

export interface InstructionEffects {
  registers: CpuState["registers"];
  write?: { address: number; value: number };
  halted: boolean;
}

/** Pure validate-before-commit phase. No register/memory writes or bookkeeping. */
export function prepareInstruction(state: Readonly<CpuState>): CpuResult<InstructionEffects> {
  const { A, B, PC: p, SP } = state.registers;
  const decoded = fetchDecodedInstruction(state.memory, p);
  if (!decoded.ok) return decoded;
  const { opcode, operand: v, word } = decoded.value;
  const registers = { A, B, PC: p + 1, SP };
  let write: InstructionEffects["write"];
  let halted = false;

  // Check the mathematical address before reading or staging any write.
  if (opcode >= 2 && opcode <= 5) {
    const address = (opcode <= 3 ? SP : A) + v;
    if (!isMemoryAddress(address)) {
      return cpuFailure("C005_INVALID_ADDRESS", `Memory address ${address} is outside 0–65535.`, { address: p, word, target: address });
    }
    switch (opcode) {
      case 2: registers.B = A; registers.A = state.memory[address]; break;
      case 3: write = { address, value: A }; registers.A = B; break;
      case 4: registers.A = state.memory[address]; break;
      case 5: write = { address, value: B }; break;
    }
  } else {
    switch (opcode) {
      case 0: registers.B = A; registers.A = v; break;
      case 1: registers.A = (A + v) | 0; break;
      case 6: registers.A = (B + A) | 0; break;
      case 7: registers.A = (B - A) | 0; break;
      case 8: case 9:
        if (!Number.isInteger(A) || A < 0 || A > 31) {
          return cpuFailure("C013_INVALID_SHIFT", `Shift count ${A} must be an integer from 0 to 31.`, { address: p, word, target: A });
        }
        registers.A = opcode === 8 ? B << A : B >> A;
        break;
      case 10: registers.SP = SP + v; break;
      case 11: registers.SP = A; registers.A = B; break;
      case 12: registers.B = A; registers.A = SP; break;
      case 13: registers.B = A; registers.A = p; registers.PC = p + 1 + v; break;
      case 14: registers.PC = A + 1; registers.A = B; break;
      case 15: if (A === 0) registers.PC = p + 1 + v; break;
      case 16: if (A < 0) registers.PC = p + 1 + v; break;
      case 17: registers.PC = p + 1 + v; break;
      case 18: registers.PC = p; halted = true; break;
    }
  }
  if (!isValidSp(registers.SP)) {
    return cpuFailure("C012_INVALID_SP", `Resulting SP ${registers.SP} is outside 0–65536.`, { address: p, word, target: registers.SP });
  }
  if (!halted && !isValidPc(registers.PC)) {
    return cpuFailure("C014_INVALID_TARGET", `Resulting PC ${registers.PC} is outside 0–65535.`, { address: p, word, target: registers.PC });
  }
  return { ok: true, value: { registers, write, halted } };
}
