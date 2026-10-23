# Assembly Emulator ISA v1

**Finalized for Day 3.** This is the normative language/CPU profile for this project. The pure source parser exists; symbol resolution, machine-code generation, loading, CPU execution, debugging, and test execution do not. Instructions below specify future behavior, not current execution results.

## Machine state and addresses

- A and B are signed 32-bit two's-complement integers, -2,147,483,648 through 2,147,483,647. There are no condition flags.
- Memory is **65,536 signed 32-bit words**, addresses 0–65,535 (256 KiB). Code, data, and stack share this memory, without protection or separate sections. Addresses count words, never bytes.
- At instruction boundaries, PC is the address of the next word to fetch, in 0–65,535. SP is a checked word pointer in 0–65,536; the one-past-end value 65,536 is allowed for an empty descending stack but is not a memory address.
- A/B and memory use signed values; PC/SP are nonnegative integers in the ranges above. Address arithmetic uses mathematical integers and **never wraps**. A negative or out-of-range memory address, resulting PC, or resulting SP is a fault.
- Memory is an `Int32Array` in the CPU contract. Serialized machine code remains a `Uint8Array`; word values and file bytes are distinct.

### Initial state, loading, reset, and stack

Cold state has A = B = PC = 0, SP = 65,536, zero-filled memory, zero attempted instructions, and status idle, with no loaded program. The UI still shows absent state while no engine exists.

A future successful image loads at word address 0, replacing memory after zero-fill. There is no origin directive; `MachineCode.origin` is 0 in ISA v1. Every instruction and data directive occupies one word; a label-only line occupies none. An image must fit in memory. A zero-word image is not runnable and remains idle; a nonempty loaded image is ready.

Reset restores the initial registers, zero-fills memory, reloads the last successfully loaded image (if any), and clears the attempt counter, trace, program output, and runtime diagnostics. It returns to ready for a nonempty image, otherwise idle. Source, configured breakpoints, speed, and test definitions are retained. No reset behavior is implemented yet.

The stack grows downward by convention: `adj -n` reserves n words; `adj n` releases them. Memory-stack allocation/push/pop is never implicit: only adj/a2sp change SP, while all A/B effects still follow the instruction table. SP movement outside 0–65,536 faults; overlapping code/data or accessing an unallocated but in-range word does not. `call` does not use memory or SP. Nested calls must explicitly save return links in memory and later restore them to A before `return`.

## Exactly 19 CPU instructions

Mnemonics are case-insensitive; the canonical spelling of opcode 18 is `HALT`. All assignments in a row are simultaneous and read the **old** state. Let p be the fetched instruction's PC, N = p + 1, v the signed decoded operand, and M word-addressed memory. Any register/memory cell not mentioned is unchanged. Every non-HALT result PC is bounds-checked before committing.

| Opcode (decimal / hex) | Instruction | Operand count | Exact effect |
| --- | --- | --- | --- |
| 0 / 00 | ldc v | 1 | B ← A; A ← v; PC ← N |
| 1 / 01 | adc v | 1 | A ← wrap32(A + v); PC ← N |
| 2 / 02 | ldl v | 1 | B ← A; A ← M[SP + v]; PC ← N |
| 3 / 03 | stl v | 1 | M[SP + v] ← A; A ← B; PC ← N |
| 4 / 04 | ldnl v | 1 | A ← M[A + v]; PC ← N |
| 5 / 05 | stnl v | 1 | M[A + v] ← B; PC ← N |
| 6 / 06 | add | 0 | A ← wrap32(B + A); PC ← N |
| 7 / 07 | sub | 0 | A ← wrap32(B − A); PC ← N |
| 8 / 08 | shl | 0 | Check 0 ≤ A ≤ 31; A ← wrap32(B × 2^A); PC ← N |
| 9 / 09 | shr | 0 | Check 0 ≤ A ≤ 31; A ← floor(B / 2^A), arithmetic/sign-extending; PC ← N |
| 10 / 0A | adj v | 1 | SP ← SP + v; PC ← N |
| 11 / 0B | a2sp | 0 | SP ← A; A ← B; PC ← N |
| 12 / 0C | sp2a | 0 | B ← A; A ← SP; PC ← N |
| 13 / 0D | call v | 1 | B ← A; A ← p; PC ← N + v |
| 14 / 0E | return | 0 | PC ← A + 1; A ← B |
| 15 / 0F | brz v | 1 | PC ← N + v if A = 0, otherwise N; no register pop |
| 16 / 10 | brlz v | 1 | PC ← N + v if A < 0, otherwise N; no register pop |
| 17 / 11 | br v | 1 | PC ← N + v |
| 18 / 12 | HALT | 0 | Normal termination: status halted; PC remains p; A, B, SP, and memory unchanged |

