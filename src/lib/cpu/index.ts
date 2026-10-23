import type { CpuAttemptTrace, CpuExecutionResult, CpuFoundationSnapshot, CpuOverview, CpuResult, DecodedInstruction, RuntimeDiagnostic, TracedStepResult } from "../../types/cpu.ts";
import type { CpuState, ExecutionLimits, ExecutionStatus, MachineCode, RegisterName, TraceEntry } from "../../types/engine.ts";
import { DEFAULT_EXECUTION_LIMIT, getInstruction, MAX_EXECUTION_LIMIT, MEMORY_WORDS } from "../assembler/isa.ts";
import { decodeInstruction, fetchDecodedInstruction } from "./decoder.ts";
import { cpuFailure } from "./diagnostics.ts";
import { prepareInstruction } from "./execution.ts";
import { isMemoryAddress, isSignedWord, isValidExecutionLimit, isValidImageSize, isValidRegisterValue } from "./validation.ts";

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

export function getCpuOverview(cpu: Cpu): CpuOverview {
  const { registers, status, attemptedInstructions, limits, diagnostics } = stateFor(cpu);
  return structuredClone({ registers, status, attemptedInstructions, limits, diagnostics });
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
  if (maxInstructions < state.attemptedInstructions) return cpuFailure("C010_INVALID_EXECUTION_LIMIT", "Execution limit cannot be lower than the number of attempts already counted.");
  state.limits.maxInstructions = maxInstructions;
  return { ok: true, value: undefined };
}

/** Optional address is a word-addressed inspection override; PC never advances. */
export function fetchInstruction(cpu: Cpu, address = stateFor(cpu).registers.PC): CpuResult<DecodedInstruction> {
  const state = stateFor(cpu);
  return fetchDecodedInstruction(state.memory, address);
}

function attemptInstruction(state: InternalCpu, record?: (entry: CpuAttemptTrace) => void): void {
  if (state.attemptedInstructions >= state.limits.maxInstructions) {
    state.status = "limit-reached";
    return;
  }
  state.attemptedInstructions++;
  const before = record ? { ...state.registers } : undefined;
  const word = record && isMemoryAddress(state.registers.PC) ? state.memory[state.registers.PC] : undefined;
  const prepared = prepareInstruction(state);
  if (!prepared.ok) {
    const diagnostic = prepared.diagnostic;
    const source = state.program?.sourceMap.find(({ offset, length }) => offset === state.registers.PC * 4 && length === 4)?.source;
    state.diagnostics.push(source ? { ...diagnostic, source } : diagnostic);
    state.status = "error";
    if (record) record(attemptTrace(state, before!, word));
    return;
  }
  const { registers, write, halted } = prepared.value;
  const memoryWrite = record && write ? { address: write.address, before: state.memory[write.address], after: write.value } : undefined;
  if (write) state.memory[write.address] = write.value;
  state.registers = registers;
  if (halted) state.status = "halted";
  else if (state.attemptedInstructions === state.limits.maxInstructions) state.status = "limit-reached";
  if (record) record({ ...attemptTrace(state, before!, word), memoryWrite });
}

function attemptTrace(state: InternalCpu, before: CpuState["registers"], word: number | undefined): CpuAttemptTrace {
  const decoded = word === undefined ? undefined : decodeInstruction(word);
  const address = before.PC;
  const bytes = state.program?.bytes;
  // Reset fills memory beyond the loaded image with zero words too.
  const original = !isMemoryAddress(address) ? undefined : bytes && address * 4 + 4 <= bytes.length ? new DataView(bytes.buffer, bytes.byteOffset, bytes.length).getInt32(address * 4, true) : 0;
  const modified = original !== undefined && original !== word;
  const mapping = state.program?.sourceMap[address];
  const source = word !== undefined && word === original && mapping?.offset === address * 4 && mapping.length === 4 ? structuredClone(mapping.source) : undefined;
  const diagnostic = state.status === "error" ? structuredClone(state.diagnostics.at(-1)) : undefined;
  // Keep legacy CPU diagnostics intact, but never attach a stale source link to history.
  if (diagnostic) diagnostic.source = source;
  return {
    step: state.attemptedInstructions, address, word, decoded: decoded?.ok ? decoded.value : undefined,
    instruction: decoded?.ok ? `${decoded.value.mnemonic}${getInstruction(decoded.value.mnemonic)!.operandMode === "none" ? "" : ` ${decoded.value.operand}`}` : "Invalid instruction bits",
    before, after: { ...state.registers }, status: state.status === "running" ? "paused" : state.status,
    diagnostic,
    source, modified,
  };
}

function executeSteps(state: InternalCpu, maxSteps: number, record?: (entry: CpuAttemptTrace) => void): CpuExecutionResult {
  const before = state.attemptedInstructions;
  if (state.status === "ready" || state.status === "paused") {
    state.status = "running";
    for (let step = 0; step < maxSteps && state.status === "running"; step++) attemptInstruction(state, record);
    if (state.status === "running") state.status = "paused";
  }
  return {
    status: state.status, attempts: state.attemptedInstructions - before,
    attemptedInstructions: state.attemptedInstructions, diagnostics: structuredClone(state.diagnostics),
  };
}

export function stepCpu(cpu: Cpu): CpuExecutionResult {
  return executeSteps(stateFor(cpu), 1);
}

/** Same executor, with one detached compact attempt record; no trace on a no-op. */
export function stepCpuTraced(cpu: Cpu): TracedStepResult {
  let entry: CpuAttemptTrace | undefined;
  const execution = executeSteps(stateFor(cpu), 1, (attempt) => { entry = attempt; });
  return { execution, entry };
}

/** Synchronous caller-bounded work only; scheduling and UI integration are external. */
export function runCpuBatch(cpu: Cpu, maxSteps: number): CpuExecutionResult {
  const state = stateFor(cpu);
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_EXECUTION_LIMIT) {
    const { diagnostic } = cpuFailure("C015_INVALID_BATCH_SIZE", `Batch size must be an integer from 1 to ${MAX_EXECUTION_LIMIT}.`);
    return { status: state.status, attempts: 0, attemptedInstructions: state.attemptedInstructions, diagnostics: [...structuredClone(state.diagnostics), diagnostic] };
  }
  return executeSteps(state, maxSteps);
}
