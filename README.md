# Assembly Emulator

Days 1–10 of a 15-day project: a browser-local assembly workspace with a finalized 19-instruction ISA, complete two-pass assembler, live CPU execution, source breakpoints, Run to Cursor, and bounded execution tracing with filters/navigation. **Time travel, watchpoints, and the custom test-case runner are not implemented.** [ISA_DESIGN.md](docs/ISA_DESIGN.md) remains the authoritative architecture and engine reference; Day 10 preserves its semantics.

## Stack and setup

Next.js App Router, React, TypeScript, Tailwind CSS, Monaco (`@monaco-editor/react`), Lucide, ESLint, and npm. Use Node.js **24.x** and npm 10+; the native test runner uses Node's built-in TypeScript stripping. The bounded Node engine selects Vercel's supported 24.x major and overrides a differing dashboard selection. No dashboard settings are changed by editing this repository. Latest local checks use the existing Node 26.12.1 / npm 11.20.0; Node 26 is outside the declared target, and Node 24 verification remains pending. Switch to Node 24 before a fresh dependency installation to avoid an engine mismatch warning.

```powershell
cd C:\Zekrui\assembly-emulator
npm ci
npm run dev
```

Open http://localhost:3000. To verify and run a production build:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Monaco is bundled from ESM source, and its plain-text worker is copied from the npm package into generated `public/monaco` during installation and before development/build. The editor and worker are served locally, with no CDN or external API. Generated assets are ignored by Git. No fonts or other runtime assets require an external service. A DOMPurify override selects a patched release. The preparation script also replaces Monaco's vendored ESM sanitizer with that installed release (preserving its license), because an npm override alone does not update the vendored copy. Review this package-layout integration when upgrading Monaco.

## Implemented features

- Compact dark IDE, responsive CPU/memory inspectors, resizable results panel, and keyboard-accessible result tabs.
- Client-only Monaco with line numbers, ISA v1 highlighting, find, undo, indentation, and normal keyboard editing. Ctrl+M toggles Tab focus mode. Mount timeout or import/render failure offers a plain-text fallback with cursor tracking. Accepted file replacement starts fresh undo history; ordinary edits retain undo/redo.
- Create a blank file; upload UTF-8 `.asm`/`.txt` files up to and including 1 MB; download current source as `.asm`. Malformed UTF-8, binary controls, invalid extensions, oversized files, and read failures show a notice. Download filenames are normalized and bounded, including Windows reserved names.
- Ctrl+S requests a download; Ctrl+N uses guarded Create. Shortcuts apply only while focus is in the ready IDE, outside dialogs and unrelated inputs (including Monaco find fields), and pause during upload. F5/F10 are not bound to execution.
- Browser-local draft autosave after 400 ms, restoration after refresh, and saving on page hide. Storage failures show a notice. An unreadable/corrupt draft is not overwritten until you edit or accept a replacement. Downloads provide a portable backup.
- Create/upload/example replacement asks for confirmation when nonempty source differs from the last download requested in this session. Restored nonempty drafts are protected too. Cancelling keeps current source; undo history is not a substitute for a backup.
- Separate closeable documentation and Test Cases panels with section jump navigation. Native modal dialogs provide focus containment, Escape dismissal, and focus restoration. Six guide sections include all 19 opcode definitions, syntax, architecture, and planned register/memory assertions.
- Parser-valid ISA v1 examples: addition, a countdown with forward/backward labels, and a full-width data constant. Existing saved source is preserved; older MOV/HLT drafts are not migrated or deleted.
- Real CPU registers/status/attempts, bounded memory and machine-code windows, source diagnostics, and high-level execution messages. No fabricated execution data or custom test pass/fail results.

Assemble, Run, Step, Pause, Reset, source breakpoints, and Slow/Normal/Fast speed are connected to the real engines. Planned test actions remain disabled. Memory shows signed decimal and hexadecimal together. Highlighting does not validate source. Download status confirms a browser download request, not that the user saved a file.

## Browser workflow

