import { CircleDot, Hammer, Pause, Play, RotateCcw, StepForward } from "lucide-react";
import type { DebuggerState, ExecutionAction } from "@/types/ide";

export interface ExecutionToolbarProps {
  available: false;
  debuggerState: DebuggerState;
  onAction?: (action: ExecutionAction) => void;
}

const ACTIONS = [
  { id: "assemble", label: "Assemble", icon: Hammer },
  { id: "run", label: "Run", icon: Play },
  { id: "step", label: "Step", icon: StepForward },
  { id: "pause", label: "Pause", icon: Pause },
  { id: "reset", label: "Reset", icon: RotateCcw },
] as const;

export function ExecutionToolbar({ debuggerState }: ExecutionToolbarProps) {
  return (
    <div className="execution-toolbar" aria-label="Execution controls" role="group">
      <div className="execution-actions">
        {ACTIONS.map(({ id, label, icon: Icon }) => <button key={id} disabled className={`execution-button ${id === "assemble" ? "assemble-button" : ""}`} title={`${label} unavailable — execution engine is not implemented`}><Icon size={14} /><span>{label}</span></button>)}
      </div>
      <div className="debug-controls">
        <button disabled className="breakpoint-button" title="Breakpoints are not implemented" aria-label={`Breakpoints unavailable; ${debuggerState.breakpoints.length} configured`}><CircleDot size={14} /></button>
        <label className="speed-control">Speed <select disabled aria-label="Execution speed unavailable"><option>—</option></select></label>
        <span className="engine-badge">Engine not implemented</span>
      </div>
    </div>
  );
}
