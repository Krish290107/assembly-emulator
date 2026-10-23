import { CircleDot, Hammer, Pause, Play, RotateCcw, StepForward } from "lucide-react";
import type { ExecutionAction } from "@/types/ide";
import type { ExecutionSpeed, WorkspaceView } from "@/lib/workspace/controller";

export interface ExecutionToolbarProps {
  ready: boolean;
  view: WorkspaceView;
  onAction: (action: ExecutionAction) => void;
  onSpeedChange: (speed: ExecutionSpeed) => void;
  onDebugger: () => void;
}

const ACTIONS = [
  { id: "assemble", label: "Assemble", icon: Hammer },
  { id: "run", label: "Run", icon: Play },
  { id: "step", label: "Step", icon: StepForward },
  { id: "pause", label: "Pause", icon: Pause },
  { id: "reset", label: "Reset", icon: RotateCcw },
] as const;

export function ExecutionToolbar({ ready, view, onAction, onSpeedChange, onDebugger }: ExecutionToolbarProps) {
  const executable = !!view.cpu && ["ready", "paused"].includes(view.cpu.status) && !view.running;
  const enabled = { assemble: ready, run: ready && executable, step: ready && executable, pause: view.running, reset: ready && view.assembled };
  return (
    <div className="execution-toolbar" aria-label="Execution controls" role="group">
      <div className="execution-actions">
        {ACTIONS.map(({ id, label, icon: Icon }) => <button key={id} disabled={!enabled[id]} onClick={() => onAction(id)} className={`execution-button ${id === "assemble" ? "assemble-button" : ""}`} title={enabled[id] ? label : id === "run" || id === "step" ? "Assemble valid source, or reset a terminal program, before execution" : `${label} unavailable in the current state`}><Icon size={14} /><span>{label}</span></button>)}
      </div>
      <div className="debug-controls">
        <button className="breakpoint-button" title="Breakpoints and execution trace" aria-label={`Open debugger; ${view.breakpoints.length} breakpoints configured`} onClick={onDebugger}><CircleDot size={14} /></button>
        <label className="speed-control">Speed <select value={view.speed} onChange={(event) => onSpeedChange(event.target.value as ExecutionSpeed)} aria-label="Execution speed"><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
        <span className="engine-badge">{view.status}</span>
      </div>
    </div>
  );
}
