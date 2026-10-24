# Post-Day-15 maintenance — 24 October 2026

Overall: **local quality gates PASS; affected browser workflows UNVERIFIED**. Started from clean `main` at `4ff1fa0` (`Day 15: Finalize Assembly Emulator release and Node 24 CI`). This is focused maintenance, not another development phase. All 512 baseline tests remain; 26 regression tests were added. No ISA/CPU, JSON schema, dependency, lockfile, CI or production configuration changes. No files deleted, packages/runtimes installed, browser data changed, commits, pushes or deployments.

## Confirmed findings and fixes

1. **Source autosave overwrite:** the previous persist API reproduced loss of a newer saved draft when a stale tab wrote its own restored source. The hook had no storage listener or pre-write comparison, including pagehide/beforeunload/visibility flushes. Each tab now retains its saved raw baseline, checks immediately before writes and observes other-tab storage events. Conflicts pause autosave and retain current editor text; editing/replacement does not bypass protection. A persistent recovery bar offers Download editor backup and confirmed Reload/Overwrite. Recovery rechecks the record captured before confirmation. Malformed original drafts stay protected until explicit recovery. Unchanged saves skip storage writes; quota failures keep content and can retry. Existing page-exit warnings cover unavailable/conflicted, undownloaded editor work. Events/listeners and debounce timers clean up normally.
2. **Initial register form limitation:** imported A/B/PC/SP inputs existed in the schema but were read-only. Optional Initial A/B/PC/SP fields now populate, edit and clear those inputs independently of expected registers. Blank means default/unspecified; zero is explicit. Architecture bounds and decimal/signed hexadecimal validation apply with associated field errors. Version-1 JSON round-trips unchanged; real execution verifies supplied/cleared inputs affect the actual CPU as expected.
3. **Library rendering/usability:** all custom cards and their collapsed program/result contents previously mounted. Custom search (name/description) and ten-card pages now preserve IDs/order and leave Run all custom on the full library. Collapsed program and passing-result bodies mount on expansion; failures initially expand. Existing 100-item assertion/result pages, full recorded results and suite totals remain. SSR regression observed ten cards for 100 definitions, no hidden source/input/result tables in collapsed details, and 100 result rows for expanded large failures. This is a rendering bound, not a measured browser-speed claim.

Changed source: src/lib/editor/document.ts and use-source-document.ts; src/types/ide.ts; layout ide-workspace.tsx/status-bar.tsx; panels test-case-form.tsx/test-cases-content.tsx/tool-panel.tsx; src/lib/testing/form.ts; globals.css. Added src/lib/testing/library-view.ts and tests/maintenance.test.mjs. Extended tests/test-panel-render.test.mjs. Updated README, docs/TESTING.md, docs/RELEASE.md and this record. Required generated Monaco assets were rebuilt through the existing prebuild script; no generated file was manually edited or tracked.

## Actual verification

| Check | Result |
| --- | --- |
| npm run lint | **PASS**, zero warnings/errors |
| npm run typecheck | **PASS** |
| npm test | **538 passed, 0 failed, 0 skipped**; previous baseline 512, new tests 26 |
| npm run build | **PASS**, Next.js 16.4.2 compilation/TypeScript/static generation, no build warnings |
| npm audit --omit=dev | **PASS**, 0 reported production vulnerabilities |
| git diff --check | **PASS** |
| Manifest/lockfile and CI configuration review | Root dependencies/devDependencies/engines match; workflow retains Node 24.x, read-only permissions, locked install and quality gates |
| Runtime | **Node 26.12.1 / npm 11.20.0**, only Node 26 on checked PATH |
| Node 24 / production verification | **UNVERIFIED/PENDING acceptance**; no Node 24 execution or matching remote CI/deployment result established by this maintenance audit |

The first restricted focused test command failed before execution with `spawn EPERM`. Retrying with permission for existing local Node child processes passed all 77 focused tests; subsequent complete runs passed. No test assertion failed. The last full run includes the additional delayed-storage-event regression and all 538 tests. Build likewise used existing local compiler child processes. No installation/download was needed; npm audit queried requested advisory metadata only.

New coverage: stale tabs, delayed foreign-write events, pending/lifecycle save guards, deleted/cleared/corrupt records, confirmation races, read-only reload, blank drafts/no-op writes, quota/access failures; imported initial-register edit/clear/zero/bounds/invalid values, version-1 round-trip and real execution; empty/filtered/100-case pages and stable order; labeled initial controls and bounded/lazy detail rendering. Existing real-CPU/assembler/debugger/fixtures/cancellation/isolation tests all pass.

## Issues not reproduced / reviewed scope

No new import/export defect was found. Existing tests preserve version-1 round-trips, deterministic Merge renames and Replace behavior, duplicate ID/name rejection, malformed JSON/UTF-8/oversize rejection, partial storage recovery, prototype-key rejection and atomic invalid-import preservation. Reviewed UI code still confirms both Merge and Replace plans and never executes imports automatically. No imported JavaScript evaluation is present. Native confirmation/file-picker acceptance was not reverified. No external sample format was used to change the established schema.

No new CPU/debugger semantic regression was reproduced. The complete suite exercises all 19 instructions, bounds/fault atomicity, attempts/limits, real PASS/FAIL results, independent test CPUs, shortcuts, breakpoints/Run to Cursor, trace selection/filter/export/500-entry retention, cancellation/disposal and memory views. Existing Monaco/fallback, upload/download/autosave paths were inspected and production build passes. React/SSR tests and code review do not establish physical browser input, accessibility, hydration or layout acceptance.

Performance scope: custom card/detail mounting is now bounded as tested above; no real-browser benchmark was possible. Existing maximum-image and repeated 100-case suite regressions pass. Validation, source assembly, JSON serialization, expanded initial-input display and final assertion evaluation remain synchronous within existing limits. No confirmed timing bottleneck justified changing those algorithms or CPU batching. localStorage has no atomic compare-and-swap: baseline checks and foreign-write events detect conflicts, but do not provide transactional simultaneous-tab editing or automatic merges. Keep exported backups. Library paging may reset a card's local expansion/assertion-page position while preserving its definition/result.

## Browser evidence and required manual checks

Existing node_repl + @oai/sky Computer Use found Brave and the Assembly Emulator tab. Selecting it failed with **`coordinate input geometry is unavailable`**. Refreshed the returned window binding, activated it, observed the current tab index, then retried once; the same error recurred. Stopped browser automation. No fresh application screenshot, affected workflow input or browser timing was obtained; no native picker was opened or security restriction bypassed. **All fresh maintenance browser checks are UNVERIFIED.** Prior Day 14 observations below remain historical.

After restoring supported input geometry, manually:

1. Export important source first. Open the same local origin in two tabs. Edit/save in A, then edit B: B must retain its editor text, warn and preserve A's saved draft. Switch visibility/attempt navigation; no stale flush may overwrite it. Download B's backup, cancel recovery confirmations, then test confirmed reload/overwrite with disposable content. Restore the original source. Repeat corrupt-draft/quota scenarios only in a disposable profile.
2. Import a disposable valid version-1 case using Merge. Edit/clear Initial A/B/PC/SP (including zero), save/export/reimport and verify expectations remain distinct. Run `adc 5 / HALT` with initial A=10 and expected A=15: PASS; clear initial A: actual 5/FAIL. Do not replace/delete real user tests.
3. On an existing large library, search, clear search and use Previous/Next with keyboard. Verify Run all custom totals include nonmatching/off-page cases, and native Enter/Space expands program/PASS result details. Recheck summary/close/form controls and scrolling near 390px. Restore viewport/source and remove only approved audit data.
4. Recheck basic debugger, persistence and console. Manually verify Merge/Replace confirmation cancellation, malformed/invalid import preservation and native import. If Windows URL verification blocks a picker/confirmation, stop that automated interaction; use a manual owner check without bypassing security.
5. Follow [docs/RELEASE.md](docs/RELEASE.md): review/stage intended changes, manually commit/push, require actual Node 24 CI success for that SHA, then confirm Vercel Ready/SHA and production smoke tests. No CI/deployment success is inferred from the local Node 26 build.

---

# Day 15 final release preparation — 24 October 2026

Overall status: **PARTIAL verification; local preparation PASS / READY TO PUSH**. This is not a published or production-verified release. Node 24 GitHub CI and same-commit production acceptance are **PENDING**. Fresh Day 15 browser acceptance is **UNVERIFIED**. Historical records below describe earlier checks and are not evidence of a new CI/deployment/browser run.

## Repository and changes

Started on clean `main` at `bc020bf` (`Day 14: Stabilize assembler debugger and test runner`). All Day 13/14 source, tests and fixes were present. Added `.github/workflows/ci.yml` and `docs/RELEASE.md`; modified README.md, docs/ISA_DESIGN.md, docs/TESTING.md and this record. No files deleted. No application, ISA, tests, dependency, lockfile, runtime or Vercel configuration changes were needed. No confirmed application regression was found.

README now describes architecture, installation, all 19 opcodes, debugger controls, local data, test management and four practical demos. ISA/testing documentation removes obsolete statements that the CPU, tracing or test UI is not implemented; instruction semantics and API contracts are unchanged. The existing Info panel was reviewed and already matches the implemented ISA/debugger/test workflow; no source edit was needed. Relative Markdown file links and whitespace across all six changed files were checked. The [manual release procedure](docs/RELEASE.md) provides exact PowerShell review/stage/commit/push instructions for the owner, followed by CI, deployment SHA and production checks. None of those write/remote release operations was executed by the agent.

## Actual quality gates

| Check | Day 15 result |
| --- | --- |
| npm run lint | **PASS**, no warnings/errors |
| npm run typecheck | **PASS** |
| npm test | **512 passed, 0 failed, 0 skipped**; all 512 baseline tests preserved, **0 new tests** |
| npm run build | **PASS**, Next.js 16.4.2 compilation, TypeScript and static generation; no build warnings |
| npm audit --omit=dev | **PASS**, **0 production vulnerabilities** reported by the current advisory query |
| git diff --check | **PASS** |
| Manifest/lockfile root dependencies, devDependencies and engines | **MATCH** |
| Workflow YAML and required configuration | **PASS**, parsed using the already installed YAML parser; this is not an Actions execution |
| Local runtime | **Node 26.12.1 / npm 11.20.0** |
| Target Node 24 execution | **PENDING**, Node 24 unavailable in checked PATH/project/common version-manager locations |

No local runtime, package or browser installation/download was performed. The requested production audit queried advisory metadata; its result covers production dependencies, not every development dependency or all application security risks. No npm audit fix or dependency upgrade was run.

## CI prepared, not executed

The workflow uses `ubuntu-latest`, `actions/checkout@v7`, `actions/setup-node@v7`, Node `24.x`, a 20-minute timeout and `contents: read`. It runs on pushes to main and pull requests targeting main. Steps print versions, install the lockfile with npm ci, lint, typecheck, test, build and audit production dependencies. Credential persistence, checkout cleanup and automatic package caching are disabled. No deployment/release step, custom secret or private environment variable is required.

