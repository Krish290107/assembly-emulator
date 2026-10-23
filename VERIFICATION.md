# Day 2 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator`, using Node 26.2.0 and npm 11.13.0.

## Hydration investigation follow-up

The reported unexpected `translate-tooltip-mtz blue sm-root translate hidden_translate` element strongly indicates external DOM injection, most likely a translation extension. No application hydration bug was confirmed. The exact extension and an extension-on/off reproduction remain unverified because browser discovery returned no accessible browsers/apps. A `Next.Metadata / Suspense` component stack alone does not identify which code inserted the unexpected node. [Next.js documents browser extensions modifying HTML as a hydration-error cause](https://nextjs.org/docs/messages/react-hydration-error).

Reviewed root layout/static metadata, initial client state, storage restoration, Monaco loading, dialogs, and generated/server output. The root emits normal html/body markup; title/description are static. Initial source/readiness/save state is deterministic. localStorage is accessed in effects or subsequent event callbacks, not during rendering. Monaco's module-level browser initialization is behind a dynamic import with SSR disabled, and the editor is not rendered until the post-mount restoration step. Dialog DOM operations also run after mounting.

Searches of application source, local assets, installed dependency JS/CSS/JSON/TypeScript, and generated output found no `translate-tooltip-mtz` or `hidden_translate` marker. A fresh production HTTP response returned 200, contained the expected title/description in the head and initial restoration placeholders, and contained none of the reported translator markers. This verifies server output, not browser hydration.

Reran `npm run lint`, `npm run typecheck`, `npm test` (18 passed, 0 failed), and `npm run build`: all passed. No application code, dependencies, or hydration-warning suppression was changed for this investigation. The temporary verification server was stopped.

To confirm the browser-side cause, compare the same URL in a clean browser profile with extensions disabled, then repeat in the original profile with the translation extension disabled while retaining the same saved draft. A private window is useful only if extensions are not allowed there. Compare the raw Network document response with the live Elements DOM: an element absent from the response but present in Elements was inserted client-side. If the mismatch persists with extensions disabled, capture the full new diff/stack for further investigation. Do not clear localStorage or delete the draft for this check.

## Actual results

| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS; zero errors or warnings |
| `npm run typecheck` | PASS, including positive/negative engine contract fixtures |
| `npm test` | PASS; 18 tests, zero failures (Day 1 baseline: 7) |
| `npm run build` | PASS; compilation, TypeScript, and static generation; no build warnings emitted |
| `npm audit --omit=dev` | PASS; zero production vulnerabilities |
| `npm audit --json` | Exit 1; one development advisory affects five packages, all reported high |
| Production HTTP checks | PASS; page, local worker, and all 8 root client scripts return 200 |
| Server HTML checks | PASS; 5 disabled execution controls; 4 tabs linked to 4 panels, 3 hidden; Ctrl+S/Ctrl+N annotations present; Day 1 header marker removed |
| Sanitizer bundle check | PASS; client bundle contains DOMPurify 3.4.17 and no 3.4.15 string |
| Browser automation | NOT RUN; discovery returned no browsers or apps |

The tests cover upload boundaries (exactly 1 MB / one byte over), malformed UTF-8, Unicode/BOM/line endings, binary controls, empty files, read failures, inert script-looking source, filename normalization/reserved names/length, download bytes, replacement confirmation/cancellation guards, blank draft restoration, corrupt records/storage failures, and shortcut decisions/scopes/repeat/modifier handling. Contract fixtures check assembly result discrimination, required complete CPU state, register names, memory assertions, and source ranges.

Helper tests and server HTML checks do not prove React lifecycle, Monaco, focus, or hydration behavior. Node tests and Next builds were run outside the sandbox's worker subprocess restriction. No packages or browser binaries were installed; dependency manifests, lockfile, Next configuration, and Monaco preparation script are unchanged.

## Reliability and security

Monaco remains bundled from ESM with the existing patched vendored DOMPurify integration and local plain-text worker. Import/render failures are caught by an editor boundary; the mount timeout now waits for Monaco's actual mount. Accepted file replacement resets the editor model/undo history. An unreadable/corrupt autosave is left untouched by automatic saves/page-hide flushing until an explicit edit or accepted replacement. Visibility/unload saves update the save indicator.

The remaining advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): deeply nested glob patterns can exhaust the stack in `braces`. The affected development chain is `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. These packages process tooling glob patterns; uploaded editor source is not passed to them. This remains a tooling risk when processing untrusted patterns, rather than an application production dependency finding.

npm proposes downgrading eslint-config-next to 14.2.35; that incompatible change was not applied. ESLint 9.39.5's previously observed deprecation remains; installed React/accessibility lint plugin peer ranges exclude ESLint 10. No force fix, downgrade, or dependency upgrade was performed.

No remote Vercel logs were inspected, so Vercel-specific warnings cannot be confirmed or reproduced from this local check. Git's local ownership check was handled with a command-scoped safe-directory option for read-only status/diff; global configuration was not changed.

## Manual browser checks pending

1. **Editor:** Load Monaco; verify highlighting (including a mnemonic-like label such as `MOV:`), comments, line numbers, long-line scrolling, cursor status, normal undo/redo/find/clipboard, and Ctrl+M focus escape. Test slow/failed editor loading and import failure; verify fallback editing/cursor tracking.
2. **Shortcuts:** Ctrl+S should request the current .asm download; Ctrl+N should use guarded Create. Check editor, fallback, and toolbar focus; verify no interception in dialogs, example selects, Monaco find fields, outside the IDE, during upload, or for F5/F10.
3. **Replacement:** Modify or restore source, then cancel Create/upload/example replacement and confirm source, filename, cursor, and undo history remain unchanged. Accept replacement and confirm fresh history/cursor position; ordinary editing should retain undo/redo.
4. **Files:** Upload UTF-8 .asm/.txt, BOM/Unicode/empty files and exact-limit files; check invalid/oversized/binary/non-UTF-8 notices. Download and inspect actual source bytes and filename. Browser download completion is not verified automatically.
5. **Autosave:** Refresh edited and intentionally blank source, including immediate refresh before the debounce. Test denied/quota-limited storage and recovery. A corrupt record must remain unchanged after refresh/page hide until editing or accepted replacement.
6. **Dialogs:** Open Info and navigate all six sections. Open Test Cases and check planned predefined/custom tests and register/memory assertions. Verify scrolling, Tab/Shift+Tab containment, close button, Escape/backdrop dismissal, and focus restoration.
7. **Layout/results:** Check desktop, 700 px, and 360 px widths, toolbar wrapping, inspector stacking, long filenames/notices, and no horizontal page overflow. Exercise result tabs with arrows/Home/End and narrow tab-strip scrolling; resize results. Confirm execution/test actions remain disabled and no fabricated results appear.
8. **Runtime:** Inspect the browser console/network for hydration errors, failed chunks/fonts/worker requests, and accidental external asset requests.

## Day 3 boundary and cleanup

`docs/ISA_DESIGN.md` lists unresolved instruction, operand/label, register, memory/stack, width/overflow, addressing, encoding, halt/error, and execution-limit decisions. Engine contracts are type declarations only; no parser, assembler, CPU, debugger, or test execution runner was added.

Generated `.next`, local worker/license assets, and TypeScript incremental cache are ignored and retained as useful generated output; no unnecessary project artifacts or user data were deleted. Verification servers were stopped. No commit, push, GitHub, or Vercel operations were performed.
