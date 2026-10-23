import { Database, Grid2X2 } from "lucide-react";
import type { CpuSnapshot } from "@/types/ide";

export function MemoryPanel({ memory }: { memory?: CpuSnapshot["memory"] }) {
  return (
    <section className="memory-panel" aria-labelledby="memory-heading">
      <div className="panel-heading"><h2 id="memory-heading"><Database size={15} />Memory</h2><span className="panel-meta">INSPECTOR</span></div>
      <div className="memory-toolbar"><span>Address space</span><select disabled aria-label="Memory display format unavailable"><option>Hexadecimal</option></select></div>
      <div className="memory-columns" aria-hidden="true"><span>ADDRESS</span><span>+0</span><span>+1</span><span>+2</span><span>+3</span></div>
      <div className="empty-state memory-empty"><Grid2X2 size={27} strokeWidth={1.3} /><h3>{memory ? "Memory inspection unavailable" : "No memory loaded"}</h3><p>The memory inspector will be available<br />with the execution engine.</p></div>
      <div className="memory-footer">Memory size and addressing are not yet specified.</div>
    </section>
  );
}
