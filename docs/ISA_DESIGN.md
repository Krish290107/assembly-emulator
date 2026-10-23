# Assembly Emulator ISA v1

**ISA finalized for Day 3; assembler completed on Day 5; CPU execution implemented on Day 7.** This is the normative language/CPU profile for this project. Assembly, loading/reset, decoding, and all 19 instruction effects are implemented as internal TypeScript APIs. Frontend execution integration, debugging, trace recording, and test-case execution are not implemented.

## Machine state and addresses

- A and B are signed 32-bit two's-complement integers, -2,147,483,648 through 2,147,483,647. There are no condition flags.
- Memory is **65,536 signed 32-bit words**, addresses 0–65,535 (256 KiB). Code, data, and stack share this memory, without protection or separate sections. Addresses count words, never bytes.
- At instruction boundaries, PC is the address of the next word to fetch, in 0–65,535. SP is a checked word pointer in 0–65,536; the one-past-end value 65,536 is allowed for an empty descending stack but is not a memory address.
- A/B and memory use signed values; PC/SP are nonnegative integers in the ranges above. Address arithmetic uses mathematical integers and **never wraps**. A negative or out-of-range memory address, resulting PC, or resulting SP is a fault.
- Memory is an `Int32Array` in the CPU contract. Serialized machine code remains a `Uint8Array`; word values and file bytes are distinct.

### Initial state, loading, reset, and stack

Cold state has A = B = PC = 0, SP = 65,536, zero-filled memory, zero attempted instructions, and status idle, with no loaded program. This state is implemented internally; the UI still shows absent state because CPU integration is not implemented.

A successful image loads at word address 0, replacing memory after zero-fill. There is no origin directive; `MachineCode.origin` is 0 in ISA v1. Every instruction and data directive occupies one word; a label-only line occupies none. An image must fit in memory. A zero-word image is not runnable and remains idle; a nonempty loaded image is ready.

Reset restores the initial registers, zero-fills memory, reloads the last successfully loaded image (if any), and clears the attempt counter, trace, program output, and runtime diagnostics. It returns to ready for a nonempty image, otherwise idle. The CPU API implements register/memory/image/counter reset and clears diagnostics and the reserved empty trace collection; output generation and trace recording do not exist. Source, configured breakpoints, speed, and test definitions remain outside this API and are retained by their future owners. Loaded source mappings and the configured execution limit are preserved.

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

`wrap32(x)` reduces an integer modulo 2^32, then interprets the result as signed two's complement. Arithmetic overflow wraps without fault or flags. Shift counts outside 0–31 fault; counts are not silently masked modulo 32. `shr` sign-extends negative B; there is no logical-right-shift opcode. The implementation uses exact signed-word sums/differences followed by `| 0`, and validated `B << A` / `B >> A`, preserving low bits without imprecise large floating-point products.

For example, a call at p saves p, not N. The corresponding return to A = p sets PC to p + 1. There is no extra automatic PC increment after the table's effect. A return target is checked after adding 1; it does not require proof that A came from a call. An untaken conditional branch checks only its fallthrough PC, not the unused target.

No MOV, HLT, CMP, PUSH, POP, RET, JMP, I/O, or other opcode exists.

## Machine-code encoding and serialization

Each instruction is one 32-bit word:
- Bits 7–0: unsigned opcode 0–18.
- Bits 31–8: a **signed 24-bit** two's-complement operand, -8,388,608 through 8,388,607.
- Instructions with no operand must encode all 24 operand bits as zero. Nonzero bits are an invalid instruction encoding, not ignored padding.
- Mathematically, the bit pattern is `((v modulo 2^24) << 8) | opcode`. The implemented encoder validates the operand before using `(v << 8) | opcode`; JavaScript's 32-bit shift preserves exactly these bits for every valid operand.
- Files serialize each word as exactly four bytes in **little-endian** order: opcode/low byte first, then successively more significant bytes. The operand sign bit is bit 31 of the complete word. File lengths must be multiples of four; the loader rejects misaligned/oversized images before replacing existing state.

