import type { CpuAttemptTrace } from "@/types/cpu";

interface TraceTableProps {
  entries: readonly CpuAttemptTrace[];
  selectedStep?: number;
  onSelect: (step: number) => void;
}

export function TraceTable({ entries, selectedStep, onSelect }: TraceTableProps) {
  return <div className="trace-table-wrap"><table className="code-table trace-table"><thead><tr><th>STEP</th><th>PC</th><th>INSTRUCTION</th><th>RESULT</th></tr></thead><tbody>{entries.map((attempt) => <tr key={attempt.step} className={`trace-entry${selectedStep === attempt.step ? " at-pc" : ""}`} onClick={() => onSelect(attempt.step)}>
    <td><button type="button" aria-label={`Inspect trace step ${attempt.step}`} aria-pressed={selectedStep === attempt.step} onClick={(event) => { event.stopPropagation(); onSelect(attempt.step); }}>{attempt.step}</button></td><td>{attempt.address}</td><td>{attempt.instruction}{attempt.modified ? " *" : ""}</td><td>{attempt.status === "paused" ? "executed" : attempt.status}</td>
  </tr>)}</tbody></table></div>;
}
