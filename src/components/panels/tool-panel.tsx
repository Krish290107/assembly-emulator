"use client";

import { useEffect, useRef } from "react";
import { BookOpen, FlaskConical, X } from "lucide-react";
import type { ToolPanel } from "@/types/ide";

interface ToolPanelProps {
  panel: Exclude<ToolPanel, null>;
  onClose: () => void;
}

export function ToolPanelView({ panel, onClose }: ToolPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isInfo = panel === "info";
  const Icon = isInfo ? BookOpen : FlaskConical;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} id={`${panel}-panel`} className="tool-panel" aria-labelledby={`${panel}-title`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
      <div className="drawer-heading"><div><Icon size={18} /><h2 id={`${panel}-title`}>{isInfo ? "Documentation" : "Test Cases"}</h2></div><button autoFocus className="icon-button" aria-label={`Close ${isInfo ? "documentation" : "test cases"}`} onClick={onClose}><X size={18} /></button></div>
      <div className="drawer-content">{isInfo ? <InfoContent /> : <TestCasesContent />}</div>
      <div className="drawer-footer">DAY 1 / 15 <span>Foundation & interface</span></div>
    </dialog>
  );
}

function InfoContent() {
  return <>
    <span className="section-eyebrow">WORKSPACE GUIDE</span>
    <h3 className="drawer-title">A place to start.</h3>
    <p className="drawer-intro">Write, explore, and keep your assembly source. Execution comes in a later milestone.</p>
    <div className="draft-callout"><strong>Draft documentation</strong><p>The ISA and machine-code encoding are not final. Examples and syntax highlighting are provisional.</p></div>
    <section className="doc-section"><h3><span>01</span>Getting Started</h3><p>Edit the source, upload an .asm or .txt file, or choose an example. Create starts a blank file.</p><p>Your draft saves in this browser. Download an .asm copy for a portable backup. Replacing source asks for confirmation when it has not been downloaded.</p><p>Monaco supports undo, find, indentation, and standard keyboard editing. Press Ctrl+M to toggle whether Tab moves focus out of the editor.</p></section>
    <section className="doc-section"><h3><span>02</span>Assembly Rules</h3><p>For editing only, semicolons highlight comments, a name followed by a colon highlights a label, and decimal and hexadecimal literals receive highlighting.</p><p>These conventions do not define an accepted grammar. No source validation is performed.</p></section>
    <section className="doc-section"><h3><span>03</span>Instructions</h3><p>Mnemonics such as MOV, ADD, and HLT are highlighted for illustration. Their operands, behavior, flags, and encoding are not specified yet.</p></section>
    <section className="doc-section"><h3><span>04</span>CPU Architecture</h3><p>The interface reserves registers A, B, PC, and SP, plus a memory inspector. Register widths, memory size, addressing, and instruction behavior will be formally specified in Days 3–5.</p></section>
  </>;
}

function TestCasesContent() {
  return <>
    <span className="section-eyebrow">TEST WORKSPACE</span>
    <h3 className="drawer-title">Built for checking your work.</h3>
    <p className="drawer-intro">Test execution will arrive after the instruction set and CPU engine are defined.</p>
    <div className="draft-callout"><strong>Testing engine not implemented</strong><p>No programs have been executed and no test results are available.</p></div>
    <section className="planned-test"><div><h3>Predefined tests</h3><span className="draft-tag">PLANNED</span></div><p>Reference programs and expected outcomes will be added after the ISA is finalized.</p><div className="test-empty"><FlaskConical size={23} strokeWidth={1.4} /><span>No predefined tests yet</span></div><button className="planned-button" disabled>Run predefined tests</button></section>
    <section className="planned-test"><div><h3>Custom tests</h3><span className="draft-tag">PLANNED</span></div><p>A future workspace for source programs, initial conditions, and expected results.</p><button className="planned-button" disabled>Create a custom test</button></section>
  </>;
}