`wrap32(x)` reduces an integer modulo 2^32, then interprets the result as signed two's complement. Arithmetic overflow wraps without fault or flags. Shift counts outside 0–31 fault; counts are not silently masked modulo 32. `shr` sign-extends negative B; there is no logical-right-shift opcode. The shift definitions are mathematical: a future implementation must preserve low 32 bits correctly rather than rely on imprecise JavaScript multiplication for large shifts.

For example, a call at p saves p, not N. The corresponding return to A = p sets PC to p + 1. There is no extra automatic PC increment after the table's effect. A return target is checked after adding 1; it does not require proof that A came from a call. An untaken conditional branch checks only its fallthrough PC, not the unused target.

No MOV, HLT, CMP, PUSH, POP, RET, JMP, I/O, or other opcode exists.

## Machine-code encoding and serialization

Each instruction is one 32-bit word:
- Bits 7–0: unsigned opcode 0–18.
- Bits 31–8: a **signed 24-bit** two's-complement operand, -8,388,608 through 8,388,607.
- Instructions with no operand must encode all 24 operand bits as zero. Nonzero bits are an invalid instruction encoding, not ignored padding.
- Mathematically, the bit pattern is `((v modulo 2^24) << 8) | opcode`. This specifies a layout only; no encoder is implemented.
- Files serialize each word as exactly four bytes in **little-endian** order: opcode/low byte first, then successively more significant bytes. The operand sign bit is bit 31 of the complete word. File lengths must be multiples of four; a future loader rejects malformed/oversized images before replacing existing state.

The separate `data` directive contributes one full signed 32-bit word serialized in the same byte order. It has **no opcode** and is not an instruction alias. Memory contains no code/data tags: branching into data decodes its bit pattern as an instruction, which can either execute a valid encoding or fault. Falling beyond the loaded image is not automatically HALT; in-range zero-filled memory can be fetched.

### Symbol meaning for Days 4–5

A label denotes the word address of the next emitted instruction/data word. Mnemonics' operands accept either a literal or a symbol. For `call/brz/brlz/br`, a symbolic address t becomes displacement **t − (p + 1)**; a numeric literal already is the displacement. Other instruction symbols become absolute word addresses (including operands used as offsets); numeric literals keep their value. No implicit byte scaling occurs.

Duplicate labels (same exact spelling), undefined symbols, symbols outside memory, image overflow, and resolved operands outside signed 24 bits will be assembler errors. A trailing label may point beyond the loaded image, provided its address is still within memory. The parser deliberately does not perform these semantic checks or allocate any addresses.

Numeric branch/call operands within signed 24 bits remain legal assembly even when their computed target would be outside memory; the future CPU faults only if that target is taken. Memory access and SP validity likewise remain runtime checks. A loader does not infer code/data regions or reject words merely because they would be invalid instructions when fetched.

## Source syntax

One line contains zero or one statement:

```text
line        := [label ":"] [instruction | data-directive] [";" comment]
label       := [A-Za-z_][A-Za-z0-9_]*
instruction := mnemonic [operand]
operand     := signed-integer | label
data-directive := "data" signed-integer
signed-integer := ["+" | "-"] (decimal-digits | "0x" hex-digits)
```

- Space and Tab are the only intra-line whitespace. LF, CRLF, and bare CR are line breaks. Empty/comment-only lines and a final newline are allowed. A single initial Unicode BOM is ignored without consuming a visible column.
- At most one label is allowed per line, either alone or before a statement. Space/Tab may surround the colon; `entry:ldc 1` is valid. A mnemonic/directive and operand must be separated by Space/Tab.
- Labels are **case-sensitive**; `Loop` and `loop` are distinct. Mnemonics and `data` are case-insensitive. No identifier is reserved as a label, including data, mnemonic names, and A/B/PC/SP. In an operand, bare `A` means the symbol named A, never a register operand. Consequently `ldc :` is a label-only declaration, not an instruction missing its value.
- Semicolon begins a comment through the end of that line. Quotes have no special meaning because strings are unsupported. Unicode is allowed in comments, not label names or whitespace.
- Decimal digits always mean base 10 (so `007` means 7). Hex accepts `0x/0X` and A–F in either case. Signs must touch digits/prefix: `+7`, `-12`, `-0x10`. Negative zero normalizes to zero.
- No floats, exponent notation, digit separators, binary/octal prefixes, expressions, commas, bracketed memory operands, string literals, or multiple statements per line.
- The 11 operand-taking instructions accept exactly one signed 24-bit literal or unresolved symbol. The other eight accept no operand. A literal such as positive `0xFFFFFF` is out of range, not implicitly -1; write `-1`.
- `data` accepts exactly one signed **32-bit numeric literal**, no symbol. Positive `0xFFFFFFFF` is out of range; use `-1`. There are no SET, .data, .word, or origin directives.
- Forward and backward symbol references are retained as names. Undefined/duplicate labels remain syntactically parseable until the future semantic pass.

