# Test-case engine (Day 12)

Stabilization, 24 October 2026: section navigation keeps the dialog header/close controls fixed and moves only the drawer content. Real Brave refresh restored an audit definition with exact name, source, description and A/B/PC/SP/attempt expectations; it passed with actual A=15 and three attempts, then correctly failed after expected A changed to 20. Editing removed its stale PASS. A real export completed and its 928-byte version 1 JSON was inspected. These observations do not establish native file-picker import acceptance: Windows URL verification blocked that interaction. Use Merge, inspect the confirmation and preserve existing tests during the remaining manual import check. The audit-created temporary test/export is identified in VERIFICATION.md; no browser storage was changed through scripts.

Day 14: expectations, assertion results, failure reasons and diagnostics display at most **100 items per page** with Previous/Next controls. All original outcomes remain stored; paging does not rerun tests or alter the live CPU. A large test can fail even when the current page contains only passing assertions; the overall result and failure-reason pages retain those failures. This limits DOM work, not the definition's existing assertion allowance. Validation/assembly remain synchronous within the existing input limits.

The React-independent engine is in `src/lib/testing/`. It uses the existing assembler, private CPU handles, checked setup/read APIs and bounded CPU batches. The Day 13 browser panel connects the engine; physical browser acceptance remains pending. Definitions and results are JSON data, with no stdin/stdout, callbacks, live-workspace handle or custom instruction semantics.

## Definition format

`TestDefinition` in `src/types/testing.ts` extends the existing `TestCase` contract. Each definition includes its own source; a future UI can insert the editor source into a selected definition before running it.

```ts
import type { TestDefinition } from "../src/types/testing.ts";

const addition: TestDefinition = {
  id: "addition-check",
  name: "Ten plus five",
  description: "Check one register and the real attempt count.",
  source: "ldc 10\nadc 5\nHALT",
  assertions: [
    { target: "register", register: "A", expected: 15 },
    { target: "memory", address: 65535, expected: 0 },
  ],
  expectedStatus: "halted", // default when omitted
  expectedAttempts: 3,       // optional exact cumulative count
  limits: { maxInstructions: 100000 }, // default CPU policy
};
```

| Field | Rules |
| --- | --- |
| `id`, `name` | Required nonempty strings; preserved exactly; suite IDs must be unique and case-sensitive |
| `source` | Required assembly string; never modified or evaluated as JavaScript |
| `description` | Optional text |
| `assertions` | Required array, possibly empty; completion is always checked |
| Register assertion | `target: "register"`, `register: "A" / "B" / "PC" / "SP"`, numeric `expected` |
| Memory assertion | `target: "memory"`, numeric word `address`, numeric signed `expected` |
| `expectedStatus` | `halted` (default), `error`, or `limit-reached`; nonterminal states are invalid expectations |
| `expectedFaultCode` | Required with `expectedStatus: "error"`; invalid with other expected statuses |
| `expectedAttempts` | Optional integer 0 through the configured instruction budget |
| `limits.maxInstructions` | Integer 1–10,000,000; omitted limits use 100,000 |
| `initialState.memory` | Optional array of `{ address, value }`, applied through checked writes after loading |
| `initialState.registers` | Optional existing checked literal A/B/PC/SP setup, using the same register ranges |

A/B and memory values are signed 32-bit integers: −2,147,483,648 through 2,147,483,647. PC and memory addresses are 0–65,535; SP is 0–65,536. Values are not coerced, rounded or wrapped during validation. Strings, fractions, NaN, infinity, unknown fields/registers/targets and accessor/function hooks are rejected. Arrays must be dense data arrays; maximum assertion count is 65,540 (all memory plus four registers), and initial memory has at most 65,536 cells. Duplicate register assertions, memory assertions or initial memory addresses are invalid even when their values agree. An initial value and an assertion for that same address are allowed.

Initial state is copied/validated before assembly. A successful load first restores normal registers/memory, then checked register and memory inputs are applied. An initial memory write may intentionally replace code because the ISA shares code/data memory; it changes only this test's private CPU memory, not the saved image, source or another test. An empty assembled image remains idle even if initial memory contains HALT. No arbitrary mutation hooks are accepted.

`validateTestDefinition(unknown)` returns diagnostics and either a normalized owned definition or `definition: null`. Definition diagnostics include a field path. Invalid definitions fail before assembly or CPU allocation.

