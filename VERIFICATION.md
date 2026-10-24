# Verification

This document records the main checks performed for Assembly Emulator. It is a release record, not a claim that the application is free of defects. For the current branch, use the latest [GitHub Actions run](https://github.com/Krish290107/assembly-emulator/actions) and deployed commit rather than relying on an older result.

## Verified release checkpoint — 24 October 2026

| Item | Result |
| --- | --- |
| Source commit | [`adb4218cc9a4e001cba2500596ba8984a4b4dfbb`](https://github.com/Krish290107/assembly-emulator/commit/adb4218cc9a4e001cba2500596ba8984a4b4dfbb) |
| CI | [GitHub Actions run 40103356376](https://github.com/Krish290107/assembly-emulator/actions/runs/40103356376) — successful |
| CI runtime | Node.js 24.21.0 / npm 11.19.0 |
| Automated tests | **538 passed, 0 failed** |
| Other CI checks | `npm ci`, lint, typecheck, production build and production dependency audit passed |
| Production deployment | [Vercel deployment](https://vercel.com/kriu/assembly-emulator/2szrTZ1yvEZY26SRPqr8MyaXEP5y) — Ready for the same commit |
| Production URL | https://assembly-emulator.vercel.app |

The dependency audit reported **0 production vulnerabilities at that checkpoint**. This is not a comprehensive security certification. Later changes, including documentation or version updates, require their own matching-commit verification.

## What was exercised

**Assembler and CPU**

- Parsing, labels, two-pass assembly, instruction encoding and all 19 ISA instructions are covered by automated tests.
- CPU tests cover register/memory operations, control flow, HALT, execution limits, error conditions and atomic fault behavior.
- Integration tests execute real assembled code rather than mocked instructions.

**Debugger**

- Run, Step, Reset, source breakpoints, Pause/Resume and trace/memory views were checked in the browser.
- The program `ldc 10 / adc 5 / HALT` halted after three attempts with A=15, B=0, PC=2 and SP=65,536.
- Historical trace inspection and isolated tests did not change the live CPU state in regression coverage.

**Test Cases panel**

- All **14 predefined fixtures passed** in production smoke testing.
- Custom addition test: expected A=15 passed; expected A=20 failed, showing actual A=15.
- Definitions survived refresh. JSON export/import with Merge preserved existing definitions and renamed conflicts; malformed input was rejected without losing valid data.
- Browser testing also covered keyboard navigation, focus and narrow layout (approximately 390px).

**Post-release usability checks**

- Isolated Playwright tests confirmed two-tab autosave conflict warnings, backup and safe reload behavior.
- Initial register editing/clearing, library search and ten-case pagination, lazy detail expansion, JSON round trips and intentional assertion failures passed.
- The isolated production smoke run reported no application console/page errors.

## How to reproduce checks

Use Node.js 24.x from the repository root:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

`npm ci` downloads the locked npm dependencies on a fresh machine; it does not install Node itself. See the [CI workflow](../.github/workflows/ci.yml) for an automated run and the [release guide](RELEASE.md) for matching GitHub/Vercel commit checks.

For a quick browser smoke test, assemble and run:

```asm
ldc 10
adc 5
HALT
```

Expected: A=15, B=0, PC=2, SP=65,536, three attempted instructions, halted. Next, run all predefined cases and a custom assertion test. Verify exported JSON imports without changing existing definitions.

## Known limits

- The runtime models a custom 19-instruction educational ISA; it isn't x86 or ARM.
- Source/test storage is browser-local. It isn't a cloud backup or transactional multi-tab editor.
- The CPU runner yields between bounded batches; parsing, assembly and browser storage serialization may still be synchronous.
- Instruction traces retain a bounded history; no time-travel execution is provided.
- A successful CI run applies to its specific commit. Deployments and browser checks must be matched to the commit being released.

The older day-by-day verification log was condensed for public documentation. The detailed ISA and testing contracts remain in [ISA Design](ISA_DESIGN.md) and [Testing](TESTING.md).
