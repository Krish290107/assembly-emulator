import { parseSource } from "../assembler/parser.ts";
import { isValidImageSize } from "../cpu/validation.ts";
import type { Breakpoint, MachineCode, SourceRange } from "../../types/engine.ts";
import type { CpuAttemptTrace } from "../../types/cpu.ts";

export interface SourceBreakpoint extends Breakpoint {
  resolution: "pending" | "resolved" | "non-executable";
  message: string;
  modified: boolean;
}
export interface SourceNavigation { line: number; column: number; request: number }
export interface BreakpointPause { sourceLine: number; address: number; modified: boolean }
export const TRACE_CAPACITY = 500;

const sameRange = (left: SourceRange, right: SourceRange) => left.start.line === right.start.line && left.start.column === right.start.column && left.end.line === right.end.line && left.end.column === right.end.column;

/** Exact instruction lines only; never slide a label/comment/data breakpoint forward. */
export function breakpointLocations(source: string, program: MachineCode): ReadonlyMap<number, number> {
  const parsed = parseSource(source);
  const statements = parsed.statements.filter(({ kind }) => kind !== "label");
  const locations = new Map<number, number>();
  if (!parsed.ok || program.origin !== 0 || !(program.bytes instanceof Uint8Array) || !isValidImageSize(program.bytes.length) || program.bytes.length !== statements.length * 4 || program.sourceMap.length !== statements.length) return locations;
  for (const [address, statement] of statements.entries()) {
    const mapping = program.sourceMap[address];
    if (!mapping?.source?.start || !mapping.source.end || mapping.offset !== address * 4 || mapping.length !== 4 || !sameRange(mapping.source, statement.source)) return new Map();
    if (statement.kind === "instruction") locations.set(statement.mnemonicSource.start.line, address);
  }
  return locations;
}

/** Constant-time retention; detached chronological snapshots are made only on publish. */
export function createTraceBuffer() {
  const slots: (CpuAttemptTrace | undefined)[] = new Array(TRACE_CAPACITY);
  let start = 0;
  let count = 0;
  let discarded = 0;
  return {
    add(entry: CpuAttemptTrace) {
      if (count < TRACE_CAPACITY) { slots[(start + count) % TRACE_CAPACITY] = entry; count++; }
      else { slots[start] = entry; start = (start + 1) % TRACE_CAPACITY; discarded++; }
    },
    snapshot: () => structuredClone(Array.from({ length: count }, (_, index) => slots[(start + index) % TRACE_CAPACITY]!)),
    find: (step: number) => slots.find((entry) => entry?.step === step),
    discarded: () => discarded,
    clear() { slots.fill(undefined); start = 0; count = 0; discarded = 0; },
  };
}

/** UTF-16 offset for fallback source navigation; line endings count as one break. */
export function sourceOffset(source: string, line: number, column: number): number | null {
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) return null;
  const lines = source.split(/\r\n|\r|\n/);
  if (line > lines.length) return null;
  const breaks = [...source.matchAll(/\r\n|\r|\n/g)];
  const start = line === 1 ? (source.startsWith("\uFEFF") ? 1 : 0) : breaks[line - 2].index! + breaks[line - 2][0].length;
  const end = line <= breaks.length ? breaks[line - 1].index! : source.length;
  return Math.min(end, start + column - 1);
}