1. Write source or choose an example, then **Assemble**. Success reports total instruction/data words, bytes, symbols, and a loaded CPU with zero attempts. Failure clears the executable image and shows line/column diagnostics in Errors and Monaco.
2. **Step** attempts one instruction. **Run** continues the current ready/paused image; **Pause** cancels pending work before another batch. HALT, faults, and exhausted budgets require **Reset** or reassembly to restart. The reference `ldc 10`, `adc 5`, `HALT` finishes with A=15, B=0, PC=2, SP=65,536, three attempts, halted.
3. **Reset** restores the loaded image/registers and clears attempts/runtime diagnostics without changing source. Editing or accepting Create/upload/example replacement clears the CPU and binary immediately; Run/Step require reassembly. Undoing back to old source does not resurrect stale machine state.
4. Inspect A/B/PC/SP and attempt count. Memory displays at most 32 signed/hex words; navigate by decimal/0x address, Previous/Next, PC, or SP (empty-stack SP shows the last 32 cells). Disassembly pages at most 64 current-memory words with decoded bits and original source lines. Data may decode as valid instructions. Modified words are marked; current-line editor highlighting is suppressed when bits no longer match the original image.

The controller owns one private CPU session. Slow uses 1 attempt/200 ms, Normal 64/32 ms, and Fast 512/16 ms; these are maximum batches and timer delays, not guaranteed instruction rates. Every batch yields through a client timer, and pause/reset/reassembly/source changes/unmount invalidate old callbacks. Speed changes scheduling only; CPU semantics and its cumulative 100,000-attempt default budget are unchanged. The UI displays Running while scheduled execution is active; the CPU is paused between batches. Pausing before the first batch leaves the unexecuted CPU ready.

Visualization uses a detached compact CPU overview plus checked reads for the visible windows, with no full memory copy per instruction/render. Changed values show differences since the previous refresh. Output retains only 20 event messages; Execution Trace holds bounded instruction history. Test Cases remains a separate closeable panel with runner/actions planned for Days 12–13. The plain-text editor fallback retains execution and Errors output but has no Monaco markers/decorations. Browser interaction checks pending for this environment are listed in `VERIFICATION.md`.

## Debugging

- Click Monaco's glyph gutter or press **F9** to toggle a source breakpoint. Open **Execution Trace** or the small debugger toolbar button to enter a line number, enable/disable, remove, clear, or navigate to breakpoints. This keyboard-accessible list works with the fallback editor too. Enabled dots are red, disabled dots outlined, unresolved dots dim; the current instruction has a separate blue highlight.
- Assembly resolves only exact CPU instruction lines to validated word addresses. Inline labels work; label-only, comment, blank, and `data` lines remain non-executable with an explanation. Definitions before assembly are pending. Addresses are deduplicated. **Reset preserves definitions and enabled flags**, while **source edits/replacements clear them**. Reassembling unchanged source re-resolves definitions. Breakpoints are session-local, not persisted with drafts.
- **Run** stops before an enabled breakpoint without changing CPU state, consuming an attempt, or adding a trace entry. Run again passes the stopped address once; a later loop revisit still stops. **Step** attempts exactly one instruction even at a breakpoint. The existing generation token and single timer cancel stale work. The controller checks PC before every attempt within each bounded batch and publishes the view once per batch.
- Each real attempt records its cumulative number, pre-execution PC, actual fetched word and decoded operand, compact before/after registers, any committed memory-write delta, result, and fault diagnostic. HALT and faulting attempts count; budget checks and breakpoint stops do not. No full memory snapshot is retained per attempt. `stepCpuTraced` extends the shared CPU attempt/commit path; the controller owns history separately from the legacy CPU snapshot's empty `trace` collection.
- A fixed ring retains the **last 500 attempts**, drops the oldest, and displays the discarded count. Clear trace empties history without changing CPU state or cumulative attempts. Reset, reassembly and source edits clear history. Selecting a retained step shows register changes, stores, source and fault details; Go to source moves the editor cursor. **Inspection does not rewind or replay the CPU.**
- Self-modified fetched bits are marked `*`, comparing with reset memory (including zero-filled cells beyond the image). Breakpoints stay bound to their original instruction word addresses and show a modification notice. Trace source links and current-line highlights require bits matching the assembled image; modified history has no source link. Source statements can include numeric/symbolic operands while trace instructions show the actual decoded numeric operand.

