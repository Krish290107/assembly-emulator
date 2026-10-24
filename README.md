# Assembly Emulator

A browser-local assembly IDE for learning how source code becomes machine instructions and changes CPU state. Write programs for a documented educational CPU, assemble them, debug execution and check results with isolated test cases.

[Live application](https://assembly-emulator.vercel.app) · [Repository](https://github.com/Krish290107/assembly-emulator) · [ISA reference](docs/ISA_DESIGN.md) · [Testing API/schema](docs/TESTING.md) · [Verification evidence](VERIFICATION.md)

Day 15 prepares the project and Node 24 CI for release. **Node 24 CI and the production deployment matching this revision remain PENDING.** A live URL does not establish which local changes are deployed. See the [manual release procedure](docs/RELEASE.md).

## Features

- Monaco editor with ISA highlighting, diagnostics, undo/redo, find and a plain-text fallback.
- Create, UTF-8 ASM/TXT upload, source download, examples and browser-local draft autosave.
- Two-pass assembler with labels, source maps, structured diagnostics and little-endian machine code.
- All 19 CPU instructions, checked memory/register access, atomic faults and cumulative execution limits.
- Assemble, Run, Step, Pause and Reset; source breakpoints, Run to Cursor and three execution speeds.
- Live registers, bounded signed/hex memory inspector, disassembly and changed-value indicators.
- A 500-attempt execution trace with filters, historical inspection, navigation and JSON export.
- Fourteen predefined fixtures and custom tests with snapshots, exact assertions, expected faults and cancellation.
- Custom-test editing, duplication, confirmed deletion, local persistence and versioned JSON import/export.
- Dark responsive workbench, keyboard controls, custom-library search/10-case pages and 100-item pages for large test expectations/results.

## Technology and architecture

Next.js App Router, React, TypeScript, Tailwind CSS, Monaco, Lucide and ESLint. Tests use Node's native test runner and TypeScript stripping, without an additional browser test framework.

Parser, assembler, CPU and test engine are React-independent TypeScript modules. The workspace controller owns the live debugger CPU; test cases use separate private CPUs. Bounded scheduled batches publish compact views rather than copying all memory every instruction. There is no application backend, authentication, database, analytics or external instruction-execution service.

```text
src/lib/assembler/   ISA metadata, parsing, symbols, encoding and both passes
src/lib/cpu/         Private state, checked access, decoding and execution
src/lib/workspace/   Scheduler, breakpoints, cursor goals, trace and display views
src/lib/testing/     Validation, assertions, isolated sessions, fixtures and management
src/lib/editor/      Source documents, autosave, language and panel navigation
src/components/     Editor, toolbars, inspectors, documentation and test panels
tests/              Real engine integration, controller and UI-render regressions
docs/               ISA, testing contracts and manual release guide
```

## CPU and assembly language

| Item | ISA v1 behavior |
| --- | --- |
| A, B | Signed 32-bit registers; arithmetic wraps in two's complement |
| Memory | 65,536 signed words, addresses 0–65,535; shared code/data/stack |
| PC | Next instruction word address, 0–65,535 |
| SP | Checked pointer, 0–65,536; initial 65,536 is the empty descending stack |
| Initial registers | A=B=PC=0; SP=65,536 |
| Instruction | Low 8-bit opcode + signed 24-bit operand; four little-endian bytes |
| Operand range | −8,388,608 through 8,388,607 |
| Branch/call labels | Displacement relative to the next instruction |
| HALT | Counts one attempt and retains its PC |
| Fault | Counts the attempt; register/memory changes do not commit |
| Budget | Default 100,000 attempts; configurable 1–10,000,000 |

Opcodes, in order:

```text
0 ldc    1 adc    2 ldl    3 stl    4 ldnl   5 stnl
6 add    7 sub    8 shl    9 shr   10 adj   11 a2sp
12 sp2a  13 call  14 return 15 brz  16 brlz 17 br   18 HALT
```

Use one instruction per line, case-insensitive mnemonics, case-sensitive labels, semicolon comments and signed decimal/hex literals. Labels may precede instructions and reference later labels. The separate `data` directive emits a signed 32-bit word; it is not a CPU opcode. MOV, CMP, PUSH and stdin/stdout are unsupported. Shift counts must be 0–31. See the [normative ISA](docs/ISA_DESIGN.md) for exact operands, register effects, call/return links and fault rules.

## Run locally

Use **Node.js 24.x** and npm 10+. No private environment variables or credentials are needed. On a fresh checkout:

```powershell
git clone https://github.com/Krish290107/assembly-emulator.git
Set-Location assembly-emulator
node --version
npm --version
npm ci
npm run dev
```

Open `http://localhost:3000`. In an existing checkout, run commands from the project root. `npm ci` installs locked dependencies into `node_modules` and uses npm's normal cache; it does not install Node. It is unnecessary merely to verify an already installed working environment.

Monaco and its worker are served locally. The install/predev/prebuild script prepares ignored `public/monaco` assets from installed packages and aligns Monaco's vendored ESM sanitizer with the installed DOMPurify override. No CDN, font download or private service is needed for the build. Review that package-layout integration when upgrading Monaco.

For production, stop the dev server before using the same checkout's build output:

```powershell
npm run build
npm start
```

## Editor and debugger workflow

Write source, upload an `.asm`/`.txt` file up to 1 MiB, or choose an example. **Assemble** validates and loads without execution; failures show line/column diagnostics. Highlighting alone does not validate assembly. Source edits invalidate the loaded image immediately: reassemble before running.

| Action | Shortcut / behavior |
| --- | --- |
| Run / Resume | F5; terminal programs require Reset/reassembly |
| Step | F10; one attempted instruction, including at a breakpoint |
| Reset | Shift+F5; restore image/registers, clear attempts/history, speed Normal |
| Toggle breakpoint | F9 in source editor, or click Monaco glyph gutter |
| Download source | Ctrl+S |
| Create blank source | Ctrl+N, with replacement guard |
| Monaco Tab focus mode | Ctrl+M |

Shortcuts are scoped to the ready IDE and excluded from dialogs/unrelated inputs. Held debugger keys do not repeat commands. Breakpoints stop before execution without consuming attempts; Resume bypasses the current stop once and triggers again on later visits. Reset preserves breakpoint definitions; source edits clear them. Run to Cursor is available from the toolbar/Monaco context menu and does not create permanent breakpoints.

Slow/Normal/Fast change scheduling only (maximum 1/64/512 attempts per batch, requested delays 200/32/16 ms). These are not guaranteed execution rates. Pause, Reset, edits and leaving the workspace cancel stale callbacks.

Memory shows at most 32 cells with signed/hex values. Jump accepts decimal/hex addresses, including 0 and 65,535. Program, PC, SP and page controls navigate bounded windows. Disassembly displays at most 64 current words. Modified words are marked and unreliable source highlighting is suppressed.

Execution Trace retains the last **500 attempted instructions**, including HALT/faults, with before/after registers, committed memory deltas and diagnostics. Select rows or use native buttons/Previous/Next; filters change presentation only. Inspection never changes the live CPU. Download Trace exports all retained entries and discarded-count metadata; older/cleared history cannot be recovered. There is no time-travel execution.

## Test cases and local data

Open **Test Cases** to inspect/run one predefined fixture or **Run all predefined (14)**. Fixtures cover arithmetic, signed overflow, memory/stack access, branches, a countdown, call/return, HALT, an expected fault/limit and initial memory.

**Create custom test** copies the current editor source into a snapshot. Supply a unique name, optional description and selected A/B/PC/SP or memory expectations. Blank register fields are unasserted; zero is explicit. Memory fields use one `address = value` per line. Optional attempts, budgets and initial memory inputs use checked architecture ranges. Copy current editor source replaces a snapshot only on request. Edit invalidates its old result; Duplicate and confirmed Delete manage definitions.

Optional **Initial A/B/PC/SP** fields set inputs after program loading, before execution; they are separate from expected registers. Blank uses the CPU default and clears an imported input; zero is explicit. A/B accept signed 32-bit values, PC 0–65,535 and SP 0–65,536. The version-1 JSON schema is unchanged. Search custom tests by name/description and browse ten cards per page; **Run all custom** still runs the full library in declaration order. Program/expectation and passing-result details mount only when expanded.

Default completion requires HALT. Expected faults require `error` and the exact diagnostic code, such as `C005_INVALID_ADDRESS`; expected limits require `limit-reached`. Unexpected faults/limits, assembly/setup failure and cancellation cannot pass. Every case gets a fresh CPU, independent of editor/debugger state. Suites run sequentially, yielding after at most 256 attempts per callback. Cancel or close the panel to stop unfinished work.

Custom definitions save locally when changed; results are session-only. Export requests `assembly-emulator-tests.json`, containing `{ "format": "assembly-emulator-tests", "version": 1, "tests": [...] }`. Import accepts UTF-8 `.json` up to **2 MiB**, **100 cases**, **1 MiB source per case**. Merge retains existing cases and renames conflicts; Replace requires confirmation. Duplicate IDs/names within a file reject the import. Imports never execute automatically. Full schema/API: [TESTING.md](docs/TESTING.md).

The browser stores one current source draft and a separate custom-test collection. Storage belongs to the browser/profile/origin, can be cleared or fail, and is not a backup/version history. Source autosave checks its saved baseline before writes, including page-exit/visibility flushes, and listens for other-tab changes. A conflict pauses autosave while keeping current editor text. Use **Download editor backup**, then confirmed **Reload saved draft** or **Overwrite saved draft**; editing alone does not remove protection. Corrupt source drafts also require explicit recovery. These checks do not merge edits or provide transactional multi-tab synchronization. Corrupt/newer saved tests are protected against automatic overwrite; quota failures keep changes in memory. Export backups before explicitly replacing protected data. Closing a panel discards unsaved form edits and result history.

## Text demo

### A. Basic execution

Paste this into the editor (download existing work first), then select **Assemble**, **Run**:

```asm
ldc 10
adc 5
HALT
```

Expected: **A=15, B=0, PC=2, SP=65,536, three attempts, halted**. Reset and Step: first attempt gives A=10/PC=1; second gives A=15/PC=2; third executes HALT at PC=2. HALT counts as an instruction attempt.

### B. Debugging

With demo A assembled/reset, toggle a breakpoint on line 2 using the gutter or F9. Run stops before `adc 5`, with A=10 and one attempt. Resume finishes with A=15 and three attempts. Reset, remove that breakpoint, put the cursor on line 3 and select **Run to cursor**: pause before HALT at PC=2/two attempts. Step executes HALT. Open Execution Trace and select the first attempt: historical A=10 while the live CPU stays at A=15. Try filters and Download Trace.

### C. Memory

```asm
ldc 42
ldc 100
stnl 0
HALT
```

The second `ldc` leaves A=100 and B=42. `stnl 0` writes B to address A+0, so **Memory[100]=42**. Assemble/Run, then jump to `100` (`0x64`) in Memory: signed 42 and hex `0000002A`. The program halts at PC=3 after four attempts. Step through the store to inspect its changed-memory indicator and trace write delta.

### D. Test cases

1. Run all 14 predefined fixtures. Expected negative fault/limit cases count as PASS when matched.
2. Put demo A in the editor. Create `Addition demo`, expected A=15, completion HALT and attempts=3; save and Run. Expect PASS.
3. Edit expected A to 20. Save clears the old result. Run: FAIL, expected 20, actual 15.
4. Add/duplicate a second custom case with a distinct name, then **Run all custom**. Totals reflect real outcomes.
5. Export custom tests, inspect JSON, then import with **Merge** and review the rename/count confirmation. Cancel confirmation when merely demonstrating it to avoid duplicates. Use Replace only when deliberately replacing backed-up data. Invalid files must preserve the collection.

## Verification and CI

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
git diff --check
```

The 512-test baseline covers real engine integration, faults/limits, cancellation, debugger isolation, storage/JSON boundaries and rendered controls. UI event/timer tests do not replace physical browser checks. Local verification uses existing Node **26.12.1 / npm 11.20.0**, outside the Node 24 target. Exact outcomes and remaining checks: [VERIFICATION.md](VERIFICATION.md).

[CI workflow](.github/workflows/ci.yml) runs on pushes to `main` and pull requests targeting `main`: Ubuntu, `actions/checkout@v7`, `actions/setup-node@v7`, Node 24.x, `npm ci`, lint, types, tests, build and production audit. It has read-only permissions, no persisted Git credentials, no package caching, a 20-minute timeout and no deployment/release steps or custom secrets.

After you push, GitHub-hosted runners may download actions, Node and locked npm dependencies to their temporary workspace/cache. Those remote downloads do not install anything on Windows. **Node 24 CI remains PENDING until the real workflow succeeds for your commit.**

## Limits and future possibilities

Assembly success does not prove runtime validity. Memory/control-flow checks occur during execution; data words may decode as instructions. Validation/assembly/serialization are synchronous within input limits, while CPU execution yields. Runtime state and breakpoints are not restored from draft storage. Files are UTF-8; download notices confirm requests rather than completed saves.

There is no stdin/stdout model, arbitrary ISA extension, time travel, watchpoint engine, backend storage or multi-tab synchronization. Future possibilities include worker-based parsing/execution and richer persistence, subject to separate design/tests. Browser acceptance and deployment evidence limits are recorded in VERIFICATION.md; local success does not imply production verification.