The separate `data` directive contributes one full signed 32-bit word serialized in the same byte order. It has **no opcode** and is not an instruction alias. Memory contains no code/data tags: branching into data decodes its bit pattern as an instruction, which can either execute a valid encoding or fault. Falling beyond the loaded image is not automatically HALT; in-range zero-filled memory can be fetched.

### Symbol meaning

A label denotes the word address of the next emitted instruction/data word. Mnemonics' operands accept either a literal or a symbol. For `call/brz/brlz/br`, a symbolic address t becomes displacement **t − (p + 1)**; a numeric literal already is the displacement. Other instruction symbols become absolute word addresses (including operands used as offsets); numeric literals keep their value. No implicit byte scaling occurs.

Duplicate labels (same exact spelling), undefined symbols, symbols outside memory, image overflow, and resolved operands outside signed 24 bits are assembler errors. A trailing label may point beyond the emitted image, provided its address is still within memory. The parser deliberately does not perform these semantic checks or allocate any addresses.

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
- Forward and backward symbol references are retained as names by the parser. Undefined/duplicate labels remain syntactically parseable. The first assembler pass rejects duplicates; the second pass rejects undefined symbols and resolves valid operands.

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

One blocking diagnostic is returned per malformed line, in source order. That entire line is omitted from statements (including any otherwise valid label on it); scanning/parsing resumes at the next line. Valid lines are retained even when `ok` is false. This is recovery output, not a partially assembled program. The assembler refuses code generation when parser errors exist.

## First assembler pass (Day 4)

`firstPass(parseSource(source))` in `src/lib/assembler/first-pass.ts` consumes the parser result without rescanning text or changing its statements. It returns `FirstPassResult`: `ok`, `symbols`, `statements`, `wordCount`, `diagnostics`, and `unresolvedReferences`. It is independent of React and is not connected to the UI.

- The location counter starts at word 0. Each parsed instruction and numeric `data` directive consumes exactly one word. Label-only statements, comments, and blank lines consume none. Invalid lines were omitted by the parser and contribute neither words nor labels; later valid lines are allocated consecutively without gaps. Any parser error still makes the first pass fail.
- `symbols` is a case-sensitive `ReadonlyMap<string, SymbolDefinition>`, in first-definition order. Each entry preserves the label's spelling and exclusive source range and records its word address. A label on an emitting line names that word. Consecutive distinct label-only lines may alias the same address.
- Duplicate names fail even when their addresses match. The first declaration remains authoritative; a duplicate does not replace it. A duplicate's otherwise valid instruction/data still consumes one word. The diagnostic points at the duplicate label and has a `related` range for the first declaration, plus its line/column in the message.
- `statements` retains source order, including label-only statements, as `{ address, statement }` records referencing the original parsed statements. Every returned address is in 0–65,535. No source/AST or input diagnostic is mutated.
- A trailing label names the next word even when no word follows, provided its address is at most 65,535. Exactly 65,536 emitting words fit; a label following them would name 65,536 and fails. SP's allowed empty-stack value 65,536 does not make that a valid label or memory address.
- Overflow never wraps. Out-of-range labels are excluded from `symbols`; out-of-range statements and their references are excluded from located output. Each excess emitting word receives an overflow diagnostic. `wordCount` continues counting all syntactically valid emitting words, including excess words, to report the requested size accurately. First declarations are remembered even outside memory so later duplicates still identify the original location.
- Every in-range instruction symbol operand remains an unresolved reference: `{ name, address, source, mode }`, where `address` is the referring instruction's word address and `source` is the operand range. `mode` is `relative` for call/brz/brlz/br and `absolute` for the other operand-taking instructions. Forward, backward, and currently undefined names are all retained without converting operands or checking target validity. Literal operands and data values are unchanged.
- Parser diagnostics are copied first, in their original order and with their ranges intact. Pass diagnostics follow in source traversal order; on one line, duplicate, invalid label address, and emitting-word overflow appear in that order when applicable. `ok` is false if parser `ok` is false or any diagnostic is an error. Partial results on failure are for inspection only; the second pass rejects them. Even a successful first pass does not establish that the program can assemble or run.

