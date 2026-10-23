import { DEFAULT_EXECUTION_LIMIT, MAX_EXECUTION_LIMIT, MEMORY_WORDS } from "../assembler/isa.ts";
import { isMemoryAddress, isSignedWord, isValidExecutionLimit, isValidRegisterValue } from "../cpu/validation.ts";
import type { MemoryCell, RegisterName, StateAssertion } from "../../types/engine.ts";
import type { TestDiagnostic, TestFaultCode, ValidatedTestDefinition } from "../../types/testing.ts";

export const TEST_FAULT_CODES: readonly TestFaultCode[] = ["C001_INVALID_WORD", "C002_INVALID_OPCODE", "C003_INVALID_ENCODING", "C004_INVALID_PC", "C005_INVALID_ADDRESS", "C012_INVALID_SP", "C013_INVALID_SHIFT", "C014_INVALID_TARGET"];
export type DefinitionValidation = {
  id: string; name: string; hasId: boolean; definition: ValidatedTestDefinition | null; diagnostics: TestDiagnostic[];
};
const dataFields = (value: object) => Reflect.ownKeys(value).every((key) => "value" in Object.getOwnPropertyDescriptor(value, key)!);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) && dataFields(value);
const array = (value: unknown, max: number): value is unknown[] => Array.isArray(value) && value.length <= max && dataFields(value) && Reflect.ownKeys(value).length === value.length + 1;
const isRegister = (value: unknown): value is RegisterName => ["A", "B", "PC", "SP"].includes(value as string);