### Day 10 Run to Cursor and trace navigation

Place the editor cursor on an instruction line, then use **Run to cursor** in the main execution toolbar or Monaco's **Run to Cursor** context-menu action. The toolbar also works with the fallback editor and opens Execution Trace for target/status feedback. Assembly must be current and the CPU ready or paused. Invalid, comment, blank, label-only and `data` lines are rejected with an explanation; inline instructions resolve to their exact word address. A target at the current PC stops immediately without a timer or attempt.

The temporary target never creates or changes permanent breakpoints. The existing scheduler stops **before** that instruction; the stop consumes no attempt and creates no trace entry. Earlier breakpoints stop first, leaving the goal pending; **Run** resumes toward it. **Pause** (also enabled at an intervening breakpoint), **Cancel target**, **Step**, Reset, reassembly, source replacement/edit and unmount cancel the pending goal. Speed changes retain it. Step then attempts exactly one instruction. HALT, faults and cumulative limits terminate normally and clear the goal; unreachable targets do not extend the budget. If the final permitted instruction reaches the target, its limit result takes precedence. A target sharing a permanent breakpoint stops once; Resume bypasses that address once and subsequent loop visits trigger the permanent breakpoint. Modified target words stay at their original assembled address and display a notice.

Execution Trace offers **All attempts**, **Memory writes**, **Branch / control flow**, and **Faults / terminal events**. Writes means committed stores (including stores of an unchanged value). Control flow includes decoded call, return, brz, brlz, br and HALT, including untaken conditional branches. Terminal events include faults, HALT and limit-reached attempts. Classification uses the actual fetched instruction/result, not source text. Filters never change the 500-entry ring, CPU or cumulative attempt IDs.

Click anywhere on a row, or activate its native Step button using Enter/Space, to highlight it and reveal historical details. **Previous/Next** select the nearest matching attempt before/after the selection; without a selection Next chooses the first match. An empty filter explains that nothing matches. If a filter hides the selected row, its details remain available with a notice. If retention evicts the selected attempt, its details disappear. Go to source remains available only for reliable mappings. Selection does not rewind execution, and execution refreshes do not repeatedly scroll the details.

## Day 3 parser

`parseSource(source)` in `src/lib/assembler/parser.ts` scans text into label-only, instruction, and data statements with structured diagnostics and exclusive source spans. It handles comments, line endings, case-insensitive mnemonics, case-sensitive labels, signed decimal/hex literals, operand counts/ranges, and recovery after malformed lines. Valid lines remain available when other lines fail. It neither resolves symbols nor emits machine code. The full pipeline displays its diagnostics when Assemble runs; parsing is not performed on every keystroke.

ISA v1 uses signed 32-bit A/B and memory words, 65,536 word-addressed cells, and a descending stack with initial SP 65,536. Instructions carry an 8-bit low opcode and signed 24-bit operand, serialized as four little-endian bytes by the assembler. Branch/call symbol references are relative to the next instruction. The `data` directive holds one signed 32-bit literal and is separate from the 19 CPU opcodes. Full CPU behavior, including call/return links, wrapping, shifts, faults, and execution limits, is in the ISA document.

## Day 4 first assembler pass

`firstPass(parseSource(source))` in `src/lib/assembler/first-pass.ts` returns a case-sensitive symbol map with source ranges, located statements, word count, diagnostics, success/failure status, and unresolved references tagged for future absolute/relative resolution. It accepts forward references and distinct labels at one location. Duplicate definitions report both locations and retain the first binding.

Allocation starts at word 0; each valid instruction/data consumes one word, and labels consume none. Malformed parser lines contribute neither words nor labels; recovered valid lines remain inspectable, but any error prevents success. Exactly 65,536 words fit. Overflow and labels at address 65,536 are rejected without wrapping. Partial results include only in-range symbols/statements, while the word count includes excess words. All symbol operands stay unresolved in this pass; the full pipeline resolves them next.

## Day 5 complete assembler