| Diagnostic | Meaning |
| --- | --- |
| A001_DUPLICATE_LABEL | Repeated case-sensitive name; primary duplicate range and related first-definition range |
| A002_LABEL_ADDRESS | Label would name an address beyond 65,535 |
| A003_PROGRAM_OVERFLOW | Instruction/data would occupy a word beyond 65,535 |

For example, `first:`, `alias: ldc later`, `data 7`, `later: HALT` on four successive lines bind `first` and `alias` to 0, `later` to 2, and request three words. The `ldc` operand remains the symbol `later`; this pass does not replace it with 2 or serialize anything.

## Second pass and public assembly API (Day 5)

`assembleSource(source: string): AssemblyResult` is exported from `src/lib/assembler/index.ts`. Its pure, browser-independent pipeline is source → parser → first pass → `secondPass` → binary. `secondPass(first: FirstPassResult): AssemblyResult` in `second-pass.ts` can also be tested directly. Neither function changes its input or executes the image. No engine controls or live editor diagnostics are connected to this API yet.

The second pass refuses a failed first pass or any existing error diagnostic, preserving earlier codes, ranges, and related locations. It then visits located statements in order. Label-only statements emit nothing. Each instruction symbol is looked up case-sensitively in the complete symbol table; absolute operands become the symbol's word address, and relative operands become `symbol.address - (instruction.address + 1)`. Immediate numbers stay unchanged, including branch displacements with possible out-of-memory runtime targets. All resolved instruction operands must be integers in the signed 24-bit range before any bitwise conversion. Undefined references each receive an error, including repeated uses of the same name; one undefined name does not prevent checking other independent references.

Operand-free instructions encode a zero operand. The separate numeric `data` directive uses the entire signed 32-bit word. Valid in-memory symbols necessarily produce values within signed 24 bits under ISA v1, but the second pass still checks the resolved range. It also checks declared word count, consecutive word allocation, in-memory addresses, known mnemonics, operand presence, referenced symbol addresses, and data range to diagnose inconsistent typed pass input rather than silently truncate it. This is a compiler-stage contract check, not a general validator for arbitrary JavaScript objects.

Only after all checks pass does serialization allocate a `Uint8Array`, write each signed 32-bit word through `DataView.setInt32(byteOffset, word, true)`, and expose the image. A successful result is `{ status: "success", program, symbols, diagnostics }`: `program.origin` is 0, `program.bytes.length` is `wordCount * 4`, and `symbols` is a fresh map of the collected definitions. Every emitted instruction/data word has one source-map entry `{ offset, length: 4, source }`; offsets count **bytes**, and source is the original full statement range, including any inline label but excluding indentation/comments. Label-only lines have no entry. Source ranges and symbol definitions retain their existing values; the AST and unresolved-reference list remain unchanged.

A failure is `{ status: "failure", diagnostics }` with **no `program` or `symbols` properties**. Neither an earlier-stage error nor a second-pass error can expose a successful partial binary. Diagnostics retain phase order; second-pass errors follow in statement order, with any final word-count inconsistency last. Earlier warnings/info can survive a successful result. An empty/comment-only/label-only source may assemble to zero bytes and an empty source map; it is still not runnable. Data-only images may assemble without HALT or instruction validation; deciding what occurs when fetched belongs to the future CPU.

| Diagnostic | Meaning |
| --- | --- |
| A004_INVALID_FIRST_PASS | Failed first-pass status without an existing error explaining it |
| A005_UNDEFINED_SYMBOL | Missing case-sensitive name; range points to the symbol operand |
| A006_OPERAND_RANGE | Resolved instruction operand is not a signed 24-bit integer; operand range retained |
| A007_ENCODING_INCONSISTENCY | Inconsistent pass input/layout/operand shape; offending statement/value range when available |

