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
      <div className="drawer-footer">ISA v1 REFERENCE <span>Engine not implemented</span></div>
    </dialog>
  );
}

function InfoContent() {
  return <>
    <span className="section-eyebrow">WORKSPACE GUIDE</span>
    <h3 className="drawer-title">A place to start.</h3>
    <p className="drawer-intro">Write, explore, and keep your assembly source. Execution comes in a later milestone.</p>
    <div className="draft-callout"><strong>ISA v1 is specified</strong><p>The source parser is implemented and tested independently. It is not connected to live editor diagnostics. Highlighting is not proof of valid assembly; assembly and execution remain unavailable.</p></div>
    <section className="doc-section" aria-labelledby="info-getting-started"><h3 id="info-getting-started" tabIndex={-1}><span>01</span>Getting Started</h3><p>Edit the source, upload a UTF-8 .asm or .txt file up to 1 MB, or choose an example. Create starts a blank file.</p><p>Your draft saves in this browser. Ctrl+S requests an .asm download; Ctrl+N creates a blank program through the same replacement confirmation. These shortcuts apply inside the IDE and pause in dialogs or unrelated inputs.</p><p>Monaco supports undo, find, indentation, and standard keyboard editing. Replacing a file starts a fresh undo history. Press Ctrl+M to toggle whether Tab moves focus out of the editor.</p></section>
    <section className="doc-section" aria-labelledby="info-assembly-rules"><h3 id="info-assembly-rules" tabIndex={-1}><span>02</span>Assembly Rules</h3><p>Use one instruction or data directive per line, optionally preceded by one label and a colon. A label may stand alone. Semicolons begin comments. Space and Tab separate tokens; LF, CRLF, and CR separate lines. No commas, brackets, strings, expressions, or register operands are supported.</p><p>Mnemonics and data are case-insensitive. Labels match [A-Za-z_][A-Za-z0-9_]* and are case-sensitive. Label names may also look like mnemonics or register names; an operand named A is a symbol, not a register. Forward references are accepted; undefined and duplicate symbols are checked in a future assembler pass.</p><p>Required instruction operands accept a signed decimal/hex integer (for example -12, +7, -0x10) or a label. The numeric range is -8,388,608 through 8,388,607. For call/brz/brlz/br, labels will become offsets from the next instruction; other symbols will become absolute word addresses.</p><p>The separate data directive takes one signed 32-bit integer (-2,147,483,648 through 2,147,483,647), including hexadecimal with an optional sign. It is not a CPU opcode and accepts no symbol operand. Use data -1 for all-one bits; positive 0xFFFFFFFF is out of range. Source spans use one-based lines and UTF-16 columns with exclusive ends; a Tab counts as one column.</p></section>
    <section className="doc-section" aria-labelledby="info-instruction-set"><h3 id="info-instruction-set" tabIndex={-1}><span>03</span>Instruction Set</h3><p>Exactly 19 opcodes, in order 0–18. Every effect uses the old register values simultaneously; p is the fetched instruction address and N is p + 1. Registers and memory not mentioned stay unchanged. M is word-addressed memory.</p><div className="instruction-reference">{INSTRUCTIONS.map((instruction) => <div key={instruction.opcode}><h4><code>{instruction.mnemonic}{instruction.operandKinds.length ? " operand" : ""}</code><span>opcode {instruction.opcode}</span></h4><p>{instruction.description}. {instruction.effect}.</p></div>)}</div><p>A/B arithmetic wraps to signed 32 bits. Shifts require A in 0–31; shr sign-extends. All memory accesses and resulting PC/SP values are bounds-checked before any state change. The operand-free instructions require zero encoded operand bits.</p></section>
    <section className="doc-section" aria-labelledby="info-cpu-architecture"><h3 id="info-cpu-architecture" tabIndex={-1}><span>04</span>CPU Architecture</h3><p>A and B are signed 32-bit registers. PC addresses the next instruction to fetch (0–65,535). SP is a checked word pointer (0–65,536); the one-past-end value represents the empty descending stack. Memory contains 65,536 signed 32-bit words (256 KiB), shared by code and data. There are no flags, I/O ports, automatic stack operations, or memory protection.</p><p>Initial/reset registers are A = B = PC = 0, SP = 65,536. Reset clears memory, reloads the last successful image at word 0 if present, and clears trace/attempt count/runtime diagnostics. Source, breakpoints, and speed settings are retained. Initial absence of a machine state is still shown as an empty inspector.</p><p>Each instruction is one 32-bit word: opcode in bits 7–0, signed operand in bits 31–8; serialization is four bytes, little-endian. data emits one full word in a future assembler. call saves p in A (and the old A in B); return targets old A + 1 and restores A from B. Nested calls require explicit saving of return links.</p><p>HALT terminates normally without advancing PC. Invalid opcodes/encodings, memory accesses, PC/SP values, or shift counts fault atomically, leaving registers/memory unchanged at the faulting instruction. Untaken branch targets are not checked. Program limits default to 100,000 attempts, with a configurable maximum of 10,000,000; HALT and faults count, and pause/resume does not renew the budget. No CPU behavior is implemented yet.</p></section>
    <section className="doc-section" aria-labelledby="info-debugging-basics"><h3 id="info-debugging-basics" tabIndex={-1}><span>05</span>Debugging Basics</h3><p>Run, Step, Pause, Reset, breakpoints, and speed controls are unavailable. F5 and F10 are not bound to execution. Trace and disassembly show empty states until an engine exists.</p></section>
    <section className="doc-section" aria-labelledby="info-test-cases-guide"><h3 id="info-test-cases-guide" tabIndex={-1}><span>06</span>Test Cases Guide</h3><p>The separate Test Cases panel outlines future predefined and custom tests. Expected-state assertions will compare selected registers and memory addresses with expected values. No tests are run or marked passing today.</p></section>
  </>;
}

function TestCasesContent() {
  return <>
    <span className="section-eyebrow">TEST WORKSPACE</span>
    <h3 className="drawer-title">Built for checking your work.</h3>
    <p className="drawer-intro">ISA v1 is specified. Test execution will arrive with the future assembler and CPU engine.</p>
    <div className="draft-callout"><strong>Testing engine not implemented</strong><p>No programs have been executed and no test results are available.</p></div>
    <section className="planned-test" aria-labelledby="tests-predefined"><div><h3 id="tests-predefined" tabIndex={-1}>Predefined Tests</h3><span className="draft-tag">PLANNED</span></div><p>Reference programs and expected states will be added with the future CPU testing engine.</p><div className="test-empty"><FlaskConical size={23} strokeWidth={1.4} /><span>No predefined tests yet</span></div><button className="planned-button" disabled>Run predefined tests</button></section>
    <section className="planned-test" aria-labelledby="tests-custom"><div><h3 id="tests-custom" tabIndex={-1}>Custom Tests</h3><span className="draft-tag">PLANNED</span></div><p>A future workspace for source programs, optional initial register/memory values, and expected-state assertions.</p><p>Assertions select A/B signed 32-bit values, PC word addresses 0–65,535, SP values 0–65,536, or signed 32-bit memory words at addresses 0–65,535. Comparisons will use exact integer equality; unlisted state is ignored. An execution fault or exhausted budget will fail a test, even if selected values happen to match.</p><p>There are no pass/fail results yet. Execution and assertion evaluation remain unavailable.</p><button className="planned-button" disabled>Create a custom test</button></section>
  </>;
}
