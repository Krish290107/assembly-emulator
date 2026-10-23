# ISA decisions for Day 3

**Status: unresolved.** Day 2 prepares data contracts, not an ISA, parser, assembler, CPU, debugger, or test runner. The editor's provisional highlighting/examples are not the instruction specification. Do not derive opcodes or semantics from them.

| Decision | Day 3 must specify |
| --- | --- |
| Exact 19 instructions | Final mnemonic list, operand counts/kinds, behavior, affected registers/flags, control flow, and invalid combinations. The editor's current mnemonic list is illustrative and must not be treated as the final 19. |
| Operands and labels | Grammar, case sensitivity, comments, literals/bases/signs, identifier syntax, duplicate/undefined labels, forward references, directives (if any), and source error spans. |
| Register behavior | A/B widths and signedness; PC/SP widths, units, initial values, permitted reads/writes, and any flags. |
| Memory and stack | Address space, cell size, initialization, bounds, alignment, stack direction, push/pop rules, call/return behavior, and overflow/underflow handling. |
| Integers and overflow | Arithmetic range, wrap/trap behavior, signed comparisons, bitwise operations, and whether JavaScript `number` remains a sufficient transport type. |
| Addressing modes | Immediate, register, absolute/symbolic memory, indirect/relative forms if supported, and resolution of labels to addresses. Current operand variants are planning shapes, not accepted grammar. |
| Binary instruction encoding | Opcode allocation, instruction lengths, operand fields, endianness, byte order, load origin, source-to-byte mapping, invalid encodings, and disassembly rules. |
| Error and halt behavior | Diagnostic codes/severities, assembly failure policy, illegal instructions, invalid memory access, halt vs fault, reset state, and any output mechanism. |
| Execution limits | Default/hard instruction budgets, what consumes a step, pause/resume accounting, loop termination, and the distinction between halt, error, and limit reached. No values are chosen today. |
| Test assertions | Valid initial register/memory values, unspecified state, exact comparison rules, expected termination, assertion diagnostics, and treatment of execution-limit failures. |

## Contract boundaries

`src/types/engine.ts` is independent of React. It describes source ranges and diagnostics, instruction/operand metadata, symbol definitions, discriminated assembly results, machine-code bytes/source maps, CPU state, execution status/limits, traces, breakpoints, and test inputs/assertions. `src/types/ide.ts` retains UI/source-document types and re-exports existing engine-facing names for the current panels.

Source positions use one-based lines/columns and exclusive end positions. Byte arrays represent transport/storage octets, not a chosen CPU register or memory-cell width. Numeric fields do not establish valid ranges or overflow behavior. A complete `CpuState` requires all four registers and memory; `CpuSnapshot` permits absent data for inspector empty states. Only a successful assembly result may carry a program and symbol table.

Instruction `operandKinds` lists allowed kinds per operand position. It carries no opcode or execution callback. `ValueReference` permits literal/symbolic memory references for planning; additional addressing forms must follow the final ISA. Test assertions select individual registers or memory addresses; their presence does not execute or validate a test.

Once these decisions are approved on Day 3, align examples/highlighting and refine these types before implementing the planned two-pass assembler. Later work can assign addresses/collect symbols in a first pass and resolve/encode in a second pass, according to the finalized instruction lengths and error policy. Neither pass exists today.