Exact assembly example (encoded bytes, not CPU execution):

```asm
ldc 10
adc 5
HALT
```

| Word address | Machine word (hex) | Little-endian bytes | Source range |
| --- | --- | --- | --- |
| 0 | 00000A00 | 00 0A 00 00 | line 1, columns 1–7 |
| 1 | 00000501 | 01 05 00 00 | line 2, columns 1–6 |
| 2 | 00000012 | 12 00 00 00 | line 3, columns 1–5 |

End columns above are exclusive. Source-map byte offsets are 0, 4, and 8. `br -1` independently encodes as `FFFFFF11` / `11 FF FF FF`; `data -1` encodes as `FFFFFFFF` / `FF FF FF FF`.

## CPU foundation API (Day 6)

`src/lib/cpu/index.ts` exposes a React-independent CPU API, using the existing `CpuState`, `MachineCode`, execution status/limit contracts, and ISA constants. `src/types/cpu.ts` adds detached snapshot, decoded instruction, `CpuResult<T>`, and structured runtime diagnostic types.

| API | Implemented behavior |
| --- | --- |
| `createCpu(): Cpu` | Returns an opaque frozen handle for private registers, a 65,536-word `Int32Array`, and lifecycle bookkeeping in the cold state |
| `loadProgram(cpu, machineCode): CpuResult<void>` | Validates/copies a complete origin-zero image, then clears memory, loads little-endian signed words, resets registers/count/diagnostic and trace collections, and sets ready/idle |
| `resetCpu(cpu): void` | Restores the most recently loaded image and initial machine state; preserves image metadata and configured limit |
| `getCpuSnapshot(cpu): CpuFoundationSnapshot` | Returns detached registers, memory, program bytes/source maps, status, attempt count, limits, and diagnostic/trace collections |
| `decodeInstruction(word): CpuResult<DecodedInstruction>` | Pure opcode/operand decode with the exact input word preserved |
| `fetchInstruction(cpu, address?): CpuResult<DecodedInstruction>` | Reads at PC by default, or at an explicit word address, and decodes without executing or changing PC/count/status |
| `readMemory(cpu, address)` / `writeMemory(cpu, address, value)` | Checked word access, returning a `CpuResult` with the value or `undefined` on successful write |
| `writeRegister(cpu, name, value)` | Checked A/B/PC/SP setup; does not execute an instruction |
| `setExecutionLimit(cpu, maxInstructions)` | Validates/stores a future cumulative attempt limit; does not count or execute attempts |

`CpuResult<T>` is `{ ok: true, value: T }` or `{ ok: false, diagnostic: RuntimeDiagnostic }`. Failed operations have no value. These image/setup/fetch/decode operations return diagnostics without mutating the CPU on failure or appending runtime state. Inspection alone never executes HALT, changes status, or counts attempts. Execution operations below return a separate lightweight summary and record runtime faults. Trace recording remains unimplemented. Passing a forged/foreign CPU handle is a programming error and throws `TypeError`.

### Loading, ownership, and reset

The loader accepts `MachineCode` with origin exactly 0, `Uint8Array` bytes (including views/Node Buffers), and a byte length divisible by four in 0–262,144. It validates first and copies bytes and typed source-map metadata before committing. Failure preserves the entire previous state and the previous reset image. Loading never interprets data/instruction encodings, so any signed 32-bit word pattern can be installed. Words are read via little-endian `DataView.getInt32`, starting at memory word 0; all remaining memory is zero. A nonempty image becomes ready, including data-only images; ready does not prove valid runtime behavior. An empty image becomes idle and replaces the previous reset image.

Memory and saved binary/source metadata are private. Changing the assembler result after load cannot change memory or the image used by reset. Snapshots are deep copies; changing snapshot memory, registers, bytes, nested source ranges, or limits cannot corrupt the CPU. Loads/resets reuse internal memory and clear it before restoring words; memory copying occurs only on explicit snapshots, not on register writes, reads, fetches, or configuration changes. Snapshotting deliberately copies the 256 KiB memory array and saved image. The source document, symbols, and browser state remain owned outside the CPU.

