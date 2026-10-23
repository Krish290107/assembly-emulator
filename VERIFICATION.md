# Day 1 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator`, using Node 26.2.0 and npm 11.13.0.

## Actual results

| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS; zero errors or warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS; 7 tests, zero failures |
| `npm run build` | PASS; production compilation, TypeScript, static generation |
| `npm audit --omit=dev --json` | PASS; zero production vulnerabilities |
| `npm audit --json` | WARNING / exit 1; 5 high-severity affected development packages from one `braces` advisory |
| Production HTTP checks | PASS; `/`, `/icon.svg`, local worker, and root client scripts return 200 |
| Server-rendered execution controls | PASS; all 5 buttons have `disabled` attributes |
| Browser-only editor initialization | Server HTML shows the restoring state; Monaco is dynamically loaded with SSR disabled. Browser hydration is **not verified**. |
| Sanitizer integration | DOMPurify 3.4.17 installed; final client bundle contains 3.4.17 and no 3.4.15 string |
| Obsolete CDN/AMD loader assets | Removed; `/monaco/vs/loader.js` returns 404 |

The sandbox initially blocked Node/Next worker subprocesses with `spawn EPERM`. The final normal test command and production build passed when run outside that restriction. No test framework or browser binaries were downloaded.

## Dependency notes

Installed direct versions: Next 16.4.2; React / React DOM 19.3.1; Monaco React 4.7.0; Monaco 0.57.0; Lucide 1.61.0; TypeScript 5.9.3; Tailwind / Tailwind PostCSS 4.3.3; ESLint 9.39.5; eslint-config-next 16.4.2; React types 19.3.0; Node types 24.19.2. `package-lock.json` records the full resolution; manifest ranges permit compatible updates.

Approximate measured logical sizes: `node_modules` 552 MB; generated local worker/license assets 0.3 MB; `.next` about 73 MB including build cache. The initial network estimate was 100–200 MB; actual transferred bytes were not measured. The approved sanitizer patch added less than 2 MB installed. npm's shared cache is separate from these project sizes.

Monaco's DOMPurify dependency had a critical advisory. The approved override resolves DOMPurify 3.4.17. Monaco also carries a vendored sanitizer in ESM; `scripts/copy-monaco.mjs` aligns that module with the patched dependency before installation completes and before every dev/build command. The app uses those source modules and a local plain-text worker, avoiding the original prebuilt editor bundle. Recheck this integration when upgrading Monaco.

ESLint 9.39.5 is deprecated upstream. It remains compatible with Next's current React and accessibility lint plugins, whose peer ranges do not support ESLint 10. The full audit's remaining development-only chain is `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`. The root issue is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), involving deeply nested glob patterns. npm's proposed automatic fix downgrades eslint-config-next to 14.2.35; that incompatible downgrade was not applied. These packages are tooling, not the application's production dependency tree.

## Manual browser checks still required

Browser discovery returned no available browsers or apps. The following checks were **not run**; do not treat HTTP/build success as browser verification.

1. Open `http://localhost:3000` after `npm run dev`. Confirm Monaco loads with line numbers and highlighting, with no hydration errors, missing resources, or console errors.
2. Type source; use undo/redo, selection, indentation, find, and clipboard. Check the cursor position status. Toggle Tab focus mode with Ctrl+M and confirm focus can leave the editor.
3. Modify source, click Create, cancel the replacement confirmation, and confirm source remains intact. Repeat and accept: a blank `untitled.asm` should appear.
4. Upload UTF-8 `.asm` and `.txt` files, including an empty file. Check source and filename. Try an invalid extension, binary `.asm`, and a file over 1 MB; expect a notice and unchanged source. Read failures are covered by the automated tests.
5. Click Download and inspect the saved `.asm` file. Confirm current source bytes and a sensible filename. Browser download permission/completion is not automatically verified.
6. Edit source, wait for the saved status, refresh, and confirm restoration. Create a blank file and refresh again: it must remain blank. Also try an immediate refresh after typing to exercise the page-hide flush.
7. Make browser storage unavailable and verify the warning, continued editing, and Download. With unsaved source and unavailable storage, leaving the page should prompt where the browser supports unload prompts.
8. Load each provisional example. Confirm modified source prompts before replacement and that cancelling preserves it.
9. Open Info. Check all four draft sections; close using the button and Escape. Check keyboard focus stays inside while open and returns to the trigger after closing.
10. Open Test Cases. Confirm predefined/custom planned sections, explicit unavailable engine text, disabled controls, and no fabricated results. Check close and focus behavior.
11. Check Assemble, Run, Step, Pause, Reset, breakpoints, speed, and memory format remain disabled. CPU values and execution views must remain empty. Switch results tabs using clicks and arrow/Home/End keys.
12. Check desktop, 700 px, and 360 px widths. Panels should stack sensibly, all toolbar actions remain reachable, and the bottom results panel can resize. Verify visible keyboard focus throughout.

No repository, commit, push, GitHub, Vercel, or deployment operations were performed. Local verification servers were stopped after checks.
