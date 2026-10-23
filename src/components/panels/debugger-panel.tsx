"use client";

import { useEffect, useRef, useState } from "react";
import { hexWord, type WorkspaceController, type WorkspaceView } from "@/lib/workspace/controller";
import { filterTrace, traceDownload, TRACE_CAPACITY, TRACE_FILTERS, type TraceFilter } from "@/lib/workspace/debugger";
import { TraceNavigation, TraceTable } from "./trace-table";

export type DebuggerActions = Pick<WorkspaceController, "toggleBreakpoint" | "setBreakpointEnabled" | "removeBreakpoint" | "clearBreakpoints" | "clearTrace" | "selectTrace" | "navigateToTrace" | "navigateToBreakpoint" | "pause">;

export function DebuggerPanel({ view, actions }: { view: WorkspaceView; actions: DebuggerActions }) {
  const [line, setLine] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<TraceFilter>("all");
  const [downloadNotice, setDownloadNotice] = useState("");
  const entry = view.selectedTrace;
  const details = useRef<HTMLElement>(null);
  const selectedStep = entry?.step;
  const visibleTrace = filterTrace(view.trace, filter);
  const selectionHidden = selectedStep !== undefined && !visibleTrace.some(({ step }) => step === selectedStep);
  useEffect(() => {
    // Details are below the table in the existing scrollable Output panel.
    // Reveal only on a new selection, never on execution-batch refreshes.
    if (selectedStep !== undefined) details.current?.scrollIntoView({ block: "start", inline: "nearest" });
  }, [selectedStep]);
  function selectTrace(step: number) {
    actions.selectTrace(step);
    // Selecting the same entry again should also reveal its existing details.
    if (step === selectedStep) details.current?.scrollIntoView({ block: "start", inline: "nearest" });
  }
  function downloadTrace() {
    let url: string | undefined;
    try {
      const exported = traceDownload(view);
      url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = exported.filename;
      document.body.append(anchor);
      try { anchor.click(); } finally { anchor.remove(); }
      const downloadUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setDownloadNotice(`Download requested: ${exported.filename} (${view.trace.length} retained attempts).`);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setDownloadNotice("Trace download could not be started. Try again.");
    }
  }
  return <div className="debugger-content">
    {view.debuggerNotice && <p className="debugger-note" role="status">{view.debuggerNotice}</p>}
    {view.cursorTarget && <p className="debugger-note" role="status">Run to Cursor target: line {view.cursorTarget.sourceLine}, word {view.cursorTarget.address}{view.cursorTarget.modified ? " (word modified)" : ""}. <button type="button" onClick={actions.pause}>Cancel target</button></p>}
    {view.cursorPause && <p className="breakpoint-stop" role="status">Cursor reached: paused before line {view.cursorPause.sourceLine}, word {view.cursorPause.address}{view.cursorPause.modified ? " (word modified)" : ""}. No attempt consumed at the stop. Run continues; Step attempts one instruction.</p>}
    <div className="debugger-heading"><strong>Breakpoints</strong><button disabled={!view.breakpoints.length} onClick={actions.clearBreakpoints}>Clear breakpoints</button></div>
    <form className="breakpoint-form" onSubmit={(event) => {
      event.preventDefault();
      const number = /^\d+$/.test(line.trim()) ? Number(line) : NaN;
      setNotice(actions.toggleBreakpoint(number) ? "Breakpoint line toggled." : "Enter an existing positive source line number.");
    }}><label htmlFor="breakpoint-line">Source line</label><input id="breakpoint-line" value={line} onChange={(event) => setLine(event.target.value)} inputMode="numeric" placeholder="1" /><button>Toggle</button></form>
    <p className="debugger-note">Click the editor gutter or press F9. This list also works with the plain-text editor. Source edits clear breakpoints; Reset preserves them.</p>
    {notice && <p role="status" className="debugger-note">{notice}</p>}
    {view.breakpoints.length ? <ul className="breakpoint-list">{view.breakpoints.map((breakpoint) => <li key={breakpoint.id} className={view.breakpointPause?.sourceLine === breakpoint.sourceLine ? "breakpoint-hit" : undefined} aria-current={view.breakpointPause?.sourceLine === breakpoint.sourceLine ? "location" : undefined}>
      <label><input type="checkbox" checked={breakpoint.enabled} onChange={(event) => actions.setBreakpointEnabled(breakpoint.id, event.target.checked)} aria-label={`Enable breakpoint at line ${breakpoint.sourceLine}`} />Line {breakpoint.sourceLine} · {breakpoint.address === undefined ? breakpoint.resolution : `word ${breakpoint.address}`}</label>
      {view.breakpointPause?.sourceLine === breakpoint.sourceLine && <strong className="breakpoint-hit-label">Hit</strong>}
      <button onClick={() => actions.navigateToBreakpoint(breakpoint.id)} aria-label={`Go to breakpoint line ${breakpoint.sourceLine}`}>Source</button><button onClick={() => actions.removeBreakpoint(breakpoint.id)} aria-label={`Remove breakpoint at line ${breakpoint.sourceLine}`}>Remove</button><span>{breakpoint.message}</span>
    </li>)}</ul> : <p className="debugger-note">No breakpoints configured.</p>}
    {view.breakpointPause && <p className="breakpoint-stop" role="status">Paused before word {view.breakpointPause.address}, source line {view.breakpointPause.sourceLine}{view.breakpointPause.modified ? " (word modified)" : ""}. Run resumes past this breakpoint once; Step attempts one instruction.</p>}
    <div className="debugger-heading"><strong>Execution trace</strong><div className="trace-navigation"><button type="button" disabled={!view.trace.length} onClick={downloadTrace} title="Download all retained attempts as JSON, regardless of filter">Download Trace</button><button disabled={!view.trace.length && !view.traceDiscarded} onClick={actions.clearTrace}>Clear trace</button></div></div>
    {downloadNotice && <p className="debugger-note" role="status">{downloadNotice}</p>}
    <p className="debugger-note">Last {TRACE_CAPACITY} attempted instructions · {view.trace.length} retained · {view.traceDiscarded} older entries discarded since clear. Inspection does not rewind the CPU.</p>
    <div className="trace-controls"><label htmlFor="trace-filter">Show</label><select id="trace-filter" value={filter} onChange={(event) => setFilter(event.target.value as TraceFilter)}>{TRACE_FILTERS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select><span>{visibleTrace.length} matching</span><TraceNavigation entries={visibleTrace} selectedStep={selectedStep} onSelect={selectTrace} /></div>
    {selectionHidden && <p className="debugger-note" role="status">Selected step {selectedStep} is hidden by this filter; its details remain below.</p>}
    {visibleTrace.length ? <TraceTable entries={visibleTrace} selectedStep={selectedStep} onSelect={selectTrace} /> : <p className="debugger-note">{view.trace.length ? "No attempts match this filter." : "No attempts recorded. Breakpoint stops do not create entries."}</p>}
    {entry ? <section ref={details} className="trace-detail" aria-label={`Trace step ${entry.step} details`}>
      <div className="debugger-heading"><strong>Step {entry.step} · word {entry.address}</strong><button disabled={!entry.source} onClick={() => actions.navigateToTrace(entry.step)}>Go to source</button></div>
      <p>{entry.word === undefined ? "No word fetched" : `Fetched ${hexWord(entry.word)} · ${entry.instruction}`}{entry.modified ? " · modified since assembly (*)" : ""}</p>
      <p>{entry.source ? `Source line ${entry.source.start.line}, column ${entry.source.start.column}` : "No reliable source mapping for these fetched bits."}</p>
      <table className="code-table"><thead><tr><th>REGISTER</th><th>BEFORE</th><th>AFTER</th></tr></thead><tbody>{(["A", "B", "PC", "SP"] as const).map((register) => <tr key={register} className={entry.before[register] !== entry.after[register] ? "value-changed" : ""}><th scope="row">{register}</th><td>{entry.before[register]}</td><td>{entry.after[register]}</td></tr>)}</tbody></table>
      <p>{entry.memoryWrite ? `Memory[${entry.memoryWrite.address}]: ${entry.memoryWrite.before} → ${entry.memoryWrite.after}` : "No committed memory write."}</p>
      <p>Result: {entry.status}{entry.diagnostic ? ` · ${entry.diagnostic.code}: ${entry.diagnostic.message}` : ""}</p>
    </section> : <p className="debugger-note">Select a retained trace step for register changes, stores and fault details.</p>}
  </div>;
}