/** Strict, bounded-depth schema validation; copies only supported JSON fields. */
export function validateTestDefinition(input: unknown): DefinitionValidation {
  const diagnostics: TestDiagnostic[] = [];
  let id = "invalid-test", name = "Invalid test";
  let hasId = false;
  const error = (path: string, message: string, code = "T001_INVALID_DEFINITION") => diagnostics.push({ severity: "error", code, path, message: `${path}: ${message}` });
  const keys = (value: Record<string, unknown>, allowed: readonly string[], path: string) => {
    for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !allowed.includes(key)) error(path, `Unsupported field ${String(key)}.`);
  };
  try {
    if (!record(input)) { error("test", "Use a plain JSON object."); return { id, name, hasId, definition: null, diagnostics }; }
    if (typeof input.id === "string") { id = input.id; hasId = !!id.trim(); }
    if (typeof input.name === "string") name = input.name;
    keys(input, ["id", "name", "description", "source", "initialState", "assertions", "limits", "expectedStatus", "expectedFaultCode", "expectedAttempts"], "test");
    for (const field of ["id", "name"]) if (typeof input[field] !== "string" || !input[field].trim()) error(field, "Use a nonempty string.");
    if (typeof input.source !== "string") error("source", "Use assembly source text.");
    if (input.description !== undefined && typeof input.description !== "string") error("description", "Use text.");

    let maxInstructions = DEFAULT_EXECUTION_LIMIT;
    if (input.limits !== undefined) {
      if (!record(input.limits)) error("limits", "Use { maxInstructions: integer }.");
      else {
        keys(input.limits, ["maxInstructions"], "limits");
        if (!isValidExecutionLimit(input.limits.maxInstructions as number)) error("limits.maxInstructions", `Use an integer from 1 to ${MAX_EXECUTION_LIMIT}.`);
        else maxInstructions = input.limits.maxInstructions as number;
      }
    }
    const expectedStatus = input.expectedStatus === undefined ? "halted" : input.expectedStatus;
    if (!["halted", "error", "limit-reached"].includes(expectedStatus as string)) error("expectedStatus", "Use halted, error, or limit-reached.");
    if (expectedStatus === "error") {
      if (!TEST_FAULT_CODES.includes(input.expectedFaultCode as TestFaultCode)) error("expectedFaultCode", "An expected runtime error requires a supported CPU fault code.");
    } else if (input.expectedFaultCode !== undefined) error("expectedFaultCode", "A fault code requires expectedStatus: error.");
    if (input.expectedAttempts !== undefined && (!Number.isInteger(input.expectedAttempts) || (input.expectedAttempts as number) < 0 || (input.expectedAttempts as number) > maxInstructions)) error("expectedAttempts", `Use an integer from 0 to the execution budget (${maxInstructions}).`);

    const assertions: StateAssertion[] = [];
    const seen = new Set<string>();
    if (!array(input.assertions, MEMORY_WORDS + 4)) error("assertions", "Use a plain, dense array with at most 65540 assertions (empty is allowed; completion is still checked).");
    else for (const [index, assertion] of input.assertions.entries()) {
      const path = `assertions[${index}]`;
      if (!record(assertion)) { error(path, "Use a register or memory assertion object."); continue; }
      let target: string;
      if (assertion.target === "register") {
        keys(assertion, ["target", "register", "expected"], path);
        if (!isRegister(assertion.register) || !isValidRegisterValue(assertion.register, assertion.expected as number)) { error(path, "Use register A/B with a signed 32-bit integer, PC 0–65535, or SP 0–65536."); continue; }
        target = `register:${assertion.register}`;
        assertions.push({ target: "register", register: assertion.register, expected: assertion.expected as number });
      } else if (assertion.target === "memory") {
        keys(assertion, ["target", "address", "expected"], path);
        if (!isMemoryAddress(assertion.address as number) || !isSignedWord(assertion.expected as number)) { error(path, "Use a word address 0–65535 and a signed 32-bit expected value."); continue; }
        target = `memory:${assertion.address}`;
        assertions.push({ target: "memory", address: assertion.address as number, expected: assertion.expected as number });
      } else { error(path, "Assertion target must be register or memory."); continue; }
      if (seen.has(target)) error(path, `Duplicate/conflicting assertion for ${target}.`, "T002_DUPLICATE_TARGET");
      seen.add(target);
    }

    const registers: Partial<Record<RegisterName, number>> = {};
    const memory: MemoryCell[] = [];
    if (input.initialState !== undefined) {
      if (!record(input.initialState)) error("initialState", "Use validated register/memory data.");
      else {
        keys(input.initialState, ["registers", "memory"], "initialState");
        if (input.initialState.registers !== undefined) {
          if (!record(input.initialState.registers)) error("initialState.registers", "Use a register/value object.");
          else for (const register of Reflect.ownKeys(input.initialState.registers)) {
            const value = input.initialState.registers[register as string];
            if (!isRegister(register) || !isValidRegisterValue(register, value as number)) error("initialState.registers", `Invalid ${String(register)} value; use the architecture's integer ranges.`);
            else registers[register] = value as number;
          }
        }
        if (input.initialState.memory !== undefined) {
          if (!array(input.initialState.memory, MEMORY_WORDS)) error("initialState.memory", "Use a plain, dense array of at most 65536 { address, value } cells.");
          else {
            const addresses = new Set<number>();
            for (const [index, cell] of input.initialState.memory.entries()) {
              const path = `initialState.memory[${index}]`;
              if (!record(cell)) { error(path, "Use { address, value }."); continue; }
              keys(cell, ["address", "value"], path);
              if (!isMemoryAddress(cell.address as number) || !isSignedWord(cell.value as number)) { error(path, "Use a word address 0–65535 and a signed 32-bit value."); continue; }
              const address = cell.address as number;
              if (addresses.has(address)) error(path, `Duplicate/conflicting initial memory address ${address}.`, "T002_DUPLICATE_TARGET");
              addresses.add(address); memory.push({ address, value: cell.value as number });
            }
          }
        }
      }
    }
    if (diagnostics.length) return { id, name, hasId, definition: null, diagnostics };
    const definition: ValidatedTestDefinition = {
      id, name, source: input.source as string, assertions, expectedStatus: expectedStatus as ValidatedTestDefinition["expectedStatus"], limits: { maxInstructions },
      ...(input.description !== undefined ? { description: input.description as string } : {}),
      ...(input.expectedFaultCode !== undefined ? { expectedFaultCode: input.expectedFaultCode as TestFaultCode } : {}),
      ...(input.expectedAttempts !== undefined ? { expectedAttempts: input.expectedAttempts as number } : {}),
      ...(input.initialState !== undefined ? { initialState: { registers, memory } } : {}),
    };
    return { id, name, hasId, definition, diagnostics };
  } catch {
    error("test", "The definition could not be read as plain JSON data.");
    return { id, name, hasId, definition: null, diagnostics };
  }
}
