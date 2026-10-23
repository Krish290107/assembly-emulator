"use client";

import { useEffect, useRef } from "react";
import { BookOpen, FlaskConical, X } from "lucide-react";
import type { ToolPanel } from "@/types/ide";
import { INSTRUCTIONS } from "@/lib/assembler/isa";

interface ToolPanelProps {
  panel: Exclude<ToolPanel, null>;
  onClose: () => void;
}

const INFO_SECTIONS = [
  ["getting-started", "Getting Started"], ["assembly-rules", "Assembly Rules"],
  ["instruction-set", "Instruction Set"], ["cpu-architecture", "CPU Architecture"],
  ["debugging-basics", "Debugging Basics"], ["test-cases-guide", "Test Cases Guide"],
] as const;
const TEST_SECTIONS = [["predefined", "Predefined Tests"], ["custom", "Custom Tests"]] as const;

export function ToolPanelView({ panel, onClose }: ToolPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isInfo = panel === "info";
  const Icon = isInfo ? BookOpen : FlaskConical;

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={dialog} id={`${panel}-panel`} className="tool-panel" aria-labelledby={`${panel}-title`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
      <div className="drawer-heading"><div><Icon size={18} /><h2 id={`${panel}-title`}>{isInfo ? "Documentation" : "Test Cases"}</h2></div><button autoFocus className="icon-button" aria-label={`Close ${isInfo ? "documentation" : "test cases"}`} onClick={onClose}><X size={18} /></button></div>
      <nav className="section-navigation" aria-label={isInfo ? "Documentation sections" : "Test case sections"}>
        {(isInfo ? INFO_SECTIONS : TEST_SECTIONS).map(([id, title]) => <button key={id} onClick={() => {
          const heading = dialog.current?.querySelector<HTMLElement>(`#${panel}-${id}`);
          heading?.focus({ preventScroll: true });
          heading?.scrollIntoView({ block: "start" });
        }}>{title}</button>)}
      </nav>
      <div className="drawer-content">{isInfo ? <InfoContent /> : <TestCasesContent />}</div>
      <div className="drawer-footer">ISA v1 REFERENCE <span>Live assembler & CPU</span></div>
    </dialog>
  );
}