Example (valid source, not an execution result):

```asm
    ldc value
    ldnl 0
    HALT
value: data -0x80000000
```

## Source positions, diagnostics, and recovery

`parseSource(source)` is a pure TypeScript function returning `{ ok, statements, diagnostics }`. Statements distinguish label-only, instruction, and data forms. Instruction mnemonics normalize to their canonical spelling; label spelling is retained. Operands are immediate integers or unresolved symbol names. There are no addresses, symbol tables, machine-code bytes, or execution results in its output.

Ranges use one-based line numbers and **UTF-16 code-unit columns**, matching Monaco. Tab counts as one column, not four displayed spaces. End positions are exclusive. A label range excludes its colon; statement ranges include any label/colon, exclude indentation/comments/trailing whitespace, and stay on one line. A missing operand has a zero-width insertion range immediately after the mnemonic. The first BOM is ignored as described above.

| Diagnostic | Meaning |
| --- | --- |
| P001_INVALID_LABEL | Invalid/missing label name before colon |
| P002_EXPECTED_MNEMONIC | Invalid token where a mnemonic/directive is required |
| P003_UNKNOWN_MNEMONIC | Unsupported mnemonic/directive |
| P004_MISSING_OPERAND | Required operand absent |
| P005_EXTRA_OPERAND | Operand-free instruction has an operand, or a second token follows the single operand |
| P006_INVALID_OPERAND | Malformed literal/symbol, or nonnumeric data value |
| P007_OPERAND_RANGE | Numeric value outside its signed 24/32-bit range |
| P008_UNEXPECTED_TOKEN | More than one label on the same line |

One blocking diagnostic is returned per malformed line, in source order. That entire line is omitted from statements (including any otherwise valid label on it); scanning/parsing resumes at the next line. Valid lines are retained even when `ok` is false. This is recovery output, not a partially assembled program. A later assembler must refuse code generation when parser errors exist.

## HALT, faults, and execution limits (future engine)

There is no CPU implementation today. Future instruction attempts follow this order:

1. Check the cumulative attempt budget before fetching. If exhausted, stop with status limit-reached without another attempt or state mutation.
2. Increment the attempt count, validate PC, fetch/decode, then validate opcode and zero payload for operand-free instructions.
3. Validate a shift count if relevant, then any memory address / candidate SP, then the candidate next PC (except HALT, which retains p).
4. Commit all effects simultaneously, or fault atomically: status error, a structured diagnostic/trace entry, unchanged registers and memory, and PC still at the faulting instruction. The attempt count/status/diagnostic are bookkeeping, not rolled back. If a nonterminal commit uses the last permitted attempt, stop with limit-reached after that commit; HALT/fault take precedence if they occur on the final allowed attempt.

Invalid opcode 19–255, invalid operand-free encoding, invalid fetch/access/PC/SP, and invalid shift counts fault. Address computations never wrap to an apparently valid address. HALT is successful termination and counts as one attempt; faults, including failed fetches, also count. HALT at word 65,535 succeeds; a non-HALT fallthrough to 65,536 faults before any effects commit. There are no implicit traps for stack/code overlap, division, flags, or I/O because those mechanisms do not exist.

Default budget: **100,000 attempts**; caller-configured budget: integer **1–10,000,000**, otherwise reject configuration before starting. Pause/resume and Step share the same cumulative budget; they cannot bypass the limit. Reset/new image starts a fresh count. A single successful Step pauses before the next instruction unless it halts, faults, or reaches the limit; Run continues until a stop condition. Terminal halted/error/limit-reached states require reset or a new image before restarting.

Future tests start from reset + loaded image + validated optional initial-state overrides, then run under the same budget. Assertions compare selected registers/memory cells by exact integer equality; unlisted state is ignored. PC/SP overrides/assertions use their address/pointer ranges, A/B and memory use signed 32-bit values. Duplicate memory overrides/assertions or duplicate assertions on the same target are invalid test definitions. A test passes only after normal HALT and matching assertions; fault, limit, invalid setup, or no runnable image fails. Tests, trace recording, and assertion evaluation are not implemented.

## Day 4 boundary

`src/lib/assembler/isa.ts` holds instruction metadata and architectural constants; scanner/parser and `src/types/assembly.ts` provide the parser foundation. `src/types/engine.ts` retains React-independent engine contracts with implicit operands and signed word memory.

Days 4–5 can collect labels/word addresses, reject semantic errors, resolve absolute/relative operands, and encode/serialize words according to this document. **No symbol resolution, code generation, CPU, or debugger was added on Day 3.** The UI's Assemble/Run/Step and other engine actions remain disabled; the parser is not yet wired to live editor diagnostics.
