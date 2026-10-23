# Assembly Emulator

Days 1–2 of a 15-day project: a browser-local assembly source workspace with draft engine contracts. **The assembler, CPU emulator, debugger, and test execution engine are not implemented.** All example syntax is provisional; ISA decisions begin on Day 3.

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
- Client-only Monaco with line numbers, provisional assembly highlighting, find, undo, indentation, and normal keyboard editing. Ctrl+M toggles Tab focus mode. Mount timeout or import/render failure offers a plain-text fallback with cursor tracking. Accepted file replacement starts fresh undo history; ordinary edits retain undo/redo.
- Create a blank file; upload UTF-8 `.asm`/`.txt` files up to and including 1 MB; download current source as `.asm`. Malformed UTF-8, binary controls, invalid extensions, oversized files, and read failures show a notice. Download filenames are normalized and bounded, including Windows reserved names.
- Ctrl+S requests a download; Ctrl+N uses guarded Create. Shortcuts apply only while focus is in the ready IDE, outside dialogs and unrelated inputs (including Monaco find fields), and pause during upload. F5/F10 are not bound to execution.
- Browser-local draft autosave after 400 ms, restoration after refresh, and saving on page hide. Storage failures show a notice. An unreadable/corrupt draft is not overwritten until you edit or accept a replacement. Downloads provide a portable backup.
- Create/upload/example replacement asks for confirmation when nonempty source differs from the last download requested in this session. Restored nonempty drafts are protected too. Cancelling keeps current source; undo history is not a substitute for a backup.
- Separate closeable documentation and Test Cases panels with section jump navigation. Native modal dialogs provide focus containment, Escape dismissal, and focus restoration. Six draft guide sections and planned register/memory assertions explain what is available and what awaits the engine.
- Explicit empty states for CPU registers A/B/PC/SP, memory, output, diagnostics, trace, and disassembly. No fabricated execution data or passing tests.

Assemble, Run, Step, Pause, Reset, breakpoints, speed, memory format, and planned test controls are disabled. Highlighting does not validate source. Download status confirms a browser download request, not that the user saved a file.

## Architecture

```text
src/app/                  App Router page, metadata, global styles
src/components/editor/    Client-loaded Monaco and editor frame
src/components/layout/    Workspace composition and status bar
src/components/panels/    CPU, memory, results, documentation, tests
src/components/toolbar/   File actions and disabled execution controls
src/lib/editor/           Document I/O, autosave hook, examples, language
src/types/                UI/source types and React-independent engine contracts
scripts/                  Local Monaco asset preparation
tests/                    Dependency-free Node tests for document behavior
```

State stays in React; there is no global state library, authentication, database, backend, or external API. The standard Next.js build is compatible with Vercel; no deployment setup or account operations are performed.

## Verification and limitations

`npm test` covers replacement/cancellation guards, upload size boundaries, UTF-8/binary handling and read failures, download content, safe filenames, autosave restoration (including blank source), corrupt records/storage failures, and shortcut decisions. `npm run typecheck` also checks positive/negative contract fixtures. These helper tests do not replace browser interaction checks; actual results and pending checks are in `VERIFICATION.md`.

Local storage belongs to this browser/profile/origin and contains one current draft. It is not a file system or version history. Private mode, quota limits, or clearing browser data can remove it; use Download for backups. Multiple tabs do not synchronize changes. Files are interpreted as UTF-8 text. No guarantees about final syntax or CPU behavior are made.

## Day 3

Finalize the exact 19-instruction ISA, operand/label rules, registers, memory/stack, widths/overflow, addressing, encoding, halt/errors, and execution limits. [docs/ISA_DESIGN.md](docs/ISA_DESIGN.md) records these unresolved decisions and the contract boundaries. No instruction semantics or execution behavior have been implemented.
