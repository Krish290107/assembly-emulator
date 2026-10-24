# Assembly Emulator

A small assembly IDE that runs in the browser. You can write a program, assemble it into machine instructions, run it on a simulated CPU, and see what changes in the registers and memory.

The CPU uses a **custom 19-instruction ISA** implemented in TypeScript. It isn't an x86 or ARM emulator.

**[Open the emulator](https://assembly-emulator.vercel.app)** · **[Source code](https://github.com/Krish290107/assembly-emulator)**

## Give it a try

Open the [live app](https://assembly-emulator.vercel.app), paste this into the editor, then click **Assemble** and **Run**:

```asm
ldc 10
adc 5
HALT
```

`ldc` loads 10 into register A. `adc` adds 5. `HALT` ends execution.

You should see:

| A | B | PC | SP | Attempts | Status |
| ---: | ---: | ---: | ---: | ---: | --- |
| 15 | 0 | 2 | 65,536 | 3 | Halted |

Try **Reset**, then **Step** to watch each instruction change the CPU state. The HALT instruction counts as an attempt.

## What's included

- **Assembler:** Two passes, labels, numeric operands, source diagnostics and 32-bit instruction encoding.
- **CPU:** A, B, PC and SP registers; 65,536 signed 32-bit memory words; checked memory access and execution limits.
- **Debugger:** Run, Step, Pause, Reset, breakpoints, Run to Cursor, disassembly, memory inspection and an execution trace you can export.
- **Test cases:** 14 built-in tests, plus custom tests with register, memory and execution-state assertions. Results show exactly what passed or failed.
- **Browser-local files:** Create, upload and download assembly files. Your source draft and custom tests are saved locally, with JSON import/export for test definitions.

The entire assembler, CPU and test runner run in the browser; there's no application server or database behind program execution.

## Run it locally

You'll need **Node.js 24.x** and npm. From a terminal:

```powershell
git clone https://github.com/Krish290107/assembly-emulator.git
cd assembly-emulator
npm ci
npm run dev
```

Open **http://localhost:3000**.

For a production build:

```powershell
npm run build
npm start
```

No API keys or environment variables are required. `npm ci` installs the dependencies specified in `package-lock.json`.

## Debugging a program

You can inspect registers, memory and the current instruction while a program runs. The most useful shortcuts are:

| Shortcut | Action |
| --- | --- |
| `F5` | Run / Resume |
| `F10` | Step one instruction |
| `Shift+F5` | Reset |
| `F9` | Toggle a breakpoint in the editor |
| `Ctrl+S` | Download the current source |

Set a breakpoint on `adc 5` in the first example and run again. Execution stops **before** that instruction, with A = 10. Resume to finish. The **Execution Trace** tab shows the instructions that ran and their effects; inspecting an older entry does not change the live CPU.

There's also **Run to Cursor** for stopping at a particular source line without leaving a permanent breakpoint.

## A memory example

```asm
ldc 42
ldc 100
stnl 0
HALT
```

The second `ldc` moves 42 into B and puts 100 in A. `stnl 0` writes B to memory at address A + 0, so **Memory[100] = 42**.

Assemble and run, then enter `100` in the Memory inspector. You can see both the signed value and its hexadecimal representation (`0000002A`).

## Testing assembly programs

Open **Test Cases** to run the 14 predefined examples or create your own. For a custom test using the first program, set:

- Expected A: `15`
- Expected completion: `HALT`
- Expected attempts: `3`

That test passes. Change expected A to `20`, run it again, and the result shows **expected 20, actual 15**.

Custom tests can also check memory addresses, other registers and expected faults. They run on separate CPU instances, so testing won't alter your live debugger session. Definitions are saved in the browser and can be exported/imported as JSON. **Keep an exported copy of anything important:** clearing site data removes local drafts and tests.

See [Testing](docs/TESTING.md) for the test format, limits and API behavior.

## How it works

```text
Assembly source → Parser → Two-pass assembler → Machine code
                                            ↓
                                  CPU executes instructions
                                            ↓
                                 Registers, memory, trace
```

Each instruction occupies one 32-bit word: an 8-bit opcode and a signed 24-bit operand. Memory is word-addressed, and the instruction set includes loads/stores, arithmetic, shifts, branches, calls and returns.

The parser, assembler, CPU and test runner are TypeScript modules independent of React. React handles the editor and debugger interface. The CPU model and exact instruction behavior are documented in [ISA Design](docs/ISA_DESIGN.md).

## Built with

Next.js, React, TypeScript, Tailwind CSS, Monaco Editor and Lucide icons. GitHub Actions checks the project using Node.js 24; Vercel hosts the live site.

## Tests and verification

Run the project checks with:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

The verified release checkpoint passed **538 automated tests with zero failures** on Node.js 24 in [GitHub Actions](https://github.com/Krish290107/assembly-emulator/actions/runs/40103356376). The matching production build and real browser workflows were checked as well. The [verification record](docs/VERIFICATION.md) has the commit and deployment details; subsequent commits should be checked independently.

## Limitations

- This is a custom educational CPU, not a commercial processor emulator.
- There is no stdin/stdout instruction interface, operating system or external device emulation.
- Execution is bounded to prevent programs from running indefinitely; it doesn't support time-travel debugging.
- Source drafts and custom-test definitions are stored in the browser, not synchronized across devices. Export them for backup.

## More detail

- [ISA design and instruction reference](docs/ISA_DESIGN.md)
- [Test cases and JSON format](docs/TESTING.md)
- [Verification record](docs/VERIFICATION.md)
- [Release procedure](docs/RELEASE.md)
