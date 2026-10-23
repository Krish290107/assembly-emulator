import type { AssemblyResult, CpuState, Operand, StateAssertion } from "../src/types/engine";

const assembled: AssemblyResult = { status: "success", program: { bytes: new Uint8Array(), origin: 0, sourceMap: [] }, symbols: new Map(), diagnostics: [] };
const failed: AssemblyResult = { status: "failure", diagnostics: [{ severity: "error", code: "draft", message: "Type fixture only" }] };
// @ts-expect-error A successful result requires machine code and symbols.
const missingProgram: AssemblyResult = { status: "success", diagnostics: [] };
// @ts-expect-error Failed assembly cannot expose executable output.
const executableFailure: AssemblyResult = { status: "failure", program: assembled.program, diagnostics: [] };
// @ts-expect-error Complete CPU state requires all four registers.
const incompleteCpu: CpuState = { registers: { A: 0 }, memory: new Uint8Array() };
// @ts-expect-error Register assertions use only declared register names.
const unknownRegister: StateAssertion = { target: "register", register: "X", expected: 0 };
// @ts-expect-error Memory assertions require an address.
const missingAddress: StateAssertion = { target: "memory", expected: 0 };
// @ts-expect-error An operand requires its source range.
const missingLocation: Operand = { kind: "immediate", value: 0 };

void [assembled, failed, missingProgram, executableFailure, incompleteCpu, unknownRegister, missingAddress, missingLocation];