function InfoContent() {
  return <>
    <span className="section-eyebrow">WORKSPACE GUIDE</span>
    <h3 className="drawer-title">A place to start.</h3>
    <p className="drawer-intro">Write, explore, and keep your assembly source. Assemble your source, inspect the machine code, and run or step through the CPU.</p>
    <div className="draft-callout"><strong>ISA v1 is specified</strong><p>Assemble validates source and loads the CPU without executing. Errors show exact source positions. Editing invalidates the loaded image; highlighting alone is not validation.</p></div>
    <section className="doc-section" aria-labelledby="info-getting-started"><h3 id="info-getting-started" tabIndex={-1}><span>01</span>Getting Started</h3><p>Edit the source, upload a UTF-8 .asm or .txt file up to 1 MB, or choose an example. Create starts a blank file. Assemble prepares the current image. Run continues it; Step attempts one instruction. Pause stops before the next batch. Reset restores the loaded image and zero attempts without changing source. Reassemble after edits; reset or reassemble a halted, faulted, or limited program.</p><p>Your draft saves in this browser. Ctrl+S requests an .asm download; Ctrl+N creates a blank program through the same replacement confirmation. These shortcuts apply inside the IDE and pause in dialogs or unrelated inputs.</p><p>Monaco supports undo, find, indentation, and standard keyboard editing. Replacing a file starts a fresh undo history. Press Ctrl+M to toggle whether Tab moves focus out of the editor.</p></section>
    <section className="doc-section" aria-labelledby="info-assembly-rules"><h3 id="info-assembly-rules" tabIndex={-1}><span>02</span>Assembly Rules</h3><p>Use one instruction or data directive per line, optionally preceded by one label and a colon. A label may stand alone. Semicolons begin comments. Space and Tab separate tokens; LF, CRLF, and CR separate lines. No commas, brackets, strings, expressions, or register operands are supported.</p><p>Mnemonics and data are case-insensitive. Labels match [A-Za-z_][A-Za-z0-9_]* and are case-sensitive. Label names may also look like mnemonics or register names; an operand named A is a symbol, not a register. Forward references are accepted; undefined and duplicate symbols are checked during assembly.</p><p>Required instruction operands accept a signed decimal/hex integer (for example -12, +7, -0x10) or a label. The numeric range is -8,388,608 through 8,388,607. For call/brz/brlz/br, labels become offsets from the next instruction; other symbols become absolute word addresses.</p><p>The separate data directive takes one signed 32-bit integer (-2,147,483,648 through 2,147,483,647), including hexadecimal with an optional sign. It is not a CPU opcode and accepts no symbol operand. Use data -1 for all-one bits; positive 0xFFFFFFFF is out of range. Source spans use one-based lines and UTF-16 columns with exclusive ends; a Tab counts as one column.</p></section>
    <section className="doc-section" aria-labelledby="info-instruction-set"><h3 id="info-instruction-set" tabIndex={-1}><span>03</span>Instruction Set</h3><p>Exactly 19 opcodes, in order 0–18. Every effect uses the old register values simultaneously; p is the fetched instruction address and N is p + 1. Registers and memory not mentioned stay unchanged. M is word-addressed memory.</p><div className="instruction-reference">{INSTRUCTIONS.map((instruction) => <div key={instruction.opcode}><h4><code>{instruction.mnemonic}{instruction.operandKinds.length ? " operand" : ""}</code><span>opcode {instruction.opcode}</span></h4><p>{instruction.description}. {instruction.effect}.</p></div>)}</div><p>A/B arithmetic wraps to signed 32 bits. Shifts require A in 0–31; shr sign-extends. All memory accesses and resulting PC/SP values are bounds-checked before any state change. The operand-free instructions require zero encoded operand bits.</p></section>
    <section className="doc-section" aria-labelledby="info-cpu-architecture"><h3 id="info-cpu-architecture" tabIndex={-1}><span>04</span>CPU Architecture</h3><p>A and B are signed 32-bit registers. PC addresses the next instruction to fetch (0–65,535). SP is a checked word pointer (0–65,536); the one-past-end value represents the empty descending stack. Memory contains 65,536 signed 32-bit words (256 KiB), shared by code and data. There are no flags, I/O ports, automatic stack operations, or memory protection.</p><p>Initial/reset registers are A = B = PC = 0, SP = 65,536. Reset clears memory, reloads the last successful image at word 0 if present, and clears trace/attempt count/runtime diagnostics. Source, breakpoints, and speed settings are retained. Registers appear after assembly. Memory navigation accepts word addresses in decimal or 0x hex; PC and SP shortcuts show code and stack regions.</p><p>Each instruction is one 32-bit word: opcode in bits 7–0, signed operand in bits 31–8; serialization is four bytes, little-endian. data emits one full word. call saves p in A (and the old A in B); return targets old A + 1 and restores A from B. Nested calls require explicit saving of return links.</p><p>HALT terminates normally without advancing PC. Invalid opcodes/encodings, memory accesses, PC/SP values, or shift counts fault atomically, leaving registers/memory unchanged at the faulting instruction. Untaken branch targets are not checked. Program limits default to 100,000 attempts, with a configurable maximum of 10,000,000; HALT and faults count, and pause/resume does not renew the budget. CPU execution is implemented; runtime faults and limit stops appear in Errors. Reset clears runtime diagnostics.</p></section>
    <section className="doc-section" aria-labelledby="info-debugging-basics"><h3 id="info-debugging-basics" tabIndex={-1}><span>05</span>Debugging Basics</h3><p>Click Monaco’s left glyph gutter or press F9 on a source line to toggle a breakpoint. Open Execution Trace (or the small debugger toolbar button) for the accessible line-number form, enable checkboxes, Source/Remove buttons, and Clear breakpoints. The form also works with the plain-text editor. Red dots mark enabled breakpoints; outlined dots are disabled and dim dots are unresolved. Current execution lines have a separate blue highlight.</p><p>Only a line containing a CPU instruction binds to its word address, including an inline label and instruction. Comments, blank lines, label-only lines, and data directives do not bind or slide to another line; the list explains why. Before assembly, definitions remain pending. Reset preserves definitions and enabled flags. Reassembly of unchanged source resolves them again; editing or replacing source clears them so addresses cannot go stale. Breakpoints are kept for this session, not saved with the draft.</p><p>Run stops before an enabled breakpoint without consuming an attempt or creating a trace entry. Run again to pass that stopped address once; a later loop revisit stops again. Step attempts exactly one instruction, even at a breakpoint. Pause cancels scheduled work; Slow/Normal/Fast changes scheduling only. HALT, faults and the cumulative attempt budget keep their normal behavior.</p><p>The trace retains the last 500 actual attempts, including HALT and faulting attempts, and reports discarded older entries. Its table shows cumulative step, PC before execution, decoded fetched instruction, and result. Select a step for actual fetched bits, before/after registers (changes highlighted), committed memory-write address and old/new value, source position when reliable, and fault details. A * marks bits changed since reset. Modified words keep breakpoints at the original word address, but trace source links and current-line highlights are suppressed when bits differ from the image.</p><p>Go to source navigates without restoring registers or memory. This is history inspection, not time travel. Clear trace removes history without resetting attempts or execution. Reset and reassembly clear history; source edits clear it too. Registers and visible memory changes remain highlighted in the live inspectors. F5 and F10 are not bound to execution.</p></section>
    <section className="doc-section" aria-labelledby="info-test-cases-guide"><h3 id="info-test-cases-guide" tabIndex={-1}><span>06</span>Test Cases Guide</h3><p>The separate Test Cases panel outlines future predefined and custom tests. Expected-state assertions will compare selected registers and memory addresses with expected values. No tests are run or marked passing today.</p></section>
  </>;
}

