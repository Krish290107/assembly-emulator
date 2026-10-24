# Manual release procedure

These instructions are for the repository owner. The agent does not commit, push, deploy, tag or publish. **READY TO PUSH means local preparation passed, not that Node 24 CI or production acceptance passed.**

## 1. Review and verify locally

Use the intended checkout and branch. Stop on unexpected files/deletions/branches; do not reset or clean away surprises. Stop a dev server before building in the same checkout.

```powershell
Set-Location C:\Zekrui\assembly-emulator
git status --short --branch
git branch --show-current
git diff --stat
git diff --check
git diff
node --version
npm --version
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Require each check to succeed before continuing. Use Node 24 if already installed; Node 26 success does not establish target compatibility. No npm ci is needed merely to verify installed dependencies. Fresh installations download packages and should be deliberate, on Node 24.

## 2. Stage and inspect the exact change

For the Day 15 files prepared here:

```powershell
git add -- .github/workflows/ci.yml README.md VERIFICATION.md docs/ISA_DESIGN.md docs/TESTING.md docs/RELEASE.md
git diff --cached --stat
git diff --cached --check
git diff --cached
git status --short
```

Review the complete staged diff, including anything staged earlier. It must contain no secrets, personal exports, dependencies/build output or unexpected deletions. Adjust the staging list only for deliberate changes; staging itself does not prove correctness.

## 3. Commit and push main — owner action only

After review, confirm branch `main` and the intended origin:

```powershell
git remote -v
git branch --show-current
git commit -m "Prepare final documentation and Node 24 CI"
$releaseCommit = git rev-parse HEAD
git show --stat --oneline $releaseCommit
git push origin main
$releaseCommit
```

Do not force-push or rewrite history if rejected. Reconcile remote changes through normal review and rerun checks after changes. Keep the full `$releaseCommit` SHA for CI/deployment comparisons.

## 4. Confirm real Node 24 CI

Open [GitHub Actions](https://github.com/Krish290107/assembly-emulator/actions). Select **CI** for the pushed main commit and compare its full SHA with `$releaseCommit`. **Node 24 verification** must succeed: printed Node 24/npm versions, npm ci, lint, typecheck, tests, production build and audit. A successful run on an older SHA does not verify a changed commit.

Official [checkout v7](https://github.com/actions/checkout/tree/v7) and [setup-node v7](https://github.com/actions/setup-node/tree/v7) run on Node 24, requiring a compatible Actions runner (minimum 2.327.1 documented for Node 24 action support). GitHub-hosted Ubuntu manages its runner version. The workflow disables credential persistence/package caching, uses contents:read and needs no custom secrets/private environment variables. Checkout cleanup is disabled; no release/deployment step exists.

When the owner pushes, the runner may download action code, Node and locked dependencies to its temporary workspace/cache. No local Windows installation is performed by preparing this file. **Node 24 is PENDING until this actual run succeeds.** Fix failures in a reviewed follow-up and rerun CI before declaring release success.

## 5. Confirm Vercel readiness and commit identity

Inspect the deployment created by your normal Git integration/manual process in the existing Vercel project. Wait for **Ready**; compare its Git source SHA with `$releaseCommit`, confirm its Production domain and review the actual Node target/build logs. This guide does not change settings or trigger deployments.

Open [production](https://assembly-emulator.vercel.app) after confirming its SHA. If Vercel builds alongside CI, require both to pass for the same commit before release acceptance.

## 6. Production smoke checklist in Brave

1. Load production; check Monaco/local worker, console and hydration. Distinguish extension-origin messages from app errors. Prior local evidence does not validate the deployed SHA.
2. Run README demo A: A=15, B=0, PC=2, SP=65536, three attempts, halted. Recheck Reset/Step, F5/F10/Shift+F5, F9 breakpoint/Resume and Run to Cursor with correct counts.
3. Run the memory demo: M[100]=42. Inspect memory 0/65535, disassembly and trace selection/filter/navigation/export. Inspection must not change live CPU state.
4. Run all 14 fixtures. Create one uniquely named temporary addition case: A=15 PASS, then A=20 FAIL with actual 15. Verify cancellation and a valid rerun without changing the live debugger.
5. Save/refresh/reopen the definition. Export and confirm the actual JSON file. Import a temporary version-1 library with **Merge**, inspect counts/conflicts before confirming; malformed JSON must leave good cases intact. Do not replace real user collections for testing.
6. Check ~390px width: fixed header/close, navigation, forms/errors, 100-item pagination, run/cancel, scrolling and keyboard focus. Restore the viewport. Verify confirmations and Escape focus return.
7. Remove only audit-created cases when safe. If Windows Computer Use cannot verify the browser URL around a picker/confirmation, stop that automated interaction and finish manually. This restriction is not proof that application import is broken.

Record date, full SHA, runtime, CI/deployment links and PASS/FAIL/PENDING/UNVERIFIED outcomes in VERIFICATION.md. Keep unperformed native-import/accessibility checks explicit. A tag is optional only after CI and production acceptance; this guide does not create or publish one.
