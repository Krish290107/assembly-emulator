import type { CpuAttemptTrace } from "@/types/cpu";

interface TraceTableProps {
  entries: readonly CpuAttemptTrace[];
  selectedStep?: number;
  onSelect: (step: number) => void;
}

export function TraceTable({ entries, selectedStep, onSelect }: TraceTableProps) {
  return <div className="trace-table-wrap"><table className="code-table trace-table"><thead><tr><th>STEP</th><th>PC</th><th>INSTRUCTION</th><th>RESULT</th></tr></thead><tbody>{entries.map((attempt) => <tr key={attempt.step} className={`trace-entry${selectedStep === attempt.step ? " at-pc" : ""}`} onClick={() => onSelect(attempt.step)}>
    <td><button type="button" aria-label={`Inspect trace step ${attempt.step}`} aria-pressed={selectedStep === attempt.step} onClick={(event) => { event.stopPropagation(); onSelect(attempt.step); }}>{attempt.step}</button></td><td>{attempt.address}</td><td>{attempt.instruction}{attempt.modified ? " *" : ""}</td><td className={attempt.status === "error" || attempt.status === "limit-reached" ? "trace-result-error" : attempt.status === "halted" ? "trace-result-terminal" : undefined}>{attempt.status === "paused" ? "executed" : attempt.status}</td>
  </tr>)}</tbody></table></div>;
}

/** Navigate the visible attempts using their cumulative IDs, including filtered gaps. */
export function TraceNavigation({ entries, selectedStep, onSelect }: TraceTableProps) {
  const previous = selectedStep === undefined ? undefined : entries.findLast((entry) => entry.step < selectedStep);
  const next = entries.find((entry) => selectedStep === undefined || entry.step > selectedStep);
  return <div className="trace-navigation" aria-label="Trace entry navigation">
    <button type="button" disabled={!previous} onClick={() => { if (previous) onSelect(previous.step); }} aria-label="Inspect previous matching trace entry">Previous</button>
    <button type="button" disabled={!next} onClick={() => { if (next) onSelect(next.step); }} aria-label="Inspect next matching trace entry">Next</button>
  </div>;
}
