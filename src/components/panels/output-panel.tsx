"use client";

import { useId, useRef, useState } from "react";
import { Braces, CircleAlert, ListTree, Terminal } from "lucide-react";
import type { DisassemblyEntry, OutputTab, TraceEntry } from "@/types/ide";

export interface OutputPanelProps {
  trace?: readonly TraceEntry[];
  disassembly?: readonly DisassemblyEntry[];
}

const TABS = [
  { id: "output", title: "Output", icon: Terminal, heading: "Your program output will appear here", text: "The execution engine is not implemented yet. For now, write and save your source." },
  { id: "errors", title: "Errors", icon: CircleAlert, heading: "No diagnostics available", text: "Source validation will be available with the assembler. Your program has not been checked." },
  { id: "trace", title: "Execution Trace", icon: ListTree, heading: "No execution trace", text: "Instructions will appear here when the execution engine supports stepping." },
  { id: "disassembly", title: "Disassembly", icon: Braces, heading: "No disassembly available", text: "Machine code and disassembly depend on the finalized ISA and encoding." },
] as const;

export function OutputPanel() {
  const [active, setActive] = useState<OutputTab>("output");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selected = TABS.find((tab) => tab.id === active)!;
  const Icon = selected.icon;
  return (
    <section className="output-panel" aria-label="Program results">
      <div className="output-tabbar" role="tablist" aria-label="Result views">
        {TABS.map((tab, index) => <button key={tab.id} ref={(element) => { tabs.current[index] = element; }} id={`${id}-${tab.id}-tab`} role="tab" aria-selected={active === tab.id} aria-controls={`${id}-${tab.id}-panel`} tabIndex={active === tab.id ? 0 : -1} className={`output-tab ${active === tab.id ? "active" : ""}`} onClick={() => setActive(tab.id)} onKeyDown={(event) => {
          let next: number;
          if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
          else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = TABS.length - 1;
          else return;
          event.preventDefault();
          setActive(TABS[next].id);
          tabs.current[next]?.focus();
        }}><tab.icon size={14} />{tab.title}</button>)}
      </div>
      <div role="tabpanel" id={`${id}-${active}-panel`} aria-labelledby={`${id}-${active}-tab`} tabIndex={0} className="empty-state output-empty"><Icon size={25} strokeWidth={1.4} /><h3>{selected.heading}</h3><p>{selected.text}</p></div>
    </section>
  );
}
