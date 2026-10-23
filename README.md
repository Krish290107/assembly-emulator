# Assembly Emulator

Days 1–5 of a 15-day project: a browser-local assembly workspace with a finalized 19-instruction ISA and a complete pure TypeScript two-pass assembler. **The assembler is available through its internal API; UI assembly integration, CPU loading/execution, debugger, and test execution engine are not implemented.** [ISA_DESIGN.md](docs/ISA_DESIGN.md) defines ISA v1 and its syntax, memory, encoding, faults, and limits.

## Stack and setup

Next.js App Router, React, TypeScript, Tailwind CSS, Monaco (`@monaco-editor/react`), Lucide, ESLint, and npm. Use Node.js **24.x** and npm 10+; the native test runner uses Node's built-in TypeScript stripping. The bounded Node engine selects Vercel's supported 24.x major and overrides a differing dashboard selection. No dashboard settings are changed by editing this repository. Local checks have run on the existing Node 26.2.0 / npm 11.13.0; Node 26 is outside the declared target, and Node 24 verification remains pending. Switch to Node 24 before a fresh dependency installation to avoid an engine mismatch warning.

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
- Explicit empty states for CPU registers A/B/PC/SP, memory, output, diagnostics, trace, and disassembly. No fabricated execution data or passing tests.

Assemble, Run, Step, Pause, Reset, breakpoints, speed, memory format, and planned test controls are disabled. Highlighting does not validate source. Download status confirms a browser download request, not that the user saved a file.

## Day 3 parser

`parseSource(source)` in `src/lib/assembler/parser.ts` scans text into label-only, instruction, and data statements with structured diagnostics and exclusive source spans. It handles comments, line endings, case-insensitive mnemonics, case-sensitive labels, signed decimal/hex literals, operand counts/ranges, and recovery after malformed lines. Valid lines remain available when other lines fail. It neither resolves symbols nor emits machine code, and it is **not connected to live editor diagnostics**.

ISA v1 uses signed 32-bit A/B and memory words, 65,536 word-addressed cells, and a descending stack with initial SP 65,536. Instructions carry an 8-bit low opcode and signed 24-bit operand, serialized as four little-endian bytes by the assembler. Branch/call symbol references are relative to the next instruction. The `data` directive holds one signed 32-bit literal and is separate from the 19 CPU opcodes. Full behavior, including future CPU call/return links, wrapping, shifts, faults, and execution limits, is in the ISA document.

## Day 4 first assembler pass

`firstPass(parseSource(source))` in `src/lib/assembler/first-pass.ts` returns a case-sensitive symbol map with source ranges, located statements, word count, diagnostics, success/failure status, and unresolved references tagged for future absolute/relative resolution. It accepts forward references and distinct labels at one location. Duplicate definitions report both locations and retain the first binding.

Allocation starts at word 0; each valid instruction/data consumes one word, and labels consume none. Malformed parser lines contribute neither words nor labels; recovered valid lines remain inspectable, but any error prevents success. Exactly 65,536 words fit. Overflow and labels at address 65,536 are rejected without wrapping. Partial results include only in-range symbols/statements, while the word count includes excess words. All symbol operands stay unresolved, including undefined names. This internal module does not change the editor or enable execution controls.

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

The API is pure and independent of React/browser APIs. It does not execute the image or connect to the editor's Assemble button. UI/file-handling behavior and disabled engine controls are preserved.

## Architecture

```text
src/app/                  App Router page, metadata, global styles
src/components/editor/    Client-loaded Monaco and editor frame
src/components/layout/    Workspace composition and status bar
src/components/panels/    CPU, memory, results, documentation, tests
src/components/toolbar/   File actions and disabled execution controls
src/lib/editor/           Document I/O, autosave hook, examples, language
src/lib/assembler/        ISA metadata, scanner, parser, both passes, and public API
src/types/                UI/source types and React-independent engine contracts
scripts/                  Local Monaco asset preparation
tests/                    Dependency-free Node tests for documents, parser, and assembler
```

State stays in React; there is no global state library, authentication, database, backend, or external API. The standard Next.js build is compatible with Vercel; no deployment setup or account operations are performed.

## Verification and limitations

`npm test` preserves all 77 Day 1–4 tests and adds exact encodings for all 19 instructions, full binary fixtures, absolute/relative resolution, literal and data boundaries, source maps, error propagation, capacity, determinism, and input-immutability checks. `npm run typecheck` also checks positive/negative contract fixtures, including signed word memory. TypeScript imports use `.ts` paths with `allowImportingTsExtensions` so the existing native Node test runner can import the pure modules without a transpiler dependency. These tests do not replace browser interaction checks; actual results and pending checks are in `VERIFICATION.md`.

Local storage belongs to this browser/profile/origin and contains one current draft. It is not a file system or version history. Private mode, quota limits, or clearing browser data can remove it; use Download for backups. Multiple tabs do not synchronize changes. Files are interpreted as UTF-8 text. A parser-success result proves syntax only. Complete assembly checks symbols, capacity, operand ranges, and encoding; it does not prove runtime validity. Numeric branch targets, memory accesses, SP changes, and decoded data are checked by the future CPU when relevant. No execution results are produced.

## Day 6 readiness

The complete origin-zero binary, symbols, diagnostics, and byte-based source mappings are ready for future CPU work. Day 5 stops before loading or executing any image; UI integration and debugger behavior remain future work.