## API and scheduling

```ts
import {
  runTestCase, runTestSuite,
  createTestExecution, createTestSuiteExecution,
} from "../src/lib/testing/index.ts";
import { PREDEFINED_TEST_CASES } from "../src/lib/testing/fixtures.ts";

const one = await runTestCase(addition);
const suite = await runTestSuite(PREDEFINED_TEST_CASES);

const abort = new AbortController();
const pending = runTestCase(addition, { signal: abort.signal });
// abort.abort(); // Cancels only unfinished work.
const completed = await pending;
```

The async APIs execute **at most 256 attempts per advance**, yielding with `setTimeout(0)` between unfinished batches and suite members. A suite starts at most one CPU at a time and preserves declaration order. Each case has its own source/image, initial memory, registers, budget and diagnostics. Separate explicitly started sessions are independent; their scheduling is the caller's responsibility. No testing API takes a debugger/workspace CPU.

For a future scheduler, `createTestExecution(definition)` and `createTestSuiteExecution(definitions)` provide `advance()`, `getProgress()` and `cancel(reason?)`. Creating a session captures/validates data but does not assemble or allocate a CPU. Call `advance()` from a timer/animation/worker scheduling boundary; do not drain it in a browser `while` loop. A suite advance processes at most one case/batch. Progress includes completion/count/status or current suite ID; final results are detached. CPU memory is released when each case finishes or cancels. No per-instruction memory snapshots or traces are collected.

Cancellation before the first advance assembles/executes nothing. After a batch, cancellation retains the actual partial final state, marks assertions SKIPPED, and forces FAIL. Abort signals also release an async wait on a custom scheduler; late scheduler resolution cannot resume a cancelled test. Completed results are final: subsequent advance/cancel calls return the same values, so completion wins over an abort that arrives afterward. Suite cancellation preserves completed results and reports remaining cases as failed/cancelled; invalid cases keep their validation failures. Scheduler rejection becomes cancellation/FAIL.

An optional `yieldControl(): Promise<void>` is available for host schedulers and deterministic tests. Browser integrations must yield an actual event-loop turn; `Promise.resolve()` alone does not let rendering/input run. Validation, assembly, setup, and final assertion evaluation are synchronous; CPU execution is cooperatively scheduled, not worker-preempted. Large sources/assertion lists can still take time in those phases.

## PASS/FAIL and diagnostics

Evaluation checks completion first, then an explicit fault code, optional attempts, and all declared state assertions. Equality is exact integer/string equality. Unlisted state is ignored. Every validated assertion gets a result: label, expected, actual, PASS/FAIL/SKIPPED and a readable message. Assembly failure/cancellation cannot supply invented register values; skipped actual values are null. Invalid definitions have no executable assertion outcomes and report their schema diagnostics instead.

- Default PASS requires real HALT plus all supplied expectations matching. Empty state assertions still check HALT.
- Unexpected runtime faults or limit exhaustion fail even if all requested registers happen to match.
- Expected faults require both `expectedStatus: "error"` and the exact `expectedFaultCode`. Supported execution codes are C001_INVALID_WORD, C002_INVALID_OPCODE, C003_INVALID_ENCODING, C004_INVALID_PC, C005_INVALID_ADDRESS, C012_INVALID_SP, C013_INVALID_SHIFT and C014_INVALID_TARGET. Request/setup-only codes cannot be expected as execution faults.
- Explicit `expectedStatus: "limit-reached"` permits budget exhaustion, but other assertions must match. HALT/fault retain their normal precedence on the final permitted attempt.
- Validation, assembly, setup, empty-image and cancellation failures always fail; they cannot satisfy a negative runtime test.

Example negative definition:

```json
{
  "id": "bad-access",
  "name": "Expected out-of-range load",
  "source": "ldc 65536\nldnl 0\nHALT",
  "expectedStatus": "error",
  "expectedFaultCode": "C005_INVALID_ADDRESS",
  "expectedAttempts": 2,
  "assertions": [{ "target": "register", "register": "PC", "expected": 1 }]
}
```

