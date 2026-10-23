import { Cpu } from "lucide-react";
import type { WorkspaceView } from "@/lib/workspace/controller";

export function CpuPanel({ view }: { view: WorkspaceView }) {
  return (
    <section className="cpu-panel" aria-labelledby="cpu-heading">
      <div className="panel-heading"><h2 id="cpu-heading"><Cpu size={15} />CPU Registers</h2><span className="panel-meta">{view.cpu ? view.status.toUpperCase() : "IDLE · NO IMAGE"}</span></div>
      <div className="register-labels"><span>REGISTER</span><span>VALUE</span></div>
      <dl className="register-list">
        {(["A", "B", "PC", "SP"] as const).map((register) => <div key={register} className={view.changedRegisters.includes(register) ? "value-changed" : ""}><dt><span className="register-symbol">{register}</span><span>{{ A: "Register A", B: "Register B", PC: "Program counter", SP: "Stack pointer" }[register]}</span></dt><dd>{view.cpu?.registers[register] ?? <span aria-label="No value">—</span>}</dd></div>)}
      </dl>
      <p className="panel-note" role="status">{view.cpu ? `${view.status} · ${view.cpu.attemptedInstructions.toLocaleString("en-US")} / ${view.cpu.limits.maxInstructions.toLocaleString("en-US")} attempts` : "Idle. Assemble source to load real machine state."}</p>
    </section>
  );
}
