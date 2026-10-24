"use client";

import { useId, useRef } from "react";
import { Braces, CircleAlert, ListTree, Terminal } from "lucide-react";
import { DISASSEMBLY_WINDOW, type WorkspaceView } from "@/lib/workspace/controller";
import type { OutputTab } from "@/types/ide";
import { DebuggerPanel, type DebuggerActions } from "./debugger-panel";
import { runtimeDiagnosticContext } from "@/lib/workspace/debugger";

const TABS = [
  { id: "output", title: "Output", icon: Terminal }, { id: "errors", title: "Errors", icon: CircleAlert },
  { id: "trace", title: "Execution Trace", icon: ListTree }, { id: "disassembly", title: "Disassembly", icon: Braces },
] as const;

export function OutputPanel({ view, onAddress, active, onTabChange: setActive, debuggerActions }: { view: WorkspaceView; onAddress: (address: number) => void; active: OutputTab; onTabChange: (tab: OutputTab) => void; debuggerActions: DebuggerActions }) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  return <section className="output-panel" aria-label="Program results">
    <div className="output-tabbar" role="tablist" aria-label="Result views">
      {TABS.map((tab, index) => <button key={tab.id} ref={(element) => { tabs.current[index] = element; }} id={`${id}-${tab.id}-tab`} role="tab" aria-selected={active === tab.id} aria-controls={`${id}-${tab.id}-panel`} tabIndex={active === tab.id ? 0 : -1} className={`output-tab ${active === tab.id ? "active" : ""}`} onClick={() => setActive(tab.id)} onKeyDown={(event) => {
        let next: number;
        if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
        else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = TABS.length - 1;
        else return;
        event.preventDefault(); setActive(TABS[next].id); tabs.current[next]?.focus();
      }}><tab.icon size={14} />{tab.title}{tab.id === "errors" && view.diagnostics.length > 0 ? ` (${view.diagnostics.length})` : ""}</button>)}
    </div>
    {TABS.map((tab) => <div key={tab.id} role="tabpanel" id={`${id}-${tab.id}-panel`} aria-labelledby={`${id}-${tab.id}-tab`} hidden={active !== tab.id} tabIndex={0} className="result-content">
      {tab.id === "output" && <><p className="result-summary">{view.assembled ? `${view.wordCount} words · ${view.wordCount * 4} bytes · ${view.symbolCount} symbols · ${view.status}` : "Not assembled"}</p><ol className="event-log">{view.logs.map((message, index) => <li key={index}>{message}</li>)}</ol></>}
      {tab.id === "errors" && (view.diagnostics.length ? <ul className="diagnostic-list">{view.diagnostics.map((diagnostic, index) => {
        const context = runtimeDiagnosticContext(diagnostic, view.cpu);
        return <li key={index}><strong>{diagnostic.code}</strong>{diagnostic.source && <span>Line {diagnostic.source.start.line}, column {diagnostic.source.start.column}</span>}<p>{diagnostic.message}</p>{context && <p className="diagnostic-context">{context}</p>}{diagnostic.related?.map((related, relatedIndex) => <p key={relatedIndex}>{related.message} Line {related.source.start.line}, column {related.source.start.column}.</p>)}</li>;
      })}</ul> : <p>{view.assembled ? "No assembly or runtime errors." : "Assemble source to check diagnostics."}</p>)}
      {tab.id === "trace" && <DebuggerPanel view={view} actions={debuggerActions} />}
      {tab.id === "disassembly" && (view.assembled && view.wordCount ? <>
        <div className="code-navigation"><button disabled={view.disassemblyStart === 0} onClick={() => onAddress(Math.max(0, view.disassemblyStart - DISASSEMBLY_WINDOW))}>Previous</button><span>Words {view.disassemblyStart}–{view.disassemblyStart + view.disassembly.length - 1} of {view.wordCount}</span><button disabled={!view.cpu || view.cpu.registers.PC >= view.wordCount} onClick={() => onAddress(view.cpu!.registers.PC)}>PC</button><button disabled={view.disassemblyStart + DISASSEMBLY_WINDOW >= view.wordCount} onClick={() => onAddress(view.disassemblyStart + DISASSEMBLY_WINDOW)}>Next</button></div>
        <table className="code-table"><thead><tr><th>WORD</th><th>HEX</th><th>DECODED BITS</th><th>ORIGINAL SOURCE</th></tr></thead><tbody>{view.disassembly.map((row) => <tr key={row.address} className={row.address === view.cpu?.registers.PC ? "at-pc" : ""}><th scope="row">{row.address === view.cpu?.registers.PC ? "→ " : ""}{row.address}</th><td>{row.hex}{row.modified ? " *" : ""}</td><td>{row.instruction}</td><td title={row.source}>{row.line ? `${row.line}: ` : ""}{row.source}</td></tr>)}</tbody></table><p className="result-summary">Decoded current memory; data may also form valid instruction bits. * Modified since assembly.</p>
      </> : <p>{view.assembled ? "Empty image: no machine-code words." : "Assemble valid source to show machine code and source mappings."}</p>)}
    </div>)}
  </section>;
}