Import `assembleSource` from `src/lib/assembler/index.ts`. It runs the existing parser and first pass, then `secondPass` to resolve operands and serialize the image. Absolute symbols become word addresses; call/brz/brlz/br symbols become offsets from the next instruction. Numeric operands retain their literal value. The encoder validates signed 24-bit instruction operands and signed 32-bit data before writing four little-endian bytes per word. Operand-free instructions encode a zero payload.

```ts
import { assembleSource } from "./src/lib/assembler/index.ts";

const result = assembleSource("ldc 10\nadc 5\nHALT");
if (result.status === "success") {
  console.log([...result.program.bytes]);
  // [0, 10, 0, 0, 1, 5, 0, 0, 18, 0, 0, 0]
}
```

Those words are `00000A00`, `00000501`, and `00000012` in hex. The success result contains origin-zero `Uint8Array` bytes, a symbol map, diagnostics, and one source-map entry per emitted word (byte offsets 0/4/8 here, length 4, full source-statement ranges). Labels emit no bytes. Failures collect source-specific diagnostics and expose neither a program nor symbols. Undefined references are checked independently; parser/first-pass errors stop encoding. Empty source assembles successfully to zero bytes, which is not a runnable program. Data-only images are legal assembly.

The API is pure and independent of React/browser APIs. The browser controller calls it from Assemble, then loads the image without execution. Existing file handling, autosave, and replacement guards remain independent.

## Day 6 CPU foundation

`src/lib/cpu/index.ts` exposes `createCpu`, `loadProgram`, `resetCpu`, `getCpuSnapshot`, `decodeInstruction`, and `fetchInstruction`, plus checked memory/register setup and execution-limit helpers. Cold state is A/B/PC 0, SP 65,536, zero-filled `Int32Array(65536)`, zero attempts, and idle status. Memory is word-addressed; SP alone may point one past its end.

Loading validates origin 0, aligned byte length, and the 262,144-byte capacity before changing state. It owns a copy of the bytes and source mappings, reads little-endian signed words, clears unused memory, resets registers/count, and sets ready for a nonempty image or idle for an empty one. Failed loads preserve the prior state and reset image. Reset restores the latest successful image, clears memory/register changes and bookkeeping collections, and retains the configured execution limit.

```ts
import { assembleSource } from "./src/lib/assembler/index.ts";
import { createCpu, loadProgram, readMemory, fetchInstruction } from "./src/lib/cpu/index.ts";

const assembled = assembleSource("ldc 10\nHALT");
const cpu = createCpu();
if (assembled.status === "success" && loadProgram(cpu, assembled.program).ok) {
  console.log(readMemory(cpu, 0)); // { ok: true, value: 2560 }
  console.log(fetchInstruction(cpu));
  // { ok: true, value: { word: 2560, opcode: 0, mnemonic: "ldc", operand: 10 } }
}
```

This inspects loaded bits without executing `ldc`: A/B/PC remain 0, SP remains 65,536, and attempts remain 0. Decoding checks all 19 opcodes, signed 24-bit operands, and zero payloads on operand-free instructions. Standalone decoding accepts signed or unsigned 32-bit representations and preserves the input number; fetched words are signed. Invalid data encodings may load successfully and fail only when decoded.

CPU handles keep memory and the saved image private. `getCpuSnapshot` explicitly deep-copies state, including 256 KiB memory and program metadata; changing the snapshot or original binary cannot corrupt the CPU. `readMemory`/`writeMemory` and `writeRegister` validate values before access. These setup/inspection operations return `{ ok: true, value }` or a structured `{ ok: false, diagnostic }`; reset returns void. Fetch defaults to PC, accepts an optional word address for inspection, and changes no state. Execution limits default to 100,000 or a configured integer 1–10,000,000. See the ISA document for signatures, ownership details, and diagnostic codes.

## Day 7 instruction execution

`stepCpu(cpu)` executes one attempted instruction. `runCpuBatch(cpu, maxSteps)` uses the same semantics for an explicit integer bound of 1–10,000,000 attempts, stopping earlier on HALT, fault, or the cumulative CPU limit. Both return a detached `{ status, attempts, attemptedInstructions, diagnostics }` summary without copying memory. `attempts` counts this call; `attemptedInstructions` is the cumulative count. Ordinary Step or batch completion leaves the CPU paused; ready/paused CPUs can continue. Idle and terminal CPUs execute nothing. Invalid batch bounds return a request diagnostic without changing CPU state.