### Decode, fetch, and validation

The pure decoder accepts integer numbers represented either as signed 32-bit values (-2,147,483,648 through 2,147,483,647) or unsigned 32-bit bit patterns (0 through 4,294,967,295). It preserves the exact input number in `word`, reads `opcode = word & 0xff`, and sign-extends `operand = word >> 8`. Metadata determines mnemonic and operand presence. Opcodes 19–255 and nonzero operand bits for operand-free instructions fail. Nonintegers/out-of-range numbers fail before bitwise conversion. CPU memory always stores the signed representation, so fetched `word` values are signed.

Fetch validates an integer word address 0–65,535 and attaches that address to decode errors. The optional inspection address never changes PC. Fetch may inspect zero-filled memory beyond the image or in a cold/empty CPU; decoding those bits is not execution or a transition to ready. Execution reuses the same checked fetch/decoder internally after counting the attempt.

Pure helpers `isSignedWord`, `isValidRegisterValue`, `isValidPc`, `isValidSp`, `isMemoryAddress`, `isValidImageSize`, and `isValidExecutionLimit` enforce integer/range rules without coercion, truncation, or wrapping. Setup writes require already-valid signed A/B/memory values; instruction arithmetic applies ISA wrapping separately. SP may be 65,536 while PC and memory addresses may not. The default limit is 100,000; custom limits are integers 1–10,000,000 and persist across loads/resets. `setExecutionLimit` additionally rejects a limit below the count already attempted. A configuration change never resets attempts or resumes a terminal CPU.

Foundation diagnostic codes are C001_INVALID_WORD, C002_INVALID_OPCODE, C003_INVALID_ENCODING, C004_INVALID_PC, C005_INVALID_ADDRESS, C006_INVALID_REGISTER, C007_INVALID_MEMORY_VALUE, C008_INVALID_ORIGIN, C009_INVALID_IMAGE_SIZE, C010_INVALID_EXECUTION_LIMIT, and C011_INVALID_IMAGE_TYPE. They extend existing diagnostics with optional `address`/`word`/`target` fields. Fetch/decode errors preserve the offending word when applicable. During execution, `address` is the faulting instruction address; `target` records an invalid computed address/SP/PC or shift count. When available, the loaded source map supplies the instruction's source range. Returned diagnostics are detached copies.

## Instruction execution API (Day 7)

`stepCpu(cpu): CpuExecutionResult` and `runCpuBatch(cpu, maxSteps): CpuExecutionResult` are exported from `src/lib/cpu/index.ts`. Both use the same private attempt/commit path and the pure effect-preparation phase in `execution.ts`. They never expose live state or copy the full memory array per attempt. Preparation reads old state and stages only four candidate registers and an optional single-word store; writes happen only after all validation succeeds.

Results contain `{ status, attempts, attemptedInstructions, diagnostics }`: actual CPU status, attempts in this call, cumulative attempts, and detached runtime diagnostics. Ordinary completion pauses before the next instruction. Ready/paused CPUs enter running while synchronous work is performed, then return paused or terminal. Idle CPUs and terminal halted/error/limit-reached CPUs are unchanged by execution calls and return zero new attempts. Cold/empty memory is inspectable but cannot execute until a nonempty image is loaded.

`maxSteps` must be an integer 1–10,000,000; batches stop at that bound or earlier on HALT/fault/CPU budget. Invalid bounds return C015_INVALID_BATCH_SIZE in the result without changing CPU state/count/diagnostic storage; result status remains the actual CPU status, so callers must inspect diagnostics too. There are no scheduling callbacks, asynchronous timers, animations, breakpoints, or traces. Browser scheduling remains Day 8 work.

