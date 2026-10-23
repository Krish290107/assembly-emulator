# Assembly Emulator

Day 1 of a 15-day project: a browser-local assembly source workspace. **The assembler, CPU emulator, debugger, and test execution engine are not implemented.** All example syntax is provisional; the ISA and encoding will be specified in Days 3–5.

## Stack and setup

Next.js App Router, React, TypeScript, Tailwind CSS, Monaco (`@monaco-editor/react`), Lucide, ESLint, and npm. Use Node.js 22.18+ (a supported LTS release is recommended) and npm 10+; the native test runner uses Node's built-in TypeScript stripping. Initial verification uses the machine's Node 26.2.0 / npm 11.13.0.

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

## Day 1 features

- Compact dark IDE, responsive CPU/memory inspectors, resizable results panel, and keyboard-accessible result tabs.
- Client-only Monaco with line numbers, provisional assembly highlighting, find, undo, indentation, and normal keyboard editing. Ctrl+M toggles Tab focus mode. A plain-text fallback remains editable if Monaco fails to load.
- Create a blank file; upload `.asm`/`.txt` files up to 1 MB; download the exact current source as `.asm`. Invalid extensions, binary content, oversized files, and read failures show a notice.
- Browser-local draft autosave after 400 ms, restoration after refresh, and saving on page hide. Storage failures show a notice. Downloads provide a portable backup.
- Create/upload/example replacement asks for confirmation when nonempty source differs from the last download requested in this session. Restored nonempty drafts are protected too. Cancelling keeps current source; undo history is not a substitute for a backup.
- Separate closeable documentation and Test Cases panels. Native modal dialogs provide focus containment, Escape dismissal, and focus restoration.
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
src/types/                Source, CPU, execution, trace, debugger contracts
scripts/                  Local Monaco asset preparation
tests/                    Dependency-free Node tests for document behavior
```

State stays in React; there is no global state library, authentication, database, backend, or external API. The standard Next.js build is compatible with Vercel; no deployment setup or account operations are performed.

## Verification and limitations

`npm test` covers replacement protection, valid/invalid uploads and read failures, exact download content, safe filenames, autosave restoration (including blank source), corrupt records, and storage failures. Browser checks and actual command results are recorded in `VERIFICATION.md`.

Local storage belongs to this browser/profile/origin and contains one current draft. It is not a file system or version history. Private mode, quota limits, or clearing browser data can remove it; use Download for backups. Multiple tabs do not synchronize changes. Files are interpreted as UTF-8 text. No guarantees about final syntax or CPU behavior are made.

## Day 2

Review the editor workflow and accessibility, settle the next milestone's requirements, and refine interface contracts before ISA work in Days 3–5. Assembler/emulator/debugger implementation remains future work; Day 1 does not define its behavior.
