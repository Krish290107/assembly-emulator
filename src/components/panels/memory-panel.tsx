"use client";

import { useState } from "react";
import { Database, Grid2X2 } from "lucide-react";
import { MEMORY_WINDOW, parseAddress, type WorkspaceView } from "@/lib/workspace/controller";

export function MemoryPanel({ view, onAddress }: { view: WorkspaceView; onAddress: (address: number) => void }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  return <section className="memory-panel" aria-labelledby="memory-heading">
    <div className="panel-heading"><h2 id="memory-heading"><Database size={15} />Memory</h2></div>
    <form className="memory-jump" onSubmit={(event) => {
      event.preventDefault(); const next = parseAddress(address);
      if (next === null) { setError("Use a word address from 0 to 65535 (decimal or 0x hex)."); return; }
      setError(""); onAddress(next);
    }}><label htmlFor="memory-address">Address</label><input id="memory-address" value={address} placeholder="0 or 0xFF" onChange={(event) => setAddress(event.target.value)} disabled={!view.cpu} aria-describedby={error ? "memory-address-error" : undefined} aria-invalid={!!error} /><button disabled={!view.cpu}>Go</button></form>
    {error && <p className="inline-error" id="memory-address-error" role="alert">{error}</p>}
    <div className="memory-navigation"><button disabled={!view.cpu || view.memoryStart === 0} onClick={() => onAddress(Math.max(0, view.memoryStart - MEMORY_WINDOW))}>Previous</button><button disabled={!view.cpu} onClick={() => onAddress(0)}>Program</button><button disabled={!view.cpu} onClick={() => onAddress(view.cpu!.registers.PC)}>PC</button><button disabled={!view.cpu} onClick={() => onAddress(Math.min(view.cpu!.registers.SP, 65536 - MEMORY_WINDOW))}>SP</button><button disabled={!view.cpu || view.memoryStart + MEMORY_WINDOW >= 65536} onClick={() => onAddress(Math.min(65535, view.memoryStart + MEMORY_WINDOW))}>Next</button></div>
    {view.cpu ? <div className="memory-table-wrap"><table className="memory-table"><thead><tr><th>ADDRESS</th><th>SIGNED</th><th>HEX</th></tr></thead><tbody>{view.memory.map((row) => <tr key={row.address} className={`${row.changed ? "value-changed" : ""} ${row.address === view.cpu?.registers.PC ? "at-pc" : ""}`}><th scope="row">{row.address}</th><td>{row.changed && <span className="memory-changed-marker" title="Changed since the previous refresh" aria-label="Changed">● </span>}{row.value}</td><td>{row.hex}</td></tr>)}</tbody></table></div> : <div className="empty-state memory-empty"><Grid2X2 size={27} strokeWidth={1.3} /><h3>No memory loaded</h3><p>Assemble a program to inspect memory.</p></div>}
    <div className="memory-footer">65,536 signed words · Up to 32 cells shown</div>
  </section>;
}
