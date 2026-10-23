"use client";

import { useEffect, useRef } from "react";
import { BookOpen, FlaskConical, X } from "lucide-react";
import type { ToolPanel } from "@/types/ide";

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
      <div className="drawer-footer">DRAFT REFERENCE <span>Engine not implemented</span></div>
    </dialog>
  );
}

function InfoContent() {
  return <>
    <span className="section-eyebrow">WORKSPACE GUIDE</span>
    <h3 className="drawer-title">A place to start.</h3>
    <p className="drawer-intro">Write, explore, and keep your assembly source. Execution comes in a later milestone.</p>
    <div className="draft-callout"><strong>Draft documentation</strong><p>The ISA and machine-code encoding are not final. Examples and syntax highlighting are provisional.</p></div>
    <section className="doc-section" aria-labelledby="info-getting-started"><h3 id="info-getting-started" tabIndex={-1}><span>01</span>Getting Started</h3><p>Edit the source, upload a UTF-8 .asm or .txt file up to 1 MB, or choose an example. Create starts a blank file.</p><p>Your draft saves in this browser. Ctrl+S requests an .asm download; Ctrl+N creates a blank program through the same replacement confirmation. These shortcuts apply inside the IDE and pause in dialogs or unrelated inputs.</p><p>Monaco supports undo, find, indentation, and standard keyboard editing. Replacing a file starts a fresh undo history. Press Ctrl+M to toggle whether Tab moves focus out of the editor.</p></section>
    <section className="doc-section" aria-labelledby="info-assembly-rules"><h3 id="info-assembly-rules" tabIndex={-1}><span>02</span>Assembly Rules</h3><p>For editing only, semicolons highlight comments, a name followed by a colon highlights a label, and decimal and hexadecimal literals receive highlighting.</p><p>These conventions do not define an accepted grammar. No source validation is performed.</p></section>
    <section className="doc-section" aria-labelledby="info-instruction-set"><h3 id="info-instruction-set" tabIndex={-1}><span>03</span>Instruction Set</h3><p>Mnemonics such as MOV, ADD, and HLT are highlighted for illustration. The exact 19 instructions, operands, behavior, flags, and encoding are decisions for Day 3.</p></section>
    <section className="doc-section" aria-labelledby="info-cpu-architecture"><h3 id="info-cpu-architecture" tabIndex={-1}><span>04</span>CPU Architecture</h3><p>The interface reserves registers A, B, PC, and SP, plus a memory inspector. Register widths, memory size, stack behavior, addressing, and instruction behavior are not yet specified.</p></section>
    <section className="doc-section" aria-labelledby="info-debugging-basics"><h3 id="info-debugging-basics" tabIndex={-1}><span>05</span>Debugging Basics</h3><p>Run, Step, Pause, Reset, breakpoints, and speed controls are unavailable. F5 and F10 are not bound to execution. Trace and disassembly show empty states until an engine exists.</p></section>
    <section className="doc-section" aria-labelledby="info-test-cases-guide"><h3 id="info-test-cases-guide" tabIndex={-1}><span>06</span>Test Cases Guide</h3><p>The separate Test Cases panel outlines future predefined and custom tests. Expected-state assertions will compare selected registers and memory addresses with expected values. No tests are run or marked passing today.</p></section>
  </>;
}

function TestCasesContent() {
  return <>
    <span className="section-eyebrow">TEST WORKSPACE</span>
    <h3 className="drawer-title">Built for checking your work.</h3>
    <p className="drawer-intro">Test execution will arrive after the instruction set and CPU engine are defined.</p>
    <div className="draft-callout"><strong>Testing engine not implemented</strong><p>No programs have been executed and no test results are available.</p></div>
    <section className="planned-test" aria-labelledby="tests-predefined"><div><h3 id="tests-predefined" tabIndex={-1}>Predefined Tests</h3><span className="draft-tag">PLANNED</span></div><p>Reference programs and expected outcomes will be added after the ISA is finalized.</p><div className="test-empty"><FlaskConical size={23} strokeWidth={1.4} /><span>No predefined tests yet</span></div><button className="planned-button" disabled>Run predefined tests</button></section>
    <section className="planned-test" aria-labelledby="tests-custom"><div><h3 id="tests-custom" tabIndex={-1}>Custom Tests</h3><span className="draft-tag">PLANNED</span></div><p>A future workspace for source programs, optional initial register/memory values, and expected-state assertions.</p><p>Assertions will name a register (A, B, PC, or SP) or a memory address and its expected value. Only selected state will be checked. Valid ranges and comparison rules depend on the Day 3 architecture decisions.</p><p>There are no pass/fail results yet. Execution and assertion evaluation remain unavailable.</p><button className="planned-button" disabled>Create a custom test</button></section>
  </>;
}