function TestCasesContent() {
  return <>
    <span className="section-eyebrow">TEST WORKSPACE</span>
    <h3 className="drawer-title">Built for checking your work.</h3>
    <p className="drawer-intro">ISA v1 is specified. Custom and predefined test execution is planned for Days 12–13.</p>
    <div className="draft-callout"><strong>Testing engine not implemented</strong><p>The Test Cases runner is not connected. Run programs with the execution toolbar; no custom pass/fail results are available.</p></div>
    <section className="planned-test" aria-labelledby="tests-predefined"><div><h3 id="tests-predefined" tabIndex={-1}>Predefined Tests</h3><span className="draft-tag">PLANNED</span></div><p>Reference programs and expected states will be added with the future CPU testing engine.</p><div className="test-empty"><FlaskConical size={23} strokeWidth={1.4} /><span>No predefined tests yet</span></div><button className="planned-button" disabled>Run predefined tests</button></section>
    <section className="planned-test" aria-labelledby="tests-custom"><div><h3 id="tests-custom" tabIndex={-1}>Custom Tests</h3><span className="draft-tag">PLANNED</span></div><p>A future workspace for source programs, optional initial register/memory values, and expected-state assertions.</p><p>Assertions select A/B signed 32-bit values, PC word addresses 0–65,535, SP values 0–65,536, or signed 32-bit memory words at addresses 0–65,535. Comparisons will use exact integer equality; unlisted state is ignored. An execution fault or exhausted budget will fail a test, even if selected values happen to match.</p><p>There are no pass/fail results yet. Custom test execution and assertion evaluation remain unavailable.</p><button className="planned-button" disabled>Create a custom test</button></section>
  </>;
}
