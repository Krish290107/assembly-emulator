import type { CpuFoundationSnapshot, CpuResult, DecodedInstruction, RuntimeDiagnostic } from "../../types/cpu.ts";
import type { CpuState, ExecutionLimits, ExecutionStatus, MachineCode, RegisterName, TraceEntry } from "../../types/engine.ts";
import { DEFAULT_EXECUTION_LIMIT, MAX_EXECUTION_LIMIT, MEMORY_WORDS } from "../assembler/isa.ts";
import { decodeInstruction } from "./decoder.ts";
import { cpuFailure } from "./diagnostics.ts";
import { isMemoryAddress, isSignedWord, isValidExecutionLimit, isValidImageSize, isValidPc, isValidRegisterValue } from "./validation.ts";

export { decodeInstruction } from "./decoder.ts";
export { isMemoryAddress, isSignedWord, isValidExecutionLimit, isValidImageSize, isValidPc, isValidRegisterValue, isValidSp } from "./validation.ts";

const CPU_BRAND: unique symbol = Symbol("Cpu");
export interface Cpu { readonly [CPU_BRAND]: true }

interface InternalCpu extends CpuState {
  status: ExecutionStatus;
  attemptedInstructions: number;
  limits: ExecutionLimits;
  program: MachineCode | null;
  diagnostics: RuntimeDiagnostic[];
  trace: TraceEntry[];
}

const states = new WeakMap<Cpu, InternalCpu>();
const initialRegisters = (): CpuState["registers"] => ({ A: 0, B: 0, PC: 0, SP: MEMORY_WORDS });

function stateFor(cpu: Cpu): InternalCpu {
  const state = states.get(cpu);
  if (!state) throw new TypeError("Unknown CPU handle. Use createCpu().");
  return state;
}

export function createCpu(): Cpu {
  const cpu: Cpu = Object.freeze({ [CPU_BRAND]: true as const });
  states.set(cpu, {
    registers: initialRegisters(), memory: new Int32Array(MEMORY_WORDS), status: "idle",
    attemptedInstructions: 0, limits: { maxInstructions: DEFAULT_EXECUTION_LIMIT },
    program: null, diagnostics: [], trace: [],
  });
  return cpu;
}

/** Return detached registers, memory, program bytes/metadata, and bookkeeping. */
export function getCpuSnapshot(cpu: Cpu): CpuFoundationSnapshot {
  return structuredClone(stateFor(cpu));
}

function restore(state: InternalCpu): void {
  state.memory.fill(0);
  if (state.program) {
    const { bytes } = state.program;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let address = 0; address < bytes.length / 4; address++) state.memory[address] = view.getInt32(address * 4, true);
  }
  state.registers = initialRegisters();
  state.attemptedInstructions = 0;
  state.status = state.program?.bytes.length ? "ready" : "idle";
  state.diagnostics = [];
  state.trace = [];
}

/** Validate and copy before installing; failure leaves the complete CPU unchanged. */
export function loadProgram(cpu: Cpu, program: MachineCode): CpuResult<void> {
  const state = stateFor(cpu);
  if (program.origin !== 0) return cpuFailure("C008_INVALID_ORIGIN", "ISA v1 only supports program origin 0.");
  if (!(program.bytes instanceof Uint8Array)) return cpuFailure("C011_INVALID_IMAGE_TYPE", "Program bytes must be a Uint8Array.");
  if (!isValidImageSize(program.bytes.length)) {
    return cpuFailure("C009_INVALID_IMAGE_SIZE", `Program length must be divisible by four and at most ${MEMORY_WORDS * 4} bytes.`);
  }
  // Construct a plain independent Uint8Array, including when input is a Buffer/view.
  const owned: MachineCode = { origin: 0, bytes: new Uint8Array(program.bytes), sourceMap: structuredClone(program.sourceMap) };
  state.program = owned;
  restore(state);
  return { ok: true, value: undefined };
}

export function resetCpu(cpu: Cpu): void {
  restore(stateFor(cpu));
}

export function readMemory(cpu: Cpu, address: number): CpuResult<number> {
  const state = stateFor(cpu);
  if (!isMemoryAddress(address)) return cpuFailure("C005_INVALID_ADDRESS", `Memory address must be an integer from 0 to ${MEMORY_WORDS - 1}.`, { address });
  return { ok: true, value: state.memory[address] };
}

export function writeMemory(cpu: Cpu, address: number, value: number): CpuResult<void> {
  const state = stateFor(cpu);
  if (!isMemoryAddress(address)) return cpuFailure("C005_INVALID_ADDRESS", `Memory address must be an integer from 0 to ${MEMORY_WORDS - 1}.`, { address });
  if (!isSignedWord(value)) return cpuFailure("C007_INVALID_MEMORY_VALUE", "Memory values must be signed 32-bit integers.", { address, word: value });
  state.memory[address] = value;
  return { ok: true, value: undefined };
}

export function writeRegister(cpu: Cpu, register: RegisterName, value: number): CpuResult<void> {
  const state = stateFor(cpu);
  if (!isValidRegisterValue(register, value)) {
    return cpuFailure(register === "PC" ? "C004_INVALID_PC" : "C006_INVALID_REGISTER", `Invalid ${register} value: ${value}. A/B require signed 32-bit integers, PC 0–65535, and SP 0–65536.`);
  }
  state.registers[register] = value;
  return { ok: true, value: undefined };
}

export function setExecutionLimit(cpu: Cpu, maxInstructions: number): CpuResult<void> {
  const state = stateFor(cpu);
  if (!isValidExecutionLimit(maxInstructions)) return cpuFailure("C010_INVALID_EXECUTION_LIMIT", `Execution limit must be an integer from 1 to ${MAX_EXECUTION_LIMIT}.`);
  state.limits.maxInstructions = maxInstructions;
  return { ok: true, value: undefined };
}

/** Optional address is a word-addressed inspection override; PC never advances. */
export function fetchInstruction(cpu: Cpu, address = stateFor(cpu).registers.PC): CpuResult<DecodedInstruction> {
  const state = stateFor(cpu);
  if (!isValidPc(address)) return cpuFailure("C004_INVALID_PC", `Fetch address must be an integer from 0 to ${MEMORY_WORDS - 1}.`, { address });
  const result = decodeInstruction(state.memory[address]);
  if (!result.ok) return { ok: false, diagnostic: { ...result.diagnostic, address } };
  return result;
}
