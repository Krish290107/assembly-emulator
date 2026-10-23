import type { TestDefinition, TestResult } from "../src/types/testing";
import { runTestCase } from "../src/lib/testing/index";

const valid: TestDefinition = { id: "example", name: "Example", source: "HALT", assertions: [], expectedAttempts: 1, initialState: { memory: [{ address: 65535, value: -1 }] } };
const result: Promise<TestResult> = runTestCase(valid);
// @ts-expect-error Nonterminal execution states are not supported expectations.
const nonterminal: TestDefinition = { ...valid, expectedStatus: "paused" };
// @ts-expect-error stdin/stdout do not exist in the ISA's test contract.
const stdin: TestDefinition = { ...valid, stdin: "hello" };
// @ts-expect-error Unsupported CPU fault codes are rejected by the definition type.
const fault: TestDefinition = { ...valid, expectedStatus: "error", expectedFaultCode: "C999_UNKNOWN" };
void [result, nonterminal, stdin, fault];