```ts
import { assembleSource } from "./src/lib/assembler/index.ts";
import { createCpu, loadProgram, runCpuBatch, getCpuSnapshot } from "./src/lib/cpu/index.ts";

const assembled = assembleSource("ldc 10\nadc 5\nHALT");
const cpu = createCpu();
if (assembled.status === "success" && loadProgram(cpu, assembled.program).ok) {
  const result = runCpuBatch(cpu, 10);
  console.log(result.status, result.attemptedInstructions); // halted, 3
  console.log(getCpuSnapshot(cpu).registers); // { A: 15, B: 0, PC: 2, SP: 65536 }
}
```

All 19 instruction effects follow the unchanged ISA table. Arithmetic wraps signed 32-bit values; shifts validate counts 0–31 before bit operations. Addresses, SP, and next PC are checked as mathematical integers. Effects use old registers and commit together only after validation, including pending memory stores. A fault counts its attempt, records a structured diagnostic, and sets error while preserving registers/memory at the faulting PC. HALT preserves its PC and counts one attempt. Diagnostics include word/address/target and source range when available. The Day 9 traced API captures compact attempt records from this same execution path.

Step and batches share one budget across pause/resume. An ordinary instruction using the final attempt commits then stops with limit-reached; HALT/fault take precedence. Exhausted budgets are checked before another fetch. Reset/load are the only operations that reset attempts and restore execution eligibility. Raising a terminal CPU's limit or changing registers/memory does not resume it; limits cannot be lowered below attempts already counted. Engine batches are synchronous; the controller schedules bounded breakpoint-aware work between browser turns.

## Architecture

```text
src/app/                  App Router page, metadata, global styles
src/components/editor/    Client-loaded Monaco and editor frame
src/components/layout/    Workspace composition and status bar
src/components/panels/    CPU, memory, results, documentation, tests
src/components/toolbar/   File actions and live execution controls
src/lib/editor/           Document I/O, autosave hook, examples, language
src/lib/assembler/        ISA metadata, scanner, parser, both passes, and public API
src/lib/cpu/              Private CPU state, loading/reset, validation, decode, and execution
src/lib/workspace/        Execution controller, breakpoint mapping, trace ring, markers, React adapter
src/types/                UI/source types and React-independent engine contracts
scripts/                  Local Monaco asset preparation
tests/                    Node tests for documents, engines, UI handlers, and workspace integration
```

UI state stays in React; the client controller connects a private CPU handle to bounded display projections through an external-store hook. There is no state-management library, authentication, database, backend, or external API. The standard Next.js build is compatible with Vercel; no deployment setup or account operations are performed.

## Verification and limitations

`npm test` preserves all 302 Day 1–9 tests and adds Run to Cursor, complex breakpoint/cancellation/lifecycle interactions, terminal precedence, trace filtering/navigation/eviction, and execution-consistency coverage. Only scheduling and UI event delivery are simulated; assembler/CPU results are real. UI-handler/render tests use installed React and TypeScript, with no new framework or browser dependency. `npm run typecheck` also checks positive/negative engine contracts. Engine imports use `.ts` paths with `allowImportingTsExtensions` for native Node tests. These tests do not replace browser interaction checks; actual results and pending checks are in `VERIFICATION.md`.

Local storage belongs to this browser/profile/origin and contains one current draft. It is not a file system or version history. Private mode, quota limits, or clearing browser data can remove it; use Download for backups. Multiple tabs do not synchronize changes. Files are interpreted as UTF-8 text. A parser-success result proves syntax only. Assembly does not prove runtime validity: the CPU checks taken targets, memory accesses, SP changes, and decoded bits during execution. Runtime state is in memory and is not restored from browser draft storage.

## Pausing after Day 10

Day 10 stops with Run to Cursor, trace filters/navigation, and tested debugger lifecycle/cancellation behavior. The tests and documented browser checklist provide the baseline for Day 11; Day 11 has not started. Time travel, advanced watchpoints, and custom test-case execution remain unavailable. No deployment or GitHub operations are part of this work.