| Execution diagnostic | Meaning |
| --- | --- |
| C012_INVALID_SP | Candidate SP is outside 0–65,536 |
| C013_INVALID_SHIFT | Shift count is not an integer 0–31 |
| C014_INVALID_TARGET | Candidate next PC is outside 0–65,535, including fallthrough |
| C015_INVALID_BATCH_SIZE | Invalid caller batch configuration; no instruction attempted |

Existing C002/C003 decode faults and C004/C005 PC/access faults are reused. Runtime faults set error and append one source-associated diagnostic, preserving all instruction registers and memory. No trace entry is recorded. The only ways to clear attempts and restore execution eligibility are reset or successful load.

### HALT, faults, and execution limits

Instruction attempts follow this implemented order:

1. Check the cumulative attempt budget before fetching. If exhausted, stop with status limit-reached without another fetch, attempt, or register/memory mutation.
2. Increment the attempt count, validate PC, fetch/decode, then validate opcode and zero payload for operand-free instructions.
3. Validate a shift count if relevant, then any memory address / candidate SP, then the candidate next PC (except HALT, which retains p).
4. Commit all effects simultaneously, or fault atomically: status error, a structured diagnostic, unchanged registers and memory, and PC still at the faulting instruction. The attempt count/status/diagnostic are bookkeeping, not rolled back. If a nonterminal commit uses the last permitted attempt, stop with limit-reached after that commit; HALT/fault take precedence if they occur on the final allowed attempt. A future tracing layer may record these events; none is implemented today.

Invalid opcode 19–255, invalid operand-free encoding, invalid fetch/access/PC/SP, and invalid shift counts fault. Address computations never wrap to an apparently valid address. HALT is successful termination and counts as one attempt; faults, including failed fetches, also count. HALT at word 65,535 succeeds; a non-HALT fallthrough to 65,536 faults before any effects commit. There are no implicit traps for stack/code overlap, division, flags, or I/O because those mechanisms do not exist.

Default budget: **100,000 attempts**; caller-configured budget: integer **1–10,000,000**, otherwise reject configuration before starting. Pause/resume and Step share the same cumulative budget; they cannot bypass the limit. Reset/new image starts a fresh count. A single successful Step pauses before the next instruction unless it halts, faults, or reaches the limit; Run continues until a stop condition. Terminal halted/error/limit-reached states require reset or a new image before restarting.

The tested program `ldc 10`, `adc 5`, `HALT` terminates with A=15, B=0, PC=2, SP=65,536, three attempts, status halted. A countdown from 3 uses 12 attempts; a descending-stack store/load preserves memory[65,535]=42 and restores SP. These are internal automated execution fixtures; the browser UI remains disconnected.

Day 12's internal test-case engine starts from a fresh loaded CPU plus validated optional initial-state inputs, then runs under the same budget. Assertions compare selected registers/memory cells by exact integer equality; unlisted state is ignored. PC/SP inputs/assertions use their address/pointer ranges, A/B and memory use signed 32-bit values. Duplicate initial memory addresses or assertions on the same target are invalid definitions. Default PASS requires normal HALT and matching assertions; an explicit error status plus exact CPU fault code, or explicit limit-reached status, can instead define a negative test. Invalid setup, assembly failure, cancellation or no runnable image always fails. Bounded execution/cancellation and the complete schema are specified in [TESTING.md](TESTING.md). Browser test-case integration is not implemented until Day 13; earlier implementation-status notes in this ISA document describe their historical engine milestones.

## Day 8 boundary

`src/lib/assembler/isa.ts` holds unchanged instruction metadata and architectural constants. The scanner/parser, both assembler passes, and CPU execution use React-independent contracts. The UI's Assemble/Run/Step and other engine actions remain disabled; these modules are not wired to live editor diagnostics or CPU panels.

Day 7 stops at internal instruction execution, structured atomic faults, cumulative attempt limits, and synchronous bounded batches. Frontend scheduling/integration, debugger, breakpoints, trace recording, and test-case execution remain future work. The assembler itself still produces no CPU state or execution result.