`TestResult` reports ID/name, overall `outcome`, failure phase/reasons, assembly status/word count/diagnostics, actual CPU status/count/budget, final registers and **only asserted memory cells**, individual assertions, runtime/definition diagnostics and cancellation. Codes and assembly/runtime source spans are retained. An explicitly expected fault can produce test PASS while keeping the actual error diagnostic; this means the negative test matched, not that the CPU halted successfully. Results contain no timestamps, random IDs, Maps, typed arrays or live CPU handles and round-trip through JSON.

Suites return total/passed/failed counts, ordered detailed results, cancellation and suite-format diagnostics. Invalid members count as failures; one failure never prevents later independent cases. All cases with a duplicate ID fail validation. A valid empty suite returns PASS with zero cases/CPU execution. A non-array suite returns FAIL with a suite diagnostic and zero declared cases.

## Verified predefined programs

`src/lib/testing/fixtures.ts` contains data only. All **14 fixtures** are verified through the test engine and independently through assemble/load/setup/run/snapshot integration tests.

| ID | Checked behavior / actual key result | CPU completion | Attempts |
| --- | --- | --- | --- |
| load-constant | A=42, PC=1 | halted | 2 |
| addition | A=15, B=10 | halted | 4 |
| subtraction | B−A gives A=13 | halted | 4 |
| signed-arithmetic | −5+2 gives A=−3 | halted | 3 |
| signed-overflow | max signed word +1 gives A=−2,147,483,648 | halted | 4 |
| memory-store-load | A=−7, M[100]=−7 | halted | 7 |
| stack-relative | A=42, SP=65,536, M[65,535]=42 | halted | 6 |
| conditional-branch | Taken zero branch skips 99; A=7 | halted | 4 |
| countdown-loop | A=0, PC=4 | halted | 12 |
| call-return | A=B=7, PC=2 | halted | 4 |
| halt | A=B=PC=0, SP=65,536 | halted | 1 |
| invalid-memory | Explicitly expected C005_INVALID_ADDRESS at PC=1 | error | 2 |
| instruction-limit | Explicit limit outcome, PC=0 | limit-reached | 16 |
| initial-memory | Custom M[100]=1,234; A=1,234 | halted | 3 |

All 14 produce test PASS. Separately, `ldc 10 / adc 5 / HALT` with expected A=20 produces test **FAIL**, expected 20 / actual 15, with actual halted status and three attempts. This intentional mismatch is verified by a passing automated regression test.

## Boundary and limitations

The Day 13 Test Cases panel runs individual fixtures/custom definitions or all cases in either section. Expand Program & expectations and Result for real source, checks, diagnostics and expected/actual outcomes. Execution reuses Day 12 incremental sessions with one private CPU and one generation-checked timer, up to 256 attempts per callback and an 8 ms requested delay. Cancel/close stops unfinished work; late callbacks cannot publish results. Completed results remain valid until edits or panel closure. The live editor/debugger is independent.

Create copies the editor source once. Custom fields include name, description, source, optional A/B/PC/SP, memory expectations, completion/fault code, attempts, budget and initial memory. Memory inputs use one `address = value` per line. Decimal/signed hexadecimal values are exact; blank optional registers are ignored and zero is asserted. HALT alone is a meaningful assertion under the existing policy. Save validates assembly, numeric bounds, duplicate names/addresses and status/code combinations. Imported schema-valid assembly may still fail when run. Imported initial registers are preserved/displayed but not editable through the form. Edit, Duplicate, confirmed Delete and explicit Copy current editor source are supported.

Storage/export format: `{ "format": "assembly-emulator-tests", "version": 1, "tests": [...] }`; localStorage key `assembly-emulator:tests:v1`. Limits: 100 custom tests, 2 MiB library/import, 1 MiB source per case. Definitions persist only when changed; results never persist. Corrupt storage recovers valid entries while protecting the original. Changes detected from another tab also block overwrite. Download original saved data and export current tests before confirmed replacement. Quota/unavailable storage leaves in-memory data intact but closing/refreshing may lose it.

Export requests `assembly-emulator-tests.json`. Import validates UTF-8 JSON and the entire schema before confirmation. Merge preserves existing cases and deterministically renames conflicting IDs/names; Replace replaces custom definitions. Internal duplicate IDs/names reject the file. Invalid imports preserve current tests and imports never execute automatically. Fixtures remain separate.

Validation, assembly and rendering are synchronous; CPU execution yields. Browser interactions and Node 24 verification remain pending (see VERIFICATION.md). No stdin/stdout, time travel, external storage or Day 14 work is included.
