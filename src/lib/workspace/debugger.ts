import { parseSource } from "../assembler/parser.ts";
import { isValidImageSize } from "../cpu/validation.ts";
import type { Breakpoint, Diagnostic, MachineCode, SourceRange } from "../../types/engine.ts";
import type { CpuAttemptTrace, CpuOverview, RuntimeDiagnostic } from "../../types/cpu.ts";
import { decodeInstruction } from "../cpu/decoder.ts";
import { getInstruction } from "../assembler/isa.ts";

export interface SourceBreakpoint extends Breakpoint {
  resolution: "pending" | "resolved" | "non-executable";
  message: string;
  modified: boolean;
}
export interface SourceNavigation { line: number; column: number; request: number }
export interface BreakpointPause { sourceLine: number; address: number; modified: boolean }
export const TRACE_CAPACITY = 500;
export const TRACE_FILTERS = [
  { value: "all", label: "All attempts" },
  { value: "writes", label: "Memory writes" },
  { value: "control", label: "Branch / control flow" },
  { value: "terminal", label: "Faults / terminal events" },
] as const;
export type TraceFilter = (typeof TRACE_FILTERS)[number]["value"];

/** Export all retained records, independent of presentation filters. No CPU access. */
export function traceDownload(input: { trace: readonly CpuAttemptTrace[]; traceDiscarded: number; cpu: CpuOverview | null }): { filename: string; blob: Blob } {
  const payload = {
    format: "assembly-emulator-trace", version: 1,
    attemptedInstructions: input.cpu?.attemptedInstructions ?? 0,
    retention: {
      capacity: TRACE_CAPACITY, retained: input.trace.length, discardedSinceClear: input.traceDiscarded,
      limitation: "Only retained recorded attempts are exported (last 500). Discarded or cleared history is unavailable; filters do not limit this export.",
    },
    entries: input.trace.map((entry) => ({
      attempt: entry.step, pc: entry.address, word: entry.word ?? null,
      instruction: entry.decoded ? { mnemonic: entry.decoded.mnemonic, opcode: entry.decoded.opcode, operand: entry.decoded.operand } : null,
      instructionText: entry.instruction, before: entry.before, after: entry.after,
      memoryWrite: entry.memoryWrite ?? null, result: entry.status, error: entry.diagnostic ?? null,
      source: entry.source ?? null, modified: entry.modified,
    })),
  };
  return { filename: "assembly-emulator-trace.json", blob: new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json;charset=utf-8" }) };
}

/** Explain existing structured errors without changing codes, spans or CPU semantics. */
export function runtimeDiagnosticContext(diagnostic: Diagnostic, cpu?: CpuOverview | null): string {
  if (diagnostic.code === "UI_EXECUTION_LIMIT") return cpu ? `Stopped PC ${cpu.registers.PC} · ${cpu.attemptedInstructions} attempted instructions.` : "";
  if (!/^C\d{3}_/.test(diagnostic.code)) return "";
  const { address, word, target } = diagnostic as Partial<RuntimeDiagnostic>;
  const parts: string[] = [];
  if (address !== undefined) parts.push(`PC ${address}`);
  if (word !== undefined) {
    const decoded = decodeInstruction(word);
    if (decoded.ok) {
      const { mnemonic, operand } = decoded.value;
      parts.push(`${mnemonic}${getInstruction(mnemonic)!.operandMode === "none" ? "" : ` ${operand}`}`);
    }
    if (Number.isInteger(word) && word >= -2147483648 && word <= 0xffffffff) {
      parts.push(`word ${(word >>> 0).toString(16).toUpperCase().padStart(8, "0")}`);
      if (!decoded.ok) parts.push(`opcode ${word & 0xff}, operand bits ${word >> 8}`);
    } else parts.push(`word ${word}`);
  }
  if (target !== undefined) {
    const label = { C005_INVALID_ADDRESS: "Memory address", C012_INVALID_SP: "SP", C013_INVALID_SHIFT: "Shift count", C014_INVALID_TARGET: "Target PC" }[diagnostic.code];
    parts.push(`${label ?? "Target"} ${target}`);
  }
  return parts.join(" · ");
}

/** Presentation only: classify actual decoded instructions and committed results. */
export function filterTrace(entries: readonly CpuAttemptTrace[], filter: TraceFilter): readonly CpuAttemptTrace[] {
  switch (filter) {
    case "writes": return entries.filter((entry) => entry.memoryWrite !== undefined);
    case "control": return entries.filter((entry) => entry.decoded !== undefined && entry.decoded.opcode >= 13 && entry.decoded.opcode <= 18);
    case "terminal": return entries.filter((entry) => ["error", "halted", "limit-reached"].includes(entry.status));
    default: return entries;
  }
}

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
