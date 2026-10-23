import { Cpu, LockKeyhole } from "lucide-react";
import type { CpuSnapshot } from "@/types/ide";

export function CpuPanel({ snapshot }: { snapshot?: CpuSnapshot }) {
  return (
    <section className="cpu-panel" aria-labelledby="cpu-heading">
      <div className="panel-heading"><h2 id="cpu-heading"><Cpu size={15} />CPU Registers</h2><span className="panel-meta">NO STATE</span></div>
      <div className="register-labels"><span>REGISTER</span><span>VALUE</span></div>
      <dl className="register-list">
        {(["A", "B", "PC", "SP"] as const).map((register) => <div key={register}><dt><span className="register-symbol">{register}</span><span>{{ A: "Register A", B: "Register B", PC: "Program counter", SP: "Stack pointer" }[register]}</span></dt><dd>{snapshot?.registers[register] ?? <span aria-label="No value">—</span>}</dd></div>)}
      </dl>
      <p className="panel-note"><LockKeyhole size={13} />Registers will appear when the CPU engine is available.</p>
    </section>
  );
}