Official [checkout v7](https://github.com/actions/checkout/tree/v7) and [setup-node v7](https://github.com/actions/setup-node/tree/v7) documentation/action definitions were checked: both use the Node 24 action runtime; compatible runner support is required (minimum 2.327.1 documented for Node 24 actions). GitHub-hosted Ubuntu manages its runner. After the owner pushes, actions, Node and locked dependencies may be downloaded onto GitHub-hosted runners. These remote downloads are separate from local Windows downloads; preparing the workflow installs nothing locally. **A real successful Node 24 run for the final commit remains required.**

## Feature, security and reliability evidence

All existing tests pass for parser diagnostics, both assembler passes, labels, all 19 opcodes, signed 24-bit operands, signed 32-bit arithmetic, little-endian serialization, branch/call addressing, memory/SP/PC checks, reset/loading, HALT, attempted-instruction counts, atomic faults and execution budgets. Existing editor/debugger/controller tests preserve breakpoints, Run to Cursor, speed equivalence, cancellation/disposal, self-modification, trace selection/navigation/export and bounded 500-entry retention. Test engine/panel tests preserve isolated CPUs, saved snapshots, custom CRUD, exact assertions, expected faults/limits, persistence, import/export and 100-item pagination.

Additional real-engine/controller checks verified README demos without adding redundant permanent tests: basic execution ends at A=15, B=0, PC=2, SP=65536, three attempts; memory demo stores 42 at word 100 in four attempts. All 14 predefined fixtures passed. The real workspace controller stopped before the line-2 breakpoint at one attempt, resumed to HALT at three, and stopped Run to Cursor before HALT at two before Step completed it. These are **engine/controller checks, not browser interaction claims**.

Reviewed safeguards remain covered by the existing tests: bounded uploads/imports with fatal UTF-8 validation, strict integer/schema/duplicate/prototype-key checks, corrupt-storage recovery, owned CPU inputs, safe filenames/object URL cleanup, bounded execution/trace/views and cancellation tokens. No runtime eval, unsafe HTML rendering or external transmission of user source/test data was found in the application search. Filename/tracked-file checks found no tracked dependency/build/worker output or matching environment/key files; this is not a credential-history audit. Manifest and lockfile agree. Existing ignores protect dependencies, build output, environment files, logs, caches and OS junk. Generated Monaco assets/licenses are required ignored build inputs and were preserved; no speculative cleanup was performed.

## Browser and release acceptance

| Check | Status and actual evidence |
| --- | --- |
| Fresh local Day 15 browser acceptance | **UNVERIFIED**. Existing node_repl + @oai/sky identified Brave windows and the Assembly Emulator tab. Selecting that tab failed twice with `coordinate input geometry is unavailable`, including after refreshing the window binding. Stopped retries; no fresh application screenshot or application interaction was obtained. |
| Earlier local Brave checks | Historical PASS/PARTIAL evidence is retained in the Days 1–14 record below; it is not a new Day 15 browser pass. |
| Native JSON import | **UNVERIFIED / MANUAL ACTION REQUIRED**. Earlier Windows URL-verification restriction remains unresolved; no native picker or alternative bypass was used in Day 15. |
| Remaining keyboard/accessibility/console checks | **UNVERIFIED** for fresh Day 15 execution. Recheck post-fix Issues, confirmations/focus, mobile pagination/cancellation and the smoke checklist manually. |
| Production acceptance | **PENDING** until CI passes and the Vercel Ready deployment's full Git SHA matches the owner's release commit. No production verification or deployment was performed. |

Browser-local data and existing JSON files were not changed during Day 15. The earlier audit-case cleanup state was not re-established; inspect and remove only audit-created data if still present, preserving user cases/exports. Restore supported browser input geometry before retrying automation. If a native picker/confirmation triggers URL verification, stop that interaction and complete it manually without bypassing browser security.

Follow [docs/RELEASE.md](docs/RELEASE.md): review/stage the six intended files, commit/push main manually, require the exact commit's Node 24 CI success, then confirm Vercel Ready/SHA and perform the production smoke checks. **READY TO PUSH does not mean release acceptance is complete.** No commit, push, deploy, tag, publication, destructive Git operation or further development phase was performed.

---

# Days 1–14 final stabilization — 24 October 2026

Overall status: **PARTIAL**. Confirmed UI defects were fixed and all local quality gates pass. Real browser acceptance is substantially verified, but native confirmation/file-picker restrictions, cleanup and target-runtime execution remain outstanding. No Day 15 work, CI setup, commits, pushes or deployments were performed.

## Repository baseline and scope

Branch `main`; the Day 13/14 rebuilt implementation was present as six tracked modifications and eight untracked files at the start of this stabilization. No tracked deletions were present. All assembler, CPU, debugger, test engine, Day 13 panel/storage/form and Day 14 pagination files existed. Their uncommitted work was preserved; no Git history/reset/cleanup operations were used. The 509-test baseline was retained.

Current-task created files: `src/lib/editor/panel-navigation.ts`, `tests/panel-navigation.test.mjs`. Modified: `src/app/globals.css`, `src/components/panels/tool-panel.tsx`, `src/components/panels/test-case-form.tsx`, `src/components/toolbar/execution-toolbar.tsx`, `src/components/toolbar/file-toolbar.tsx`, `src/components/panels/test-cases-content.tsx`, `tests/test-panel-render.test.mjs`, README, docs/TESTING.md and this record. No files deleted. Earlier Day 13/14 untracked files remain part of the workspace.

## Confirmed issues and fixes

| File/component | Problem and severity | Minimal fix/evidence |
| --- | --- | --- |
| Tool panel navigation/CSS | Medium usability: section scrollIntoView could move ancestors/dialog, hiding the header/close control and making long-result navigation awkward | Focus without scroll, then move only drawer content; prevent dialog overflow and navigation shrink. Repeated Custom section navigation kept header/close visible in Brave. Two focused regressions verify drawer-only movement and missing-node safety. |
| Native custom-test/import/source/speed controls | Low: Brave DevTools reported form fields without id/name, weakening browser field identification | Add descriptive names to native controls; preserve accessible labels/error associations. Render regression requires all custom form/import fields to have an id or name. Post-fix browser Issues count still needs a clean check. |

No CPU/ISA semantics, source parser, encoding, instruction execution, dependency ranges, package lock, production settings or storage schema were changed. No security vulnerability was confirmed. The apparent disappearance of five browser cases was investigated: the user explicitly confirmed deleting them. It is **not** attributed to application data loss or to this audit. The user's Pagination 101 Test was never edited/deleted by the agent.

## Final automated gates

| Check | Actual result |
| --- | --- |
| npm test | **512 passed, 0 failed, 0 skipped**; baseline 509 preserved, three new regressions |
| npm run lint | PASS, zero warnings/errors |
| npm run typecheck | PASS |
| npm run build | PASS; Next.js 16.4.2 compilation/TypeScript/static generation, no build warnings |
| npm audit --omit=dev | PASS; **0 production vulnerabilities** |
| git diff --check | PASS |
| Manifest/lockfile root dependencies, devDependencies and engines | MATCH |
| Runtime | **Node 26.12.1 / npm 11.20.0** |

Node 24 was not found on PATH or in checked project/common version-manager locations. Node **24.x compatibility is PENDING**, not inferred from Node 26 success. No runtime/package/browser was installed. Advisory metadata was queried for the requested audit. CI setup remains Day 15 work.

## Feature evidence

Automated PASS: parser diagnostics/spans; symbols and both assembler passes; all 19 opcodes; signed 24-bit operands, signed 32-bit wrapping and little-endian serialization; checked memory/SP/PC; branch/call/return; HALT/fault/limit precedence; atomic faults; reset/load; debugger rapid actions, cancellation, self-modification, trace inspection/filter/navigation/export/500-entry retention; memory endpoints; source documents/autosave helpers; all 14 test fixtures; custom assertions/faults/limits/snapshots; storage/schema/quota/corrupt-record recovery; prototype-key/UTF-8/import limits; independent test CPU state; repeated 100-case suites and bounded rendering.

Reviewed rather than fully browser-executed: editor fallback failure handling, upload failure recovery, generated Monaco sanitizer/worker preparation, runtime client/server boundaries, numeric parsing, local-only data flow and safe download cleanup. No runtime eval/unsafe HTML/network transmission of user source/tests was found in the application search. Import data is schema-validated and never evaluated as JavaScript. Fixed/sanitized browser filenames and object URL cleanup remain. No new credential/history audit or browser heap benchmark is claimed. Synchronous validation/assembly/JSON serialization remain bounded by current input limits; traces and displayed memory/results remain bounded.

## Real Brave acceptance record

Tool: existing `node_repl` + `@oai/sky`, Brave at verified `http://localhost:3000/`. Screenshots/accessibility snapshots were captured in the conversation. No browser DOM/console JavaScript was executed to mutate state.

| Browser check | Status | Observed evidence |
| --- | --- | --- |
| Pagination 101 | PASS (prior browser run) | One attempt, overall PASS, 103 checks (status + attempts + 101 memory), final page Memory[198]–Memory[200]. Pagination code unchanged during stabilization. |
| Fault-code validation | PASS (prior browser run) | Missing code prevented save and error was included in accessible selector text; entered fields retained; repaired HALT case passed in one attempt. Error semantics unchanged. |
| Loop cancellation | PASS for cancellation; follow-up PASS separately | Loop at 10,000,000 budget observed running at 571,904+ attempts, then **Cancelled/paused at 736,000**, zero passes, T006_CANCELLED. Later screenshot retained same stopped count. A separate fresh reference case subsequently ran to PASS. |
| Debugger | PASS | F10 gave A=10/PC=1/one attempt. F5 halted at A=15, B=0, PC=2, SP=65536, three attempts. Shift+F5 reset to ready/zero attempts. F9 added a line-1 breakpoint; F5 stopped before execution at zero attempts; F9 removed only that audit breakpoint and Resume finished normally. Source already matched reference and was not replaced. |
| Refresh persistence | PASS | Saved `Days1-14 Stabilization Audit 20261024`, refreshed Brave, reopened panel and observed exact name/description/source/A15/B0/PC2/SP65536/three attempts. Run produced PASS in three attempts. |
| Stale PASS / real FAIL | PASS | Editing only expected A to 20 changed case to Not run, then execution showed FAIL with expected 20, actual 15; all remaining expectations passed. |
| JSON export | PASS | Real browser download completed: assembly-emulator-tests.json, 928 bytes. Actual file at D:/New_folder/assembly-emulator-tests.json parsed as format assembly-emulator-tests, version 1, id custom and exact audit definition/expectations. Kept for manual import check. |
| Native JSON import | UNVERIFIED / MANUAL ACTION REQUIRED | Earlier native picker submission triggered Windows URL-verification failure. No alternate UI/API was used to bypass that restriction; safe Merge/reject-invalid flows remain covered automatically. |
| Responsive layout | PASS for observed 390×844 editor/panel/create form; pagination/cancel mobile retest UNVERIFIED | DevTools showed width 390 and height 844; panel tabs, header/close, register/memory/status/budget fields, import/export and Save/Cancel were visible/reachable through vertical scrolling. Normal viewport was restored and DevTools closed. No browser performance/contrast certification is implied. |
| Keyboard/console | PARTIAL | F-keys, keyboard selector use, visible focus and Escape panel close/focus return were observed. Console showed React DevTools/HMR/Fast Refresh messages, no visible application exception/hydration mismatch. Issues panel reported **0 page errors, 0 breaking changes**, four form-field improvements; identifiers fixed in source, but final clean Issues check pending. |
| Temporary deletion confirmation | UNVERIFIED / BLOCKED | Delete confirmation for the named audit case displayed correctly. Escape dismissal triggered Windows URL-verification failure. No subsequent browser inputs were made. Whether it was dismissed is unknown; deletion was not confirmed. |
| Production | PENDING | Current Day 14 commit/deployment identity not confirmed. Production was not tested or changed. |

## Cleanup, manual actions and conclusion

The user intentionally deleted the earlier Pagination/Day14 audit collection during this work and confirmed that action. The agent did not delete/replace it or reconstruct it without consent. Only the new `Days1-14 Stabilization Audit 20261024` case was created by this stabilization; it may remain saved with expected A=20. Its deletion confirmation may still be open. After restoring safe browser access, dismiss/complete only this audit-case deletion and preserve all other data. The export file and earlier temporary JSON files remain intact for required manual import checks.

Remaining manual checks: close native confirmations, restore Brave at localhost:3000; verify post-fix Issues after reload; test native Import with **Merge**, inspect conflicts before confirming, then reject malformed JSON without losing good cases; recheck mobile pagination/cancellation; finish audit-case cleanup. If URL verification fails, stop that interaction. Do not use browser scripts, alternate import hooks or security changes to circumvent it. Verify all local gates under an already available Node 24 when possible. After the user commits/deploys Day 14, confirm the deployment identity before the production smoke checklist below is executed.

Implementation through Day 14 is **stable enough for Day 15 preparation: YES, with the listed acceptance/runtime gates still pending**. This is not a fully verified release or a claim of a perfect application. No Day 15 implementation or workflow was started. Historical records follow.

# Day 14 verification — reliability, security and production readiness

Overall readiness: **PARTIAL**. All local quality gates pass; deployment-target Node 24 execution and Day 14 browser acceptance remain outstanding. The user reports all ten Day 13 Brave checks passed. Those are user-provided results, not browser automation performed here. Fresh Day 14 discovery returned no apps or browsers.

## Changes and confirmed fixes

Day 13 changes were already present and uncommitted when this audit began; they were preserved. Day 14 modifies `src/components/panels/test-cases-content.tsx`, `src/components/panels/test-case-form.tsx`, `tests/test-panel-render.test.mjs`, README, docs/TESTING.md and this record, and creates `tests/readiness.test.mjs`.

- A valid definition could render thousands of assertion/expectation/failure DOM rows, even inside closed details. Added 100-item pages for expectations, assertion results, failure reasons and diagnostics. Every recorded result remains accessible; engine semantics and storage are unchanged. A real 1,000-memory-assertion regression verifies 100 rendered result rows while all 1,001 outcomes and 1,000 failures remain intact.
- Fault/status select errors were not programmatically associated with their controls. Added matching error IDs, aria-describedby and invalid state, preserving existing labels and form behavior.

No CPU/ISA, dependencies, lockfile, runtime settings or deployment configuration changed. No generated worker was manually edited. No installation/download was performed; the requested npm audit queried advisory metadata only.

## Actual quality results

| Gate | Result |
| --- | --- |
| npm run lint | PASS, zero warnings/errors |
| npm run typecheck | PASS |
| npm test | **509 passed, 0 failed, 0 skipped**; all 504 baseline tests preserved, five new Day 14 checks |
| npm run build | PASS; Next.js 16.4.2 compilation, TypeScript and static generation; no build warnings |
| npm audit --omit=dev | PASS, **0 production vulnerabilities** |
| git diff --check | PASS after whitespace normalization |
| Local production HTTP smoke | PASS: `/` 200; `/monaco/editor.worker.js` 200; unknown route 404; X-Powered-By absent |
| Runtime | Node **26.12.1**, npm **11.20.0** |

The loopback-only production server was stopped after checking responses. HTTP/server-render checks do not verify browser hydration, client execution, layout or input delivery.

## Reliability, security and performance evidence

Automated: existing parser/assembler encoding, all 19 CPU instructions, signed boundaries, branch/call, atomic faults, attempt budgets and reset/load tests pass. Debugger rapid actions, breakpoint/Run-to-Cursor cancellation, speed equivalence, disposal, trace filters/navigation/export and 500-attempt retention tests pass. Private test CPU isolation and all 14 predefined fixtures pass. Custom pass/fail/error/limit, snapshots, input memory, storage recovery/quota, JSON roundtrip and stale-run protection remain passing.

New high-risk tests cover maximum-size 100-case suites repeated three times, sequential scheduling and bounded result counts; malicious JSON prototype keys with atomic import rejection and valid-entry storage recovery; invalid UTF-8 and oversized file rejection before reading; definition edits cancelling old callbacks; and large assertion rendering. A focused run measured **51.8 ms** for three 100-case suites using injected immediate timers, 300 callbacks total. This is a local engine/controller measurement, **not browser responsiveness or a memory-leak benchmark**.

Reviewed: application runtime has no eval, dynamic execution of imported JavaScript, unsafe HTML insertion or external user-data transmission. Imported records pass strict allowlists/range validation and owned copies; prototype keys are rejected. React escapes source/names/diagnostics. Browser downloads use fixed/sanitized names and delayed URL revocation; no user-specified filesystem path is used. Source uploads are capped at 1 MiB with fatal UTF-8 decoding; custom libraries at 2 MiB/100 cases with 1 MiB per source. No recorded assertion data is discarded by paging. Local storage is synchronous, browser-local and not cross-tab synchronized; changed/corrupt saved test data is protected from automatic overwrite. No matching tracked secret-key/environment files or generated dependency/build/worker paths were found by the filename scan; this is not a credential-history audit.

Reviewed: debugger memory projection reads at most 32 words and disassembly 64; trace is a fixed 500-entry ring. Runtime/UI projections avoid whole-memory snapshots per attempt. Test execution yields each 256-attempt batch; debugger uses existing bounded speed batches. Validation, assembly, JSON serialization and result evaluation remain synchronous. No browser heap profiling or leak claim is made. Native dialogs, labels, focus containment, editor fallback, scoped shortcuts and responsive rules were reviewed; Day 14 physical keyboard, contrast and narrow-layout behavior have not been independently exercised.

## Node 24 gap and reproducible verification

package.json declares node 24.x; root lockfile dependencies/devDependencies/engines match the manifest. Existing scripts use native Node tests and TypeScript stripping; Next configuration is minimal and runtime code remains client-local. Only Node 26 was found on PATH and in the checked project/common version-manager locations. No `.github` CI workflow exists. Node 26 success does **not** establish Node 24 compatibility.

Recommended minimal future CI: checkout the project, select Node 24 with setup-node, then run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --omit=dev`. This is a recommendation, not an executed or remotely installed workflow. Run the same commands locally under an already available Node 24 before release; fresh dependency installation/runtime downloads need the user's approval. No CI or Vercel settings were changed.

## Brave/production smoke checklist for Day 15 preparation

1. On the user's release URL or local production server, verify initial loading/hydration and local Monaco worker without console/network errors. Check desktop and narrow layouts, fallback editor and scroll containment.
2. Assemble `ldc 10 / adc 5 / HALT` on separate lines. F10 gives A=10/one attempt; F5 finishes A=15, PC=2, three attempts. Shift+F5 resets; F9 breakpoint, Resume, Run to Cursor, Pause, speed changes and source replacement retain their documented cancellation semantics.
3. Inspect memory 0/65535 and trace row selection/filter/navigation; export trace JSON. After 500+ attempts check retention/discard count and that inspection does not mutate the live CPU.
4. Run all 14 fixtures: PASS. Create/edit a custom PASS, then A=20 mismatch: FAIL with actual 15. With a large valid imported case, verify Next/Previous expectations/results/failure pages, keyboard activation, and no hidden failing assertion being reported as overall PASS.
5. Validate a missing expected fault code: error should be associated with the select for assistive technology. Check Tab/Enter/Space, close/Escape and restored focus, storage warnings and announcements without obscured controls.
6. Cancel/close during a long test suite and rapidly rerun; compare live debugger state before/after. Save/reload definitions, export/import merge/replace and reject malformed JSON. Use a disposable profile for corrupt/quota/unavailable storage recovery. Confirm actual browser downloads, source autosave/file guards and undo/redo.

Ready to proceed with Day 15 preparation once the outstanding checks are accepted; **Day 15 was not started**. No commits, pushes, destructive Git operations, deployments or remote settings changes. Historical records below retain their original evidence.

# Day 13 rebuild verification

Rebuilt from the clean Day 12 baseline on 23 October 2026. Previous Day 13 changes had been removed; earlier reported Day 13 counts are superseded by this rebuild.

Implementation: functional separate Test Cases panel, 14 fixtures, custom create/edit/duplicate/confirmed delete, source snapshots, exact assertions, real results, progress/cancellation, versioned local storage and confirmed JSON merge/replace. Reuses unchanged Day 12 assembler/CPU/testing engine. One private test CPU at a time; at most 256 attempts per scheduled batch. No CPU/ISA semantics changed.

New files: `src/lib/testing/{library,form,panel-controller}.ts`, `src/components/panels/{test-case-form,test-cases-content}.tsx`, `tests/test-panel.test.mjs`, `tests/test-panel-render.test.mjs`. Modified: `src/components/layout/ide-workspace.tsx`, `src/components/panels/tool-panel.tsx`, `src/app/globals.css`, README, testing guide and this record. No packages or runtimes installed; generated Monaco assets use the unchanged build preparation script.

Verified real scenarios: all 14 fixtures PASS; addition returns A=15, B=0, PC=2, SP=65536 and three attempts; expected A=20 correctly FAILS against actual 15. Explicit matching runtime faults pass; unexpected faults/assembly failures fail. Budgeted loops stop, cancellation marks unfinished cases cancelled, late callbacks cannot overwrite a newer run, and disposal cancels timers/notifications. Storage recovery retains valid entries without overwriting damaged data; quota failures preserve in-memory definitions. JSON roundtrips preserve definitions and conflicts rename predictably. An active real debugger snapshot and pending callback remain unchanged after the test suite.

Automated checks: **504 tests passed, 0 failed**, including all 467 baseline tests plus 37 new tests. Lint/typecheck/build PASS; production audit **0 vulnerabilities**. One initial render-test assertion incorrectly expected a React HTML comment; corrected to match visible text. No application result was fabricated. Render tests verify native form submission controls, fixture controls, source escaping and actual expected/actual result markup; they do not verify physical keyboard/pointer delivery.

Runtime: existing Node **26.12.1**, npm **11.20.0**. Node **24.x** deployment-target verification remains pending. Browser discovery in this session returned no apps/browsers. No browser checks are claimed. No commits, pushes, deployments or Day 14 work.

## Brave acceptance checklist

1. Open Test Cases at desktop/mobile widths; check section navigation, Tab/Enter/Space, expanders, scrolling, Escape/close and restored focus.
2. Run all predefined: 14 PASS, zero failed. Create `ldc 10 / adc 5 / HALT` on separate lines; assert A=15, B=0, PC=2, SP=65536, halted and three attempts. Expect PASS. Edit A to 20: FAIL, actual 15.
3. Save/refresh/reopen: IDs/order/source survive. Edit the main editor: saved test source stays fixed. Exercise Duplicate, Delete confirmation and explicit source replacement; verify invalid values and duplicate addresses show field errors.
4. Export and inspect JSON; import with Merge then Replace, checking confirmations/conflict names. Cancel confirmation and import malformed/oversized files: original tests survive. Verify actual download completion.
5. Run `br -1` with budget 300 and explicit limit-reached: PASS at 300. Start a longer suite, Cancel/close rapidly, reopen: no late execution/results. Compare live debugger registers/memory/breakpoints/trace/attempts before and after tests.
6. Test unavailable/quota/corrupt storage in a disposable browser profile; valid entries survive and original data stays protected. Recheck Monaco, autosave, source file handling and execution shortcuts outside the dialog.

Status: implementation and automated checks complete; **release acceptance remains unverified** until browser and target-runtime checks pass. Day 14 has not started. Historical Day 12 record follows.

# Day 12 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator` using existing **Node 26.12.1 / npm 11.20.0**, executable `C:\Program Files\nodejs\node.exe`. Node 24.x was unavailable on PATH and in the previously checked project/version-manager locations. **The Node 24.x deployment target remains unverified.** No runtime was installed or switched.

## Actual checks

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; includes positive/negative testing contracts |
| `npm test` | PASS; **467 tests, 0 failures**, all existing 373 unchanged plus 94 Day 12 tests; none skipped/cancelled |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript and static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Day 12 browser verification | NOT RUN; engine-only work, browser runner intentionally disabled |

The user reports Day 11 browser verification passed. This is user-provided evidence, not a fresh browser run by this task; the older checklists below are historical. No packages, frameworks, browser binaries or runtimes were installed/downloaded. The requested audit fetched advisory metadata only. Dependencies, lockfile and configuration are unchanged.

## Files and engine boundary

Created:

- `src/types/testing.ts`: serializable definitions, assertions, results and session contracts extending the existing `TestCase` model.
- `src/lib/testing/validation.ts`, `assertions.ts`, `index.ts`: strict validation, exact comparison, isolated incremental/async execution and sequential suites.
- `src/lib/testing/fixtures.ts`: 14 standalone predefined definitions with real source and expectations.
- `tests/testing.test.mjs`, `tests/testing.typecheck.ts`: runtime integration and type-contract regressions.
- `docs/TESTING.md`: schema, API, scheduling/cancellation, result policy, fixtures and limitations.

Modified `README.md`, this record, the testing-policy paragraph in `docs/ISA_DESIGN.md`, and explanatory text in `src/components/panels/tool-panel.tsx`. Both Test Cases actions remain disabled, with no engine imports/handlers or new panel integration. Assembler/CPU code, ISA semantics, workspace controller, debugger, Monaco, document handling and all existing tests are unchanged. No generated worker was edited.

`runTestCase(definition)` / `runTestSuite(definitions)` use each definition's own source, matching the existing contract. `createTestExecution` / `createTestSuiteExecution` expose bounded `advance`, detached `getProgress` and idempotent `cancel`. Every case assembles its own image, creates/loads a private CPU, applies validated initial inputs using checked APIs, and evaluates actual execution. Suites preserve declaration order and activate only one CPU at a time. Invalid members count as failed; duplicate IDs invalidate all conflicting members. A valid empty suite passes with zero cases; a malformed suite fails with diagnostics.

Default completion is HALT. Explicit negative cases require error status plus exact runtime code, or explicit limit-reached status. Only declared A/B/PC/SP, memory and attempt values are compared, exactly. Duplicate assertion/input targets, invalid integer ranges, unknown fields, sparse/accessor data and invalid completion expectations are rejected before assembly. Assembly/setup/empty-image/cancellation failures cannot satisfy an expected fault. Results contain real expected/actual values, individual outcomes, failure reasons and original diagnostics/source spans. Expected faults can pass as negative tests while retaining the actual CPU error diagnostic.

The CPU default **100,000-attempt** budget is retained, with validated overrides 1–10,000,000. Each advance executes at most **256 attempts**; async helpers yield a timer turn between unfinished batches/cases. AbortSignal cancellation also releases a pending custom scheduler wait; late resolution cannot resume execution. Finished results remain final. Final state copies all four registers and only asserted memory cells, with no full-memory snapshots per instruction or retained traces. Private CPU memory is released on completion/cancellation.

## Real execution evidence

All **14 predefined fixtures PASS** through both the new engine and an independent direct assembler/load/setup/run/final-snapshot path. Details and source definitions are in [TESTING.md](docs/TESTING.md) and `src/lib/testing/fixtures.ts`.

| Program | Actual key result | Actual CPU status | Attempts | Test result |
| --- | --- | --- | --- | --- |
| Constant | A=42, PC=1 | halted | 2 | PASS |
| Addition | A=15, B=10 | halted | 4 | PASS |
| Subtraction | A=13 | halted | 4 | PASS |
| Signed arithmetic | A=-3 | halted | 3 | PASS |
| Signed overflow | A=-2147483648 | halted | 4 | PASS |
| Memory store/load | A=-7, M[100]=-7 | halted | 7 | PASS |
| Stack relative | SP=65536, M[65535]=42 | halted | 6 | PASS |
| Conditional branch | A=7 | halted | 4 | PASS |
| Countdown | A=0, PC=4 | halted | 12 | PASS |
| Call/return | A=B=7, PC=2 | halted | 4 | PASS |
| HALT | PC=0, SP=65536 | halted | 1 | PASS |
| Invalid access | Explicit C005_INVALID_ADDRESS, PC=1 | error | 2 | PASS (expected fault) |
| Infinite loop | Explicit budget of 16, PC=0 | limit-reached | 16 | PASS (expected limit) |
| Initial memory | M[100]=1234, A=1234 | halted | 3 | PASS |
| Intentional mismatch: `ldc 10 / adc 5 / HALT` | Expected A=20, actual A=15 | halted | 3 | FAIL, as required |

The intentional failing result is asserted by a passing automated regression; it is not a failing test in the 467-test project suite.

## Regression coverage and limitations

The 94 new tests cover valid/invalid serializable definitions; all registers and signed/address boundaries; strict values and duplicate/conflicting assertions/inputs; exact multi-failure results; assembly diagnostics/spans with no execution; empty images; six real runtime fault paths with expected/unexpected/wrong-code outcomes; HALT/fault versus last-attempt limit precedence; default and custom infinite-loop budgets; bounded incremental work; real event-loop yielding; pre-start/partial/blocked-scheduler cancellation; rejected schedulers; independent initial-memory/code patches; detached definitions/results; sequential ordered suites, empty/malformed/sparse suites, duplicate IDs and failure isolation; repeated deterministic results; and every fixture independently checked through the CPU. Test scheduling may be simulated, but instruction semantics are never mocked.

An integration regression runs the new suite while the existing workspace has an active scheduled Run-to-Cursor session and breakpoint. The debugger view, memory window, source, pending timer and attempt count remain unchanged; its original callback then stops normally at the cursor. This checks that testing does not mutate or cancel the live workspace.

Validation, assembly, setup and final assertion evaluation remain synchronous; CPU execution is cooperatively scheduled, not worker-preempted. Large sources/assertion lists can still take time in those phases. Custom host schedulers must yield a real browser turn. Separate explicitly created sessions are independent and scheduled by their caller; a suite itself never executes cases concurrently. Final results include only asserted memory cells, not a whole-memory replay image. Definitions/results are JSON-ready, but browser creation, persistence, import/export and execution/results UI are **Day 13 work**.

Optional Brave boundary checks: open Info/Test Cases and verify accurate engine-only text and both disabled actions; run the existing `ldc 10 / adc 5 / HALT` debugger flow (A=15, PC=2, three attempts); confirm trace, breakpoints, autosave and document controls remain available. These checks were not performed during Day 12. There is no browser testcase-runner workflow to verify yet.

Day 12 is complete and provides the API/fixtures for Day 13; **Day 13 has not started**. No commits, pushes, deployments, GitHub/Vercel operations, backend features, time travel or watchpoints were added. Earlier records below remain historical.

# Day 11 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator` with existing **Node 26.12.1 / npm 11.20.0** (`C:\Program Files\nodejs\node.exe`). Node 24.x was not available on PATH, in project tools, or the checked version-manager locations. **Node 24.x remains the target and is unverified**; no runtime was downloaded or changed.

## Day 11 actual results

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS; **373 tests, 0 failures**, all existing 341 unchanged plus 32 Day 11 tests; none skipped |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript and static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Browser automation | NOT RUN; computer-use discovery returned no apps or browsers |

The user reports Day 10 browser verification passed. Day 11 browser checks below remain pending. Server rendering and handler tests do not verify physical keyboard delivery, pointer behavior, scrolling, responsive layout or completed downloads. No dependencies, frameworks, browser binaries or runtimes were installed/downloaded; the requested audit fetched advisory metadata only. No dependencies/configuration were upgraded or changed.

## Files and debugger behavior

Created `src/lib/workspace/shortcuts.ts` and `tests/debugger-finalization.test.mjs`. Modified `src/lib/workspace/controller.ts`, `src/lib/workspace/debugger.ts`, `src/components/editor/monaco-editor.tsx`, `src/components/layout/ide-workspace.tsx`, `src/components/toolbar/execution-toolbar.tsx`, `src/components/panels/debugger-panel.tsx`, `src/components/panels/memory-panel.tsx`, `src/components/panels/output-panel.tsx`, `src/components/panels/tool-panel.tsx`, `src/app/globals.css`, `README.md`, and this record. CPU/assembler/ISA/types, the React execution adapter, existing tests, dependencies/lockfile and generated Monaco preparation logic are unchanged. No generated worker was edited.

F5 runs/resumes, F10 attempts one instruction, Shift+F5 resets and source-editor F9 toggles a breakpoint. The IDE capture handler runs before Monaco and stops propagation for handled debugger keys, so Monaco cannot trigger a second command. Its separate shortcut helper leaves existing Ctrl+S/Ctrl+N behavior untouched. Autorepeat is consumed without invoking another action. Active/ready IDE focus, dialog/input/composition/modifier checks scope commands; F9 additionally requires source-editor focus and a valid line. Disabled/terminal commands consume the scoped IDE key without executing or refreshing the page. Outside the IDE, dialogs and unrelated inputs, native browser keys remain untouched. Controller state is read at event time. The old Monaco F9 keybinding was removed to avoid duplicate paths; its named editor action remains. Tooltips and aria-keyshortcuts expose execution keys.

The audit confirmed speed controls were hidden at narrow widths; they now remain visible when the toolbar wraps. Reset now restores the documented **Normal** default while preserving permanent breakpoint definitions and source. Slow/Normal/Fast remain maximum batches **1/64/512** with requested delays **200/32/16 ms**; changes cancel/reschedule the existing one-session scheduler and do not change semantics or budgets. Pause, Reset, source replacement and disposal still invalidate late callbacks. The breakpoint list explicitly marks the current hit, independently of the blue active-PC indication and enabled/disabled gutter dots.

Memory still reads/displays at most **32 cells** through checked access, with signed decimal and hex values. Program navigation returns to word 0; PC/SP and Previous/Next remain. Jump accepts decimal/hex addresses 0–65,535; invalid values neither wrap nor change the window. At 65,535 only the final cell is displayed. Empty-stack SP shows the final 32 cells. Existing PC background styling could mask a changed-memory background at the same cell; an independently labeled changed-value dot now preserves that signal. No full-memory copies or rendering were added.

Download Trace creates `assembly-emulator-trace.json` from **all retained recorded entries**, independent of filters/selection. Format version 1 contains original attempt/PC/fetched word, decoded mnemonic/opcode/operand or null for invalid bits, before/after registers, committed memory deltas, actual result/error/source and modification flags. Metadata records cumulative attempts, the **500-entry cap**, retained count and discarded count since clear, explicitly excluding discarded/cleared history. Serialization selects compact fields and cannot include the legacy optional memory snapshot. Cleared history is not reconstructed, later attempts are not renumbered, and export does not publish or mutate CPU state. Object URLs are revoked after the local download request; their cleanup timer does not execute CPU work or update React state. The filename is fixed and safe; failure/request feedback is shown. No CSV, external service or replay/import capability was added.

Runtime error presentation reuses structured diagnostics and the real decoder. Errors retain their codes/messages/source spans, adding PC, fetched instruction/hex word and relevant memory address/SP/target PC/shift count where available. Invalid encodings show raw bits/opcode rather than an invented decode. Execution-limit context reports stopped PC and cumulative attempts without claiming an extra fetch. CPU validation/commit semantics and fault-versus-HALT/limit precedence are unchanged; runtime faults remain atomic and terminal, with no successful-execution message afterward.

## Regression evidence

All **32 new tests** use real assembler/CPU execution; only scheduling and UI event delivery are simulated. They cover key mapping/scoping, modifier/browser exclusions, held keys, unassembled/busy/terminal states, rapid Step, Ctrl+S/Ctrl+N preservation, keyboard breakpoint/Run-to-Cursor interactions, Reset races/default speed, speed rescheduling, pause/source/disposal cancellation, memory endpoints/invalid inputs, compact JSON accuracy/store/fault/self-modification fields, filter/selection/export isolation, eviction/clearing IDs, immutable exported history across reset, runtime context for memory/SP/branch/shift/opcode/encoding faults, and exact limit context/export. Real TSX rendering checks shortcut labels, speed selection, changed/PC memory markers, Program navigation, breakpoint-hit markup and download-button states.

Five assembled programs (addition, stack store/load, call/return, memory fault, self-modification) produce identical final registers/status/attempt counts, relevant low/high memory windows and complete compact histories across Slow/Normal/Fast, with export/selection leaving live state unchanged. Existing full CPU snapshot equivalence, loop, breakpoint, source invalidation, terminal precedence and Day 9 selection regressions remain unchanged and pass. A default-budget loop exports exactly attempts **99,501–100,000**, reports **99,500 discarded**, and includes the final limit-reached attempt with no extra instruction.

## Focused manual Brave checklist

1. In Monaco and fallback source editors, assemble `ldc 10 / adc 5 / HALT` on separate lines. F10 should give A=10/one attempt; hold F10 and confirm no additional attempts from autorepeat. F5 should finish at A=15, PC=2, SP=65,536, three attempts. F5/F10 at terminal state must not execute or refresh. Shift+F5 resets attempts/history and speed to Normal. F9 toggles once per press, including before assembly; hold it to verify no flicker/repeated toggles. Check toolbar tooltips.
2. Verify key scoping in Info/Test Cases dialogs, Monaco find fields, memory/breakpoint inputs, speed selects and outside the IDE. Ctrl+S/Ctrl+N retain existing source download/guarded Create behavior. Modified F-keys such as Shift+F10 retain browser behavior. In loop breakpoints, confirm hit labels, red dots versus blue PC, one-time Resume bypass, Step, removal/clear and Run-to-Cursor cancellation.
3. At desktop and narrow/mobile widths, confirm Slow/Normal/Fast remain visible and the toolbar wraps without covering the editor. Change speed while running, Pause, rapidly Run/Pause/Step/Reset, and edit/replace source or leave the workspace. No stale goal/session or duplicate attempt should appear. Reset must restore Normal, source and breakpoint definitions retained.
4. Jump to 0, 0xFFFF/65,535, Program, PC and SP; verify decimal/hex, bounded rows, final-cell/empty-stack behavior and graceful invalid inputs such as -1/65,536. Use the self-modifying cursor example to confirm a changed-value dot remains visible on the PC row. Recheck memory scrolling and small-panel readability.
5. In Execution Trace, select/filter entries, then Download Trace. Confirm the safe JSON filename and all retained rows regardless of filter, original attempt numbers, before/after registers, real store deltas and fault/HALT data, plus 500-entry/discard metadata. At more than 500 attempts and after Clear trace, confirm no invented older rows or renumbering. Download/inspection must not change live state. Recheck row clicks, Enter/Space, Previous/Next, detail reveal, eviction and source navigation.
6. Run memory/SP/branch/shift/unsupported-opcode faults and `br -1` to its limit. Confirm readable code/source/PC/instruction/target context, no successful result after error, and Reset clearing diagnostics. Recheck autosave, upload/download, undo/redo, local Monaco worker loading, dialogs and existing controls. Test Cases actions remain disabled.

## Day 11 boundary

Day 11 implementation and automated verification are complete, with **Node 24 and Day 11 Brave checks pending**. This is the tested baseline for Days 12–13; **Day 12/custom test-case execution has not started**. No required files/tests were deleted. No commits, pushes, deployments, GitHub/Vercel operations, time-travel execution, memory watchpoints, backend/database/authentication or AI features were added.

The Day 10 and earlier records below are historical, including their earlier speed-reset and shortcut descriptions.

# Day 10 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator` with existing **Node 26.12.1 / npm 11.20.0**. The executable on PATH is `C:\Program Files\nodejs\node.exe`; no Node 24 executable was found in the project tools or checked version-manager locations. **Node 24.x remains the deployment target and is unverified.** No runtime was downloaded or switched.

## Day 10 actual results

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS; **341 tests, 0 failures**: all original 302 unchanged plus 39 Day 10 tests; none skipped |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript and static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Browser automation | NOT RUN; fresh discovery returned no apps or browsers |

The user reported that the Day 9 row-selection fix was manually verified. Day 10 pointer/keyboard/scrolling checks below remain pending; server-rendered component tests do not substitute for a browser. No packages, browser binaries, frameworks or runtimes were installed/downloaded. The requested audit fetched advisory metadata only; no dependency upgrades or audit fixes were performed.

## Changes and behavior

Created `tests/advanced-debugger.test.mjs`. Modified `src/lib/workspace/controller.ts`, `src/lib/workspace/debugger.ts`, `src/components/editor/monaco-editor.tsx`, `src/components/editor/editor-pane.tsx`, `src/components/editor/editor-fallback.tsx`, `src/components/layout/ide-workspace.tsx`, `src/components/toolbar/execution-toolbar.tsx`, `src/components/panels/debugger-panel.tsx`, `src/components/panels/trace-table.tsx`, `src/components/panels/tool-panel.tsx`, `src/app/globals.css`, `README.md`, and `VERIFICATION.md`. The CPU/ISA/assembler, React adapter, existing 302 tests, dependencies/lockfile and configuration are unchanged.

Run to Cursor uses the existing validated instruction-line map, private CPU and bounded scheduler. Monaco provides a context-menu action using its current position; the compact main-toolbar action uses the tracked editor line and works with the fallback textarea. Both open Execution Trace for feedback. Current ready/paused assembly is required. Invalid/non-executable lines are rejected without CPU changes; inline labels and BOM/CRLF resolve correctly. Targets stop before execution with no consumed attempt or trace entry, immediately with no timer if already at PC. Modified words stay at their original assembled instruction address with a notice. Permanent breakpoint definitions/enabled flags are untouched.

Earlier permanent breakpoints stop first and retain the pending goal; Run continues toward it, bypassing the current stopped address once. Later loop revisits still stop. At a shared target/breakpoint address the cursor stop wins once, and subsequent Resume bypasses that address once. Pause/Cancel target (including at an intervening breakpoint), Step, Reset, reassembly, source edits/replacements and disposal clear temporary targets. Speed changes preserve the target. Step then attempts exactly one instruction. HALT, atomic faults and limits retain normal CPU precedence and clear the goal. An unreachable target cannot renew the budget. A final permitted instruction that reaches the cursor address still reports limit-reached, without another attempt or replacement cursor stop. Stops reached at a batch boundary are recognized before scheduling another timer.

The controller audit found that retained execution actions could start work after `dispose()`. Execution and scheduling now reject disposed controllers, notifications are suppressed, and disposal clears the cursor goal. A fresh subscription reactivates the controller for the existing Strict Mode lifecycle. Generation-token/session cancellation, one pending timer, checked memory reads, compact per-attempt records and once-per-batch publication remain intact. Busy-command notices are cleared when execution stops so an obsolete “Pause before choosing another cursor target” message cannot survive a completed stop. No CPU semantics or instruction attempt counting changed.

Trace filtering is local presentation state: All attempts, Memory writes, Branch / control flow, Faults / terminal events. Writes require a committed delta, including unchanged-value stores; failed stores do not match. Control flow uses actual decoded opcodes 13–18 (call/return/brz/brlz/br/HALT), including untaken branches. Terminal matches error/halted/limit-reached results. The 500-entry ring and original cumulative IDs are unchanged. Previous/Next select nearest matching attempts; Next chooses the first match without a selection. Empty filters explain no matches. Filtering can hide a selected row while retaining its details with a notice; eviction removes the selection/details. Whole-row clicks, native Enter/Space Step buttons, single activation without bubbling duplicates, detail reveal, and reliable Go to source are preserved. Terminal/error text uses restrained colors; controls wrap on small panels. No search, time travel, watchpoints or custom test runner was added.

## Regression evidence

All 39 new tests use the real assembler and CPU; only scheduling and UI event delivery are simulated. Coverage includes initial/current/forward/backward/call-return targets, invalid lines, pending/current assembly, earlier/shared/loop breakpoints, Resume/Step/Pause interactions, every target-cancellation path, speed changes, rapid controls and stale callbacks, disposed actions/Strict Mode resubscription, modified targets, label alias deduplication, HALT/fault/limit precedence, committed/unchanged/failed stores, actual opcode filtering, hidden/evicted selections, and real TSX Previous/Next controls with native button accessibility. The six Day 9 selection regressions remain unchanged and pass.

Six assembled programs (addition, countdown, stack memory, call/return, fault, self-modification) produce identical final CPU overviews, relevant low/high memory windows, and complete compact attempt histories with ordinary Run versus cursor/breakpoint/filter interactions. Existing full traced/untraced CPU snapshot consistency tests also pass. Default-budget loops stop at exactly **100,000 attempts** with **500 retained / 99,500 discarded**, including a program whose final allowed branch reaches the cursor PC but correctly remains limit-reached. No full memory snapshots were added to execution/UI paths.

## Required manual browser checks

1. Assemble `ldc 10 / adc 5 / HALT` on separate lines. Put the cursor on line 3 and use both Monaco's Run to Cursor context action and the main toolbar. Expect cursor-paused at PC=2, A=15, two attempts/two trace rows; Step or Run then executes HALT as attempt 3. Targeting initial line 1 must stop immediately with zero attempts. Check the same toolbar workflow with Monaco fallback.
2. Try comments, blank/data/label-only lines and inline instructions; confirm accurate rejection or resolution and visible feedback. In the countdown example, set a loop breakpoint and target HALT. Resume through loop stops; the goal must remain pending until reached. Test a shared breakpoint/target address, disabled breakpoints, backward targets, Step cancellation and Pause/Cancel target while stopped at an earlier breakpoint.
3. During cursor execution, change speed, Pause/Reset, edit/undo, Create/upload/choose another example, reassemble (including failures), and leave/unmount the workspace. Targets must not survive cancellation or act on old images. Test rapid Run/Pause/Step/Reset and terminal programs; no duplicate attempts or restart without reset/reassembly.
4. Use a stack-store program and all four trace filters. Confirm committed store rows, untaken/taken branches, call/return/HALT classification, error/limit rows, retained original step IDs, empty-match messages, and Previous/Next behavior across gaps. Hidden selections keep details and a notice; filters never change live registers, memory or attempts.
5. Recheck whole-row/Step button selection, highlighting, historical A=10 while live A=15, Enter/Space, detail reveal/reselection and source navigation. At Fast speed, let selected old entries expire from the 500-entry ring; their details must disappear. Check responsive/narrow panels, select/button labels, disabled navigation endpoints, scroll position during ongoing execution, and focus preservation.
6. Recheck diagnostics/current-line versus breakpoint markers, worker loading, autosave/refresh, file guards/upload/download, undo/redo/find, Ctrl+S/Ctrl+N, Info/Test Cases and existing execution controls. Test Cases actions remain disabled. Browser runtime/debugger state remains session-local; draft storage still saves only source.

## Day 10 boundary

Day 10 implementation and automated checks are complete. Node 24 and Day 10 manual browser verification remain outstanding. This is the tested baseline for Day 11; **Day 11 has not started**. No GitHub operations, commits, pushes, deployments, time-travel execution, memory watchpoints or custom test-case execution were performed.

The Day 9 and earlier records below are historical.

# Day 9 verification

## Day 9 follow-up: trace selection fix

Verified with existing **Node 26.12.1 / npm 11.20.0** on 23 October 2026. Node 24.x remains the deployment target and was unavailable; no runtime or packages were downloaded or switched by this fix.

Investigation confirmed that the controller's numeric attempt IDs, selected-entry lookup, external-store publication, and historical details rendering already worked. Only the small Step button handled clicks; the rest of the row/cells were inactive. The details section also remained below the table inside the short, independently scrolling Output panel, with no reveal on selection. These UI omissions could make selection appear unresponsive. No blocking pointer overlay or CPU-state mutation was found in the selection path.

Extracted the existing table into `src/components/panels/trace-table.tsx` and made its entire row select the attempt. Native Step buttons retain keyboard activation and pressed state, use explicit `type="button"`, and stop click propagation to avoid double selection. `debugger-panel.tsx` reveals selected details after rendering, including repeated selection of the same entry, without moving keyboard focus. The effect depends on the selected attempt number, so ordinary execution refreshes do not continually scroll. One cursor rule was added to `globals.css`. No controller, CPU, scheduler, ISA, or dependency changes were needed for this follow-up.

Added `tests/trace-selection.test.mjs`: six regressions exercise the real TSX table handlers and server-rendered debugger panel with installed React/TypeScript and the real assembler/CPU. Coverage includes all four clickable cells, single publication per button activation, native keyboard-button semantics and detail-zero activation, selected-row/pressed-state rendering, historical A=10 followed by other entries, unchanged live A=15 / PC=2 / attempts=3, cumulative IDs after 500-entry rollover, and clearing selected details. The inactive-cell test failed before the handler fix; after the fix all six pass. Only click bubbling/browser activation delivery and scheduler timing are simulated; CPU execution is real.

| Follow-up check | Actual result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS; **302 tests, 0 failures**, all existing 296 unchanged plus 6 regressions; none skipped |
| `npm run build` | PASS; Next.js compilation, TypeScript, static generation; no build warnings |
| `git diff --check` | PASS |
| Browser interaction | NOT RUN; fresh discovery returned no apps or browsers |

Pending manual check: run `ldc 10 / adc 5 / HALT` on separate lines. In Execution Trace, click a row's PC/instruction/result or its Step button; confirm selected-row highlighting and revealed historical details (Step 1 A: 0 → 10). Select other steps and reselect the same step after scrolling away. Tab to Step buttons and activate with Enter/Space. Live registers must remain A=15, B=0, PC=2, SP=65,536 with three attempts and halted status. Check small/resized panels, focus preservation, and that continued execution does not repeatedly steal the scroll position. Real browser pointer hit-testing, scrolling and physical keyboard delivery are not covered by server-render tests.

No downloads, commits, pushes, deployments, or Day 10 work were performed. The original Day 9 verification below is historical and records its earlier runtime and test count.

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator`, using the existing **Node 26.2.0 / npm 11.13.0**. The project targets **Node 24.x**; only Node 26 is installed, so Node 24 verification remains pending. No dependencies, runtimes, browser binaries, or test frameworks were installed or downloaded. The requested audit fetched advisory metadata only.

## Day 9 actual results

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; existing contract fixtures preserved |
| `npm test` | PASS; **296 tests, 0 failures**: all 262 previous tests unchanged plus 34 debugger tests; none skipped |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript, static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Local production HTTP | Root, **8 client scripts**, **1 stylesheet**, and local Monaco worker return **200**; initial debugger/empty-history markup verified |
| Browser automation | NOT RUN; fresh computer-use discovery returned **no apps or browsers** |

The temporary production server bound only to `127.0.0.1:3100` and was stopped after verification; no listener remained. HTTP checks verify delivery and server markup, not hydration, visual layout, or live browser interactions.

## Implemented debugger and consistency

Created `src/lib/workspace/debugger.ts`, `src/components/panels/debugger-panel.tsx`, and `tests/debugger.test.mjs`.

Modified files (13): `src/lib/cpu/index.ts`, `src/types/cpu.ts`, `src/lib/workspace/controller.ts`, `src/components/editor/monaco-editor.tsx`, `src/components/editor/editor-fallback.tsx`, `src/components/editor/editor-pane.tsx`, `src/components/layout/ide-workspace.tsx`, `src/components/toolbar/execution-toolbar.tsx`, `src/components/panels/output-panel.tsx`, `src/components/panels/tool-panel.tsx`, `src/app/globals.css`, `README.md`, and `VERIFICATION.md`.

ISA, assembler/parser, CPU instruction preparation/commit semantics, loader/reset behavior, dependencies, lockfile, configuration, and all 262 previous tests remain unchanged.

Breakpoints bind exact one-based instruction source lines through validated assembler mappings. Inline labels work; label-only/comment/blank/data lines explain their non-executable status without sliding forward. Pending definitions resolve on assembly; resolved addresses are deduplicated. Per-definition enable/remove, clear, source navigation, Monaco gutter toggling/F9, and an accessible line form are available. Reset retains definitions/enabled flags; unchanged-source reassembly resolves again; edits/replacements clear definitions, bindings and history. Breakpoints are session-local. Modified instruction words keep their original bound address and display a notice.

Run checks PC before every attempt in the existing bounded scheduler. Breakpoint stops preserve registers, memory, status in the underlying CPU, and cumulative attempts; they create no trace. The view reports `breakpoint-paused`. Resume skips that address once, then later revisits stop again. Step attempts exactly one instruction through the same CPU executor. Existing cancellation tokens and one pending timer remain; subscribers receive one view per bounded batch, not one per instruction. Pausing before a resumed callback preserves the bypass until an actual attempt occurs.

`stepCpuTraced` returns one detached compact entry from the shared attempt/commit path. Entries contain cumulative attempt, actual fetched PC/word, decoded mnemonic/operand where valid, before/after registers, committed memory-write old/new values, result, fault diagnostic, and source only while fetched bits match the image. Modified bits compare against reset memory, including zero-fill beyond the image. Faulting traces preserve unchanged instruction state; HALT and final permitted attempts are recorded. Budget prechecks, terminal/no-op calls, and breakpoint stops have no entry. Traced fault diagnostics omit stale source positions. The controller owns a fixed **500-entry ring**; CPU snapshots retain their legacy empty trace field. There are no per-instruction memory snapshots. Old entries are dropped with a displayed count; reset/reassembly/source edits clear history. Clear trace keeps CPU attempts/state. Selection and source navigation inspect detached records without restoring machine state.

All 34 new tests use the real assembler/loader/CPU; only scheduling is simulated. Coverage includes breakpoint management, malformed maps, BOM/CRLF/non-executable lines, initial/multiple/loop stops, no consumed attempts, bypass/Step/disabled points, reset/reassembly/source invalidation, modified code including self-write and outside-image writes, fault/HALT/budget precedence, fetched bits/register snapshots/store deltas, 500-entry retention/eviction/clearing, a 100,000-attempt loop, detached history/source navigation/fallback offsets, rapid controls, stale callbacks, no duplicate timers, and bounded publication counts.

Six assembled programs (addition, countdown, stack store/load, call/return, runtime fault, self-modification) produce matching final register/PC/SP/status/attempt counts and memory projections through uninterrupted Run, breakpoint/resume, and repeated Step, with identical attempt histories. Direct traced and untraced CPU execution also matches **full CPU snapshots**, including complete memory. The loop retains steps **99,501–100,000**, discards **99,500**, and stops at exactly 100,000 attempts without an extra budget attempt. No CPU execution semantics are mocked.

## Pending manual browser checks

1. Confirm clean hydration and local Monaco/worker loading, then assemble `ldc 10 / adc 5 / HALT` on separate lines. Toggle line 1 using gutter and F9; Run must stop at PC 0 with zero attempts and no trace. Resume must reach A=15, B=0, PC=2, SP=65,536, halted, three attempts. Reset must preserve the breakpoint and clear history.
2. In the countdown example, break at the loop's instruction line. Resume repeatedly, Step while stopped, toggle enable, remove/clear, and try multiple points at Fast speed. Verify no skipped stops, immediate resume retrigger, duplicate timers, or attempts consumed by stops. Comments, label-only and data lines must show a non-executable explanation; inline instructions must resolve exactly.
3. Inspect trace selection, register-change styling, actual fetched words, memory deltas, HALT/fault/limit results, source navigation, and modified-word notices. Use `adj -1 / ldc 42 / stl 0 / HALT` for a real store. With `br -1`, confirm 500 retained entries/discard counts and responsive Pause. Clear trace must preserve cumulative attempts and current machine state. Selecting history must not rewind anything.
4. Edit, undo, Create/upload/choose an example, and reassemble while paused/running; confirm stale addresses/history are cleared and late callbacks cannot act. Reset restores modified memory and retains breakpoint enable flags; same-source reassembly re-resolves definitions. Test rapid Run/Pause/Reset and speed changes.
5. Verify keyboard access to the debugger button, result tabs, breakpoint form/checkboxes/buttons, trace selection and Go to source. Force Monaco fallback without installing software; line-based breakpoint management and textarea source navigation must remain usable. Check distinct red dots/blue current line, narrow/desktop layouts, panel resize/scrolling, and focus behavior.
6. Recheck existing diagnostics, autosave/refresh, upload/download, Ctrl+S/Ctrl+N, Monaco undo/redo/find/Tab focus mode, example/Create guards, and Info/Test Cases focus/Escape behavior. Custom test-runner actions remain disabled. Browser draft storage still contains only source, not CPU/debugger state.

## Day 9 boundary

Day 9 implementation and automated verification are complete, with **Node 24 and browser interaction checks pending**. This provides the tested baseline for Day 10; Day 10 has not started. No time-travel execution, advanced watchpoints, custom test-case runner, commits, pushes, deployments, or GitHub/Vercel operations were performed.

The Day 8 and earlier records below are historical; their previous disabled-debugger descriptions do not describe the current UI.

# Day 8 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator` using existing **Node 26.2.0 / npm 11.13.0**. The project still targets **Node 24.x**; that runtime is unavailable here, so target-runtime verification remains pending. No runtime or packages were installed/switched.

## Day 8 actual results

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; existing engine/CPU type fixtures preserved |
| `npm test` | PASS; **262 tests, 0 failures**, all 234 existing tests plus 28 workspace integration tests; none skipped |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript, static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Local production HTTP | Root, **8 client scripts**, and local Monaco worker all return **200** |
| Initial server markup | Five execution controls disabled pending client draft restoration; idle/no image state and no current binary |
| Browser automation | NOT RUN; computer-use discovery returned **no apps or browsers** |

The temporary localhost production verification server was stopped. HTTP/build checks verify served markup/assets, not browser hydration or live interaction. Initial client state matches server output; the browser-only scheduler is invoked only by client actions. No hydration-warning suppression was added.

## Implemented integration

Added `src/lib/workspace/controller.ts`, `markers.ts`, and `use-execution.ts`, plus `tests/workspace.test.mjs`. Updated the existing workspace, execution toolbar, register/memory/results panels, Monaco/editor pane, Info/Test Cases explanatory text, example comments/descriptions, metadata, styles, README, and this record. Added `getCpuOverview` and its compact type to the CPU API; instruction execution, ISA, assembler/parser, loader/reset semantics, dependencies, lockfile, configuration, and all existing tests are unchanged. File handling/autosave/shortcuts remain in their existing modules.

Assemble calls the real assembler and loader without execution. It projects actual word count/bytes/symbol count, signed CPU values, paged machine words, decoded memory bits, and original source lines. Failed assembly clears executable state. Step attempts one instruction; Run resumes a valid ready/paused image through bounded batches; Pause cancels pending callbacks; Reset restores the loaded image and zero attempts without compiling or changing source. Source edits and accepted replacements invalidate CPU/image/diagnostics immediately. Terminal states require reset/reassembly. Empty assembly is valid but not runnable.

One controller owns the authoritative private CPU. Slow/Normal/Fast use maximum batches of **1/64/512** attempts with requested timer delays **200/32/16 ms**. A generation token rejects stale callbacks across edits/replacements, reassembly, reset, pause, speed changes, and unmount. Repeated Run does not schedule duplicates. Running denotes the active scheduling session; the engine pauses between synchronous batches. Pausing before the first callback leaves the CPU ready with zero attempts. Default budget exhaustion stops at exactly 100,000 attempts and appears explicitly in Errors. Output is capped at 20 high-level messages; no instruction trace is stored.

The view contains a detached compact CPU overview (no memory/program arrays), up to **32 memory cells**, and up to **64 disassembly rows**. Reads use checked CPU access. Memory accepts decimal/hex addresses and PC/SP navigation without wrapping. Changed highlights compare visible values with the previous refresh. Disassembly reads current memory, marks modifications, and labels decoded bits separately from original source. Current editor-line mapping is used only while memory matches the original machine word; otherwise it is suppressed. Diagnostics map exact exclusive source spans to Monaco markers, with cleanup on edits/reassembly/model disposal. The plain-text fallback still supports execution and Errors but has no Monaco markers/decorations.

All 28 new tests use the real assembler, loader, and CPU; only browser timing is simulated. They cover assembly success/failure/empty source; actual hex/signed display values; one-attempt Step; Run-to-HALT; pause/resume with exact state preservation; reset of self-modified memory; source invalidation; stale/late callbacks; rapid controls and duplicate-loop prevention; unmount/Strict Mode resubscription; speed invariance; runtime faults/limits; bounded windows/max image; exact source/marker positions; and detached overview/source-map ownership. An initial log-count expectation omitted the welcome entry; it was corrected before the final passing run.

Required controller end-to-end fixtures pass: reference `ldc 10 / adc 5 / HALT` yields **A=15, B=0, PC=2, SP=65,536, attempts=3, halted**; countdown from 3 halts after 12 attempts; stack store/load yields A=42 and memory[65,535]=42 after 6 attempts; call/return yields A=B=7, PC=2 after 4 attempts. The infinite loop yields between callbacks and stops at exactly 100,000 attempts. Invalid assembly produces real source-specific errors and cannot execute. These are automated controller/engine results, not claimed browser interactions.

## Manual browser checks before resuming development

No browser binaries were installed. In the existing browser, verify:

1. Draft restoration and hydration: initial loading state transitions normally; no console mismatch, chunk, Monaco, or worker errors. Assemble becomes available after restoration. Inspect both Monaco and the plain-text fallback.
2. Enter the reference program, Assemble, inspect exact hex `00000A00 / 00000501 / 00000012`, then Step/Run. Confirm the final reference state above, highlights, attempt count, and terminal button states; Reset restores the image/source stays unchanged.
3. Run a countdown, stack store/load, and call/return program. Inspect memory by decimal/hex address, PC/SP, Previous/Next, and boundary 65,535; confirm decimal/hex values and changed-cell highlights. Inspect source mapping and paged disassembly, including modified words.
4. Run `br -1` at Slow/Normal/Fast. Confirm editing, scrolling, dialogs, and Pause remain responsive; pause/resume preserves counts. Test rapid Run/Pause/Reset, source editing/replacement while running, terminal limit at 100,000, and leaving/unmounting the page.
5. Assemble `ldc missing`, `ldc`, duplicate labels, and an invalid mnemonic; confirm exact Errors positions and Monaco squiggles/hover. Successful assembly/edits clear old markers. Run `ldc 65536 / ldnl 0 / HALT`; verify runtime error mapping and Reset clearing it.
6. Recheck Create/upload/example replacement acceptance/cancellation, UTF-8/file-size errors, Download/Ctrl+S, guarded Ctrl+N, Monaco undo/find/Tab focus mode, autosave/refresh, keyboard result tabs, separate closeable Info/Test Cases dialogs, focus restoration/Escape, resizing, and desktop/narrow layouts. Test runner buttons and breakpoints must remain disabled; Trace must explicitly say upcoming.

## Pause boundary

Day 8 is complete with browser interaction verification explicitly pending. Runtime state is not persisted; source autosave remains independent. No Day 9 debugger, breakpoint logic, historical tracing, or custom runner was implemented. No packages, runtimes, browser binaries, or frameworks were downloaded/installed; the requested audit fetched advisory metadata only. No commits, pushes, deployments, GitHub/Vercel operations, or work beyond Day 8 occurred. The project is ready to pause with the browser checklist above retained for resumption.

The Day 7 and earlier results below are historical.

## Day 7 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator` with existing **Node 26.2.0 / npm 11.13.0**. The available executable remains the existing system Node installation. **Node 24.x is the project target and remains unavailable for verification**; no runtime was downloaded or switched.

## Day 7 actual results

| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; all existing engine/CPU type fixtures retained |
| `npm test` | PASS; **234 tests, 0 failures**: all 168 existing tests plus 66 execution tests; none skipped |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript, static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Browser/UI interaction | NOT RUN; UI, editor, Info/Test Cases panels, file handling, examples, and controls unchanged |

Created `src/lib/cpu/execution.ts` and `tests/execution.test.mjs`. Updated `cpu/index.ts` for shared execution/lifecycle handling, `cpu/decoder.ts` to share checked fetch, `cpu/diagnostics.ts` and `src/types/cpu.ts` for execution results/diagnostics, an engine comment, README, ISA documentation, and this record. Assembler, parser, ISA metadata/constants, loader/reset semantics, all existing tests/type fixtures, package manifests/lockfile, and configuration are preserved. No UI actions were enabled.

`stepCpu(cpu)` and `runCpuBatch(cpu, maxSteps)` use one private attempt/commit path and return detached status/per-call attempts/cumulative attempts/diagnostics, without memory snapshots per step. Instruction preparation reads pre-instruction values and stages candidate registers and at most one word store. Only fully validated effects commit. All 19 instructions execute according to the unchanged ISA; arithmetic wraps signed 32-bit values, validated shifts use exact bit operations, and address/SP/PC arithmetic never wraps. Calls save original PC in A and old A in B; return uses old A+1 and old B. Conditional branches do not pop registers; untaken targets are ignored. No implicit stack operations, flags, sections, breakpoints, or trace recording were added.

Runtime faults count their attempt, preserve all instruction registers and memory, retain faulting PC, append a structured diagnostic, and set error. Checked fetch/decoder diagnostics are reused. Added C012_INVALID_SP, C013_INVALID_SHIFT, C014_INVALID_TARGET, and request-only C015_INVALID_BATCH_SIZE. Diagnostics preserve fetched word and faulting address, include invalid target/count when relevant, and receive a source range from the loaded map when available. Returned diagnostics cannot mutate private state.

Step/batches share the existing cumulative budget. Ordinary Step/batch completion pauses. HALT/fault/limit are terminal until reset or successful load; raising the limit or changing setup values cannot resume terminal execution. A successful final allowed instruction commits then reports limit-reached; HALT/fault take precedence on that attempt. Exhausted budgets stop before another fetch/attempt. Limits cannot be lowered below attempts already counted. Invalid batch bounds return a diagnostic without any CPU-state/count change. Batches require an integer bound 1–10,000,000 and execute synchronously; scheduling is deferred. Idle/empty CPUs perform no execution.

## Exact execution fixtures

All results below are asserted through assembler → loader → execution → snapshot tests, with status **halted** and SP **65,536**:

| Program | A | B | PC | Attempts | Additional assertion |
| --- | --- | --- | --- | --- | --- |
| `ldc 10; adc 5; HALT` (separate lines) | 15 | 0 | 2 | 3 | Step and batch snapshots match |
| Countdown from 3 (`brz` forward / `br` backward) | 0 | 0 | 4 | 12 | Terminates normally |
| `adj -1; ldc 42; stl 0; ldl 0; adj 1; HALT` (separate lines) | 42 | 0 | 5 | 6 | memory[65,535] = 42 |
| `ldc 7; call fn; HALT; fn: return` (separate lines) | 7 | 7 | 2 | 4 | Memory unchanged; no implicit stack |

New coverage includes all 19 exact old/new register/memory effects; signed min/max overflow; shift counts 0/1/30/31 and invalid counts; SP/access boundaries; call/return and taken/untaken branches; HALT at 65,535; atomic final-word faults across all 18 non-HALT instructions; invalid fetched opcodes/payloads; target overflow; runtime validation order; pure preparation/invalid PC checks; branching into data and self-modifying code; bounded/invalid batches; idle/terminal behavior; shared Step/batch limits; HALT/fault precedence; pre-fetch exhaustion; reset/reload/replay after HALT, fault, limit, and self-modification; and result ownership. A default-budget infinite loop stops at exactly **100,000 attempts**, without another fetch or excess attempt. No executor mocks were used.

No packages, runtimes, browser binaries, or test frameworks were downloaded/installed. The requested audit fetched registry advisory metadata only. Browser interaction and Node 24 validation remain pending. No fabricated output, frontend integration, scheduling/animations, debugger, breakpoints, execution traces, or test-case runner were added. Assemble/Run/Step/Pause/Reset remain disabled. No commits, pushes, deployments, GitHub/Vercel operations, or Day 8 work occurred.

The Day 6 and earlier results below are historical.

## Day 6 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator`, using existing **Node 26.2.0 / npm 11.13.0**. The only available Node executable is the existing system installation; **Node 24.x remains the target and was not available for verification**. No runtime was installed or switched.

## Day 6 actual results

| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; existing fixtures plus opaque-handle/result-narrowing CPU fixtures |
| `npm test` | PASS; **168 tests, 0 failures**, all 123 existing tests plus 45 CPU foundation tests; none skipped |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript, static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Browser/UI interaction | NOT RUN this day; UI, editor, file handling, examples, and controls are unchanged |

Created `src/lib/cpu/index.ts`, `decoder.ts`, `validation.ts`, and `diagnostics.ts`; added `src/types/cpu.ts`, `tests/cpu.test.mjs`, and `tests/cpu.typecheck.ts`. Updated README, ISA documentation, and this verification record. Existing engine contracts, assembler/parser/ISA metadata, all 123 prior runtime tests, package manifests/lockfile, configuration, and UI were preserved. No new dependencies or test framework were needed.

CPU handles own private signed-word memory, registers, loaded program bytes/metadata, and bookkeeping. The cold state is A/B/PC 0, SP 65,536, zero-filled 65,536-word memory, idle, and zero attempts. Loading validates image type/origin/alignment/capacity before installing, reads little-endian signed words, clears unused memory, resets registers/count, and sets ready for a nonempty image or idle for an empty image. Failed loads leave the entire existing state and reset image unchanged. Reset restores the latest owned image, zeroes unused memory, restores initial registers/count, clears diagnostic/trace collections, and preserves source mappings/configured limits. Snapshots are deep copies; source input and snapshot mutation cannot corrupt the CPU.

The decoder recognizes all 19 metadata-defined opcodes and sign-extends 24-bit operands. It preserves its exact signed/unsigned 32-bit input number and rejects other numeric values, opcodes 19–255, and nonzero operand bits for operand-free instructions. Loaded words are signed. Fetch validates word addresses, attaches addresses to decode errors, and changes no PC, count, status, or state. Invalid instruction bits remain legal to load as data. Checked setup helpers enforce signed A/B/memory values, PC 0–65,535, SP 0–65,536, and future limits of 1–10,000,000 (default 100,000), without silent wrapping/truncation.

New tests cover cold/ready/idle state; exact zero-filled and signed memory; all 19 opcodes; positive/negative/minimum/maximum operands; every unsupported opcode; invalid payloads on all eight operand-free opcodes; invalid numeric inputs; word-addressed fetch without advancement/counting; zero-filled fetch beyond the image; exact little-endian loading; empty/data-only images; misalignment/oversize/origin/type rejection; failed-load atomicity; exactly 65,536 words and the final memory cell; independent image/source-map ownership, Buffer/view offsets, and detached snapshots; latest-image/repeated reset; checked memory/register/PC/SP boundaries; limit validation/persistence; and assembler-to-loader-to-decoder integration. Initial typecheck caught a widened boolean in the opaque handle declaration; the literal type was corrected before final typecheck/build passed.

An exact integration fixture assembles `start: ldc value`, `call done`, `value: data -2147483648`, `done: br start`, `HALT`. Loaded signed words are **[512, 269, -2147483648, -1007, 18]**. Fetch/decode reports `ldc 2`, `call 1`, `ldc -8388608` for the data bit pattern, and `br -4` at the inspected addresses. This demonstrates that decoding follows bits without code/data tags. Registers remain at their initial values and attempts remain zero: these are loading/decoding results, not execution results.

Only idle/ready transitions are implemented. Runtime errors are returned as structured diagnostics; error status, execution attempts, faults, trace recording, instruction effects, arithmetic/branching, debugger, and budget enforcement are not implemented. The empty diagnostic/trace collections are prepared/reset only; no execution traces were generated. Assemble/Run/Step/Pause/Reset stay disabled, and no internal CPU data is displayed in the UI.

No packages, runtime, browser binaries, or testing frameworks were downloaded/installed. The requested production audit fetched registry advisory metadata only. Node 24 validation and browser interaction checks remain pending. No commits, pushes, GitHub/Vercel operations, deployments, instruction execution, or Day 7 work occurred. The foundation is ready for later execution work; Day 6 is complete.

The Day 5 and earlier results below are historical.

## Day 5 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator`, using the existing **Node 26.2.0 / npm 11.13.0**. Node 24 is unavailable in the existing environment; the project target remains **24.x**, and verification on that target remains pending. No runtime was installed or switched.

## Day 5 actual results

| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; existing positive/negative contract fixtures preserved |
| `npm test` | PASS; **123 tests, 0 failures**, all 77 existing tests plus 46 assembler tests; no skipped tests |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript, static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| Browser/UI interaction | NOT RUN this day; no UI, editor, examples, file handling, or controls changed |

Created `src/lib/assembler/second-pass.ts`, the public API in `src/lib/assembler/index.ts`, and `tests/assembler.test.mjs`. Updated engine contract comments, README, ISA documentation, and this record. The parser/scanner, first pass, ISA metadata, all 77 existing tests, package manifests/lockfile, configuration, and UI are unchanged. Assemble/Run/Step/Pause/Reset remain disabled.

The pure `assembleSource(source): AssemblyResult` pipeline now parses, collects addresses/symbols, resolves operands, and serializes complete images. `secondPass(first)` rejects failed earlier stages and preserves diagnostic codes/ranges/related locations. It resolves case-sensitive absolute word addresses and next-instruction-relative symbol operands; numeric displacements remain literal, even when their potential runtime targets are out of memory. Instruction operands are validated as signed 24-bit integers before shifting, data uses full signed 32-bit words, and operand-free instructions have zero payload. Independent undefined references are collected in source order. Failed results contain diagnostics only, with no program or symbols.

Successful output is origin-zero `Uint8Array` data, a symbol map, diagnostics, and one source-map entry per emitted word. Source-map offsets/lengths count bytes and ranges cover complete statements; standalone labels emit nothing. Empty/label-only and data-only source assemble successfully without establishing that an image is runnable. Input structures and unresolved-reference records are not mutated. Defensive checks cover inconsistent pass flags, layouts/counts, instruction/operand shape, symbol addresses, and numeric values.

The 46 new tests include fixed machine-word fixtures for all 19 opcodes; exact little-endian binary fixtures; positive/negative operands and both signed 24-bit/32-bit boundaries; absolute and relative forward/backward symbols; zero displacements and unchanged numeric branches/calls; case sensitivity; repeated and distinct undefined references with exact spans; duplicate/parser failure propagation; empty/data-only images; byte-based source maps with CRLF/inline labels; deterministic output/input immutability; and inconsistent-stage inputs that must fail without coercion or partial output. Existing source/first-pass tests also remain passing.

The maximum-image fixture assembles exactly **65,536 words / 262,144 bytes**, checks the leading absolute address and forward branch bytes, checks the final backward branch bytes and final source mapping, and verifies the intervening zero data. One extra word and an out-of-memory trailing label both fail through the public pipeline. Resolved-symbol range rejection is additionally exercised with modified typed pass fixtures because valid in-memory symbols cannot exceed signed 24-bit limits under ISA v1.

Exact tested assembly example: `ldc 10`, `adc 5`, `HALT` emit words `00000A00`, `00000501`, `00000012`, and bytes **`00 0A 00 00 01 05 00 00 12 00 00 00`**. These are actual encoded bytes checked by automated fixtures; no CPU execution or register result is claimed.

No packages, runtime, browser binaries, or testing frameworks were downloaded/installed. The requested production audit fetched registry advisory metadata only. No server/browser execution checks were added for this internal library change. Node 24 and browser interaction validation remain pending; the production build and library tests do not establish browser behavior or CPU correctness.

Day 5 stops at the complete assembler API. UI assembly integration, CPU loading/execution, debugger, trace, and test execution remain unimplemented. The binary and source maps are available for future Day 6 work, which was not started. No commits, pushes, deployments, or GitHub/Vercel operations occurred.

The Day 4 and earlier results below are historical.

## Day 4 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator`, using the existing Node **26.2.0** and npm **11.13.0**. The project still targets **24.x**; Node 24 is unavailable here, so verification on that target remains pending. No runtime was installed or switched.

## Day 4 actual results

| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; existing engine contract fixtures preserved |
| `npm test` | PASS; **77 tests, 0 failures**, including all 55 existing tests and 22 new first-pass tests |
| `npm run build` | PASS; Next.js 16.4.2 compilation, TypeScript, and static generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| `git diff --check` | PASS |
| UI/browser interaction | NOT RUN this day; no UI, editor, example, or control files changed |

Day 4 adds `src/lib/assembler/first-pass.ts`, first-pass types in `src/types/assembly.ts`, optional related locations on engine diagnostics, and `tests/first-pass.test.mjs`. README and ISA documentation describe the actual internal API and failure/recovery policies. Parser/scanner, ISA metadata, all existing tests, UI, dependencies, lockfile, and configuration are unchanged. Assemble/Run/Step/Pause/Reset remain disabled; no engine actions were enabled.

New coverage checks word addresses for inline/standalone/consecutive labels and mixed instructions/data; case-sensitive and prototype-like names; duplicate definitions with exact primary/original ranges; forward/backward/undefined references retained without numeric resolution; all 19 instructions; signed numeric boundaries; comments/BOM/tabs/CRLF; parser-error recovery and diagnostic preservation/order; failure propagation; exactly 65,536 words; one-word overflow; labels at 65,535 and rejection at 65,536; continuing overflow without address wrap; deterministic results and input immutability; and integration with all shipped examples. The initial example integration test used the wrong fixture field; that test was corrected before the final passing run.

Clarified policies: malformed source lines consume no words and define no labels; first duplicate binding wins while otherwise valid emitting lines still allocate; label-only records are retained at in-range addresses; excess words continue contributing to `wordCount` but cannot enter located output; out-of-range labels cannot enter the symbol table; parser diagnostics precede first-pass diagnostics. Any parser or pass error makes `ok` false. Failed partial results are diagnostic artifacts, not input for future code generation.

All symbol operands remain unresolved, including already-defined and currently undefined names. Undefined-symbol checks, numeric operand/target resolution, encoding/serialization, CPU execution, and debugger work remain for later days. A successful first pass does not establish successful assembly or execution. The module is not wired to live editor diagnostics. Browser behavior was not reverified by the library tests/build.

No packages, runtime, or browser binaries were downloaded/installed; the requested audit fetched registry vulnerability metadata only. No commits, pushes, GitHub/Vercel operations, second-pass implementation, or machine-code generation occurred. Day 5 can consume the symbols, located statements, and unresolved references; work stops after Day 4.

The Day 3 and earlier results below are historical.

## Day 3 verification

Verified on 23 October 2026 in `C:\Zekrui\assembly-emulator`, using Node 26.2.0 and npm 11.13.0.

## Day 3 actual results

| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS; zero errors/warnings |
| `npm run typecheck` | PASS; including word-memory contract fixtures |
| `npm test` | PASS; **55 tests, 0 failures**: all original 18 plus 37 ISA/parser/editor-alignment tests |
| `npm run build` | PASS; compilation, TypeScript, static page generation; no build warnings |
| `npm audit --omit=dev` | PASS; **0 production vulnerabilities** |
| Production HTTP checks | PASS; root page, local Monaco worker, and 8 root client scripts return 200 |
| Server UI state | PASS; ISA v1 label/restoration placeholder present; all 5 execution buttons remain disabled |
| Existing Monaco patch | PASS; final client chunks contain DOMPurify 3.4.17 and no 3.4.15 string; preparation script/override unchanged |
| Browser checks | NOT RUN; discovery returned no browsers/apps |

No dependency, runtime, or browser binary was downloaded/installed. Package manifests/lockfile and the original 18 tests are unchanged. Node 24 is unavailable: checks used existing **Node 26.2.0**, outside the configured 24.x engine; Node 24 validation remains pending. Native Node tests use explicit .ts module imports, enabled in TypeScript's no-emit configuration, without adding a transpiler.

New coverage includes all 19 opcode/mnemonic mappings, operand counts/kinds/addressing metadata, unsupported opcodes, labels/inline labels, unresolved forward references and deferred duplicate/undefined symbols, signed decimal/hex and both numeric range boundaries, data as a separate numeric directive, comments/blank lines/BOM/CRLF/CR, malformed tokens, exact exclusive UTF-16 spans, insertion spans for missing operands, and ordered multi-line recovery. A deterministic 300-case malformed-input sweep checks that parsing does not throw or lose the following valid line. Every shipped example parses, and Monaco's instruction keyword pattern is checked against the same 19 definitions.

`docs/ISA_DESIGN.md` is now the finalized ISA v1 specification. Instruction behavior is documented, **not executed or emulated by the tests**. The parser returns syntax statements/diagnostics only; it does not resolve names, assign word addresses, encode bytes, or evaluate programs/tests. Its diagnostics are not yet connected to the editor's Errors panel. Existing saved drafts are preserved even when they use old MOV/HLT syntax.

Manual checks pending: load each new example through the existing replacement confirmation; inspect mnemonic/label/comment/number/data highlighting and absence of unsupported-opcode highlighting; review all 19 Info entries and long-section scrolling/focus at desktop and narrow widths; verify autosave, file actions, shortcuts, and dialogs still behave normally; check browser console/network for hydration, chunk, or worker errors. HTTP/build checks do not establish browser behavior. No live execution/assembly results were produced.

The production verification server was stopped. No commits, pushes, GitHub/Vercel operations, or Day 4 implementation occurred. Earlier Day 2 findings below are historical; their 18-test count, draft-contract wording, and pending-ISA boundary describe that earlier state.

## Deployment warning review

| Warning | Finding and action |
| --- | --- |
| Unbounded Node `>=22.18.0` | Changed `package.json` and the lockfile's root engine to `24.x`. This prevents automatic movement to a future major. [Vercel lists 24.x, 22.x, and 20.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions); 24.x is its current default. The manifest overrides a differing dashboard Node selection; the dashboard itself was not changed. Remote warning removal is not verified without a new deployment. |
| Unknown npm config `cache-dir` | Deferred: absent from the repository, local npm config files, and relevant environment variables. Local npm commands do not reproduce the warning. npm's supported option is `cache`; an external command, environment, or build platform may be supplying `cache-dir`, but its remote source is unconfirmed. No Vercel cache path, install command, logging level, or environment setting was overridden. If this is a user-defined deployment option, replace only that option with npm's `cache` equivalent while preserving its path; Vercel-managed injection needs platform-side investigation. |
| Deprecated ESLint 9.39.5 | Deferred: installed `eslint-config-next` 16.4.2 accepts ESLint >=9, and TypeScript ESLint / React Hooks accept 10. However, installed `eslint-plugin-import` 2.32.0, `eslint-plugin-react` 7.37.5, and `eslint-plugin-jsx-a11y` 6.10.2 exclude ESLint 10 in their peer ranges. An ESLint-only major upgrade is not compatible with this dependency set. No peer checks were bypassed or lint coverage removed. |
| Unapproved `unrs-resolver` postinstall | Inspected; deliberately left unapproved. It is a development dependency through `eslint-config-next` → `eslint-import-resolver-typescript` → `unrs-resolver` 1.12.2. Its `postinstall.js` delegates to `napi-postinstall` 0.3.7 with version checking enabled. The helper exits when a matching native binding is present; if missing, it can spawn npm to install a pinned platform package or download/extract its registry archive and write the native binary. This is a native-binding repair mechanism, not an inert script. No postinstall, blanket approval, rebuild, or script-policy change was executed. |

The installed Windows native binding resolved `./src/app/page` to `src/app/page.tsx` successfully without invoking postinstall. The lockfile includes the Linux platform binding alternatives, but a fresh Vercel/Linux installation has not been tested. Keep optional dependencies enabled. Local npm 11.13.0 has no newer `allow-scripts` / `strict-allow-scripts` policy implementation; a deployment-specific approval/denial policy cannot be validated with this client, so no unsupported setting was added just to silence the warning.

Per the user's no-download choice, all required checks ran on the existing **Node 26.2.0**, outside the newly declared Node 24 target: lint PASS (zero warnings), typecheck PASS, tests **18 passed / 0 failed**, build PASS (no warnings), production audit **0 vulnerabilities**. Node 24 validation remains pending; Node 26 test success is not proof of Node 24 compatibility. A future local install under Node 26 may warn about the engine mismatch; switch the local runtime to Node 24 before installing. No runtime or package was downloaded/installed, and no dependency resolution changed.

Only the engine metadata and related README/verification notes changed. Application behavior, Monaco sanitizer/local worker integration, package scripts, Next configuration, and Vercel-managed settings were preserved. No commits, pushes, deployments, or Day 3 work occurred.

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
