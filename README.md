# Assembly Emulator

Days 1–4 of a 15-day project: a browser-local assembly workspace with a finalized 19-instruction ISA, a pure TypeScript source parser, and the first assembler pass. **The second assembler pass, machine-code generation, CPU emulator, debugger, and test execution engine are not implemented.** [ISA_DESIGN.md](docs/ISA_DESIGN.md) defines ISA v1 and its syntax, memory, encoding, faults, and limits.

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

ISA v1 uses signed 32-bit A/B and memory words, 65,536 word-addressed cells, and a descending stack with initial SP 65,536. Instructions carry an 8-bit low opcode and signed 24-bit operand, serialized as four little-endian bytes in future assembler work. Branch/call symbol references are relative to the next instruction. The `data` directive holds one signed 32-bit literal and is separate from the 19 CPU opcodes. Full behavior, including call/return links, wrapping, shifts, faults, and execution limits, is in the ISA document.

## Day 4 first assembler pass

`firstPass(parseSource(source))` in `src/lib/assembler/first-pass.ts` returns a case-sensitive symbol map with source ranges, located statements, word count, diagnostics, success/failure status, and unresolved references tagged for future absolute/relative resolution. It accepts forward references and distinct labels at one location. Duplicate definitions report both locations and retain the first binding.

Allocation starts at word 0; each valid instruction/data consumes one word, and labels consume none. Malformed parser lines contribute neither words nor labels; recovered valid lines remain inspectable, but any error prevents success. Exactly 65,536 words fit. Overflow and labels at address 65,536 are rejected without wrapping. Partial results include only in-range symbols/statements, while the word count includes excess words. All symbol operands stay unresolved, including undefined names. This internal module does not change the editor or enable execution controls.

## Architecture

```text
src/app/                  App Router page, metadata, global styles
src/components/editor/    Client-loaded Monaco and editor frame
src/components/layout/    Workspace composition and status bar
src/components/panels/    CPU, memory, results, documentation, tests
src/components/toolbar/   File actions and disabled execution controls
src/lib/editor/           Document I/O, autosave hook, examples, language
src/lib/assembler/        ISA metadata, scanner, parser, and first assembler pass
src/types/                UI/source types and React-independent engine contracts
scripts/                  Local Monaco asset preparation
tests/                    Dependency-free Node tests for documents, parser, and first pass
```

State stays in React; there is no global state library, authentication, database, backend, or external API. The standard Next.js build is compatible with Vercel; no deployment setup or account operations are performed.

## Verification and limitations

`npm test` preserves all 55 Day 1–3 tests and adds first-pass symbol, address, duplicate, reference, source-span, recovery, memory-boundary, determinism, and parser-integration coverage. `npm run typecheck` also checks positive/negative contract fixtures, including signed word memory. TypeScript imports use `.ts` paths with `allowImportingTsExtensions` so the existing native Node test runner can import the pure modules without a transpiler dependency. These tests do not replace browser interaction checks; actual results and pending checks are in `VERIFICATION.md`.

Local storage belongs to this browser/profile/origin and contains one current draft. It is not a file system or version history. Private mode, quota limits, or clearing browser data can remove it; use Download for backups. Multiple tabs do not synchronize changes. Files are interpreted as UTF-8 text. A parser-success result proves syntax only. The first pass checks duplicate names and image size; undefined symbols, resolved operand/target validation, encoding, and runtime validity await future phases. No execution results are produced.

## Day 5 readiness

The symbol table, located statements, unresolved references, and diagnostics are ready for a future second pass using ISA v1's absolute and next-instruction-relative rules. Day 4 stops before operand resolution or encoding.
