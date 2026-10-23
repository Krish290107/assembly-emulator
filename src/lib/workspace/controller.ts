import { assembleSource } from "../assembler/index.ts";
import { getInstruction, MEMORY_WORDS } from "../assembler/isa.ts";
import { createCpu, decodeInstruction, getCpuOverview, isMemoryAddress, loadProgram, readMemory, resetCpu, stepCpuTraced, type Cpu } from "../cpu/index.ts";
import type { CpuAttemptTrace, CpuOverview } from "../../types/cpu.ts";
import type { Diagnostic, ExecutionStatus, MachineCode, RegisterName, SourceRange } from "../../types/engine.ts";
import { breakpointLocations, createTraceBuffer, type BreakpointPause, type SourceBreakpoint, type SourceNavigation } from "./debugger.ts";

export const MEMORY_WINDOW = 32;
export const DISASSEMBLY_WINDOW = 64;
export const SPEEDS = { slow: { batch: 1, delay: 200 }, normal: { batch: 64, delay: 32 }, fast: { batch: 512, delay: 16 } } as const;
export type ExecutionSpeed = keyof typeof SPEEDS;
export interface Scheduler { schedule: (callback: () => void, delay: number) => unknown; cancel: (handle: unknown) => void }
export interface MemoryRow { address: number; value: number; hex: string; changed: boolean }
export interface CodeRow { address: number; hex: string; instruction: string; line?: number; source: string; modified: boolean }
export interface WorkspaceView {
  status: ExecutionStatus | "unassembled" | "breakpoint-paused";
  running: boolean;
  assembled: boolean;
  wordCount: number;
  symbolCount: number;
  cpu: CpuOverview | null;
  changedRegisters: readonly RegisterName[];
  diagnostics: readonly Diagnostic[];
  logs: readonly string[];
  memoryStart: number;
  memory: readonly MemoryRow[];
  disassemblyStart: number;
  disassembly: readonly CodeRow[];
  currentSource?: SourceRange;
  speed: ExecutionSpeed;
  breakpoints: readonly SourceBreakpoint[];
  breakpointPause?: BreakpointPause;
  trace: readonly CpuAttemptTrace[];
  traceDiscarded: number;
  selectedTrace?: CpuAttemptTrace;
  navigation?: SourceNavigation;
}

export const INITIAL_VIEW: WorkspaceView = {
  status: "unassembled", running: false, assembled: false, wordCount: 0, symbolCount: 0,
  cpu: null, changedRegisters: [], diagnostics: [], logs: ["Assemble source to prepare a CPU. Nothing has executed."],
  memoryStart: 0, memory: [], disassemblyStart: 0, disassembly: [], speed: "normal",
  breakpoints: [], trace: [], traceDiscarded: 0,
};

export const hexWord = (word: number) => (word >>> 0).toString(16).toUpperCase().padStart(8, "0");
export function parseAddress(text: string): number | null {
  if (!/^(?:\d+|0x[0-9a-f]+)$/i.test(text.trim())) return null;
  const address = Number(text.trim());
  return isMemoryAddress(address) ? address : null;
}

/** Pure engine/controller integration. Only the injected scheduler touches the browser. */
export function createWorkspaceController(scheduler: Scheduler) {
  let source = "";
  let cpu: Cpu | null = null;
  let program: MachineCode | null = null;
  let sourceLines: string[] = [];
  let symbolCount = 0;
  let locations: ReadonlyMap<number, number> = new Map();
  let breakpoints: SourceBreakpoint[] = [];
  let enabledAddresses = new Set<number>();
  let breakpointPause: BreakpointPause | undefined;
  let skipOnce: number | undefined;
  const history = createTraceBuffer();
  let selectedStep: number | undefined;
  let navigation: SourceNavigation | undefined;
  let navigationRequest = 0;
  let running = false;
  let generation = 0;
  let pending: unknown;
  let scheduled = false;
  let memoryStart = 0;
  let disassemblyStart = 0;
  let speed: ExecutionSpeed = "normal";
  let assemblyDiagnostics: readonly Diagnostic[] = [];
  let logs = [...INITIAL_VIEW.logs];
  let view: WorkspaceView = { ...INITIAL_VIEW, logs: [...INITIAL_VIEW.logs] };
  const listeners = new Set<() => void>();
  const log = (message: string) => { logs = [...logs, message].slice(-20); };
  const wordCount = () => (program?.bytes.length ?? 0) / 4;
  const originalWord = (address: number) => program && address < wordCount() ? new DataView(program.bytes.buffer, program.bytes.byteOffset, program.bytes.byteLength).getInt32(address * 4, true) : undefined;
  const read = (address: number) => {
    const result = readMemory(cpu!, address);
    if (!result.ok) throw new Error(result.diagnostic.message);
    return result.value;
  };
  const mappedSource = (address: number) => {
    const entry = program?.sourceMap[address];
    return entry?.offset === address * 4 && entry.length === 4 ? entry.source : undefined;
  };

  function resolveBreakpoints() {
    breakpoints = breakpoints.map((breakpoint) => {
      const address = program ? locations.get(breakpoint.sourceLine) : undefined;
      const resolution = !program ? "pending" : address === undefined ? "non-executable" : "resolved";
      return { ...breakpoint, address, resolution, modified: false, message: resolution === "pending" ? "Assemble to resolve this line." : resolution === "non-executable" ? "No CPU instruction on this line (labels, comments, blank lines and data do not bind)." : `Word ${address}. Stops before execution.` };
    });
    enabledAddresses = new Set(breakpoints.filter(({ enabled, address }) => enabled && address !== undefined).map(({ address }) => address!));
  }
  function clearHistory() { history.clear(); selectedStep = undefined; navigation = undefined; breakpointPause = undefined; skipOnce = undefined; }
  function navigate(line: number, column: number) {
    if (line < 1 || line > source.split(/\r\n|\r|\n/).length) return;
    navigation = { line, column, request: ++navigationRequest };
    publish();
  }
  function attempt() {
    const result = stepCpuTraced(cpu!);
    if (result.entry) { history.add(result.entry); breakpointPause = undefined; }
    return result;
  }

  function publish(notify = true) {
    const overview = cpu ? getCpuOverview(cpu) : null;
    const oldMemory = new Map(view.memory.map((row) => [row.address, row.value]));
    const memory: MemoryRow[] = cpu ? Array.from({ length: Math.min(MEMORY_WINDOW, MEMORY_WORDS - memoryStart) }, (_, offset) => {
      const address = memoryStart + offset;
      const value = read(address);
      return { address, value, hex: hexWord(value), changed: oldMemory.has(address) && oldMemory.get(address) !== value };
    }) : [];
    const disassembly: CodeRow[] = cpu && program ? Array.from({ length: Math.min(DISASSEMBLY_WINDOW, wordCount() - disassemblyStart) }, (_, offset) => {
      const address = disassemblyStart + offset;
      const value = read(address);
      const decoded = decodeInstruction(value);
      const location = mappedSource(address);
      return {
        address, hex: hexWord(value), modified: value !== originalWord(address),
        instruction: decoded.ok ? `${decoded.value.mnemonic}${getInstruction(decoded.value.mnemonic)!.operandMode === "none" ? "" : ` ${decoded.value.operand}`}` : "Invalid instruction bits",
        line: location?.start.line, source: location ? sourceLines[location.start.line - 1] ?? "" : "",
      };
    }) : [];
    const diagnostics: Diagnostic[] = [...assemblyDiagnostics, ...(overview?.diagnostics ?? [])];
    if (overview?.status === "limit-reached") diagnostics.push({ severity: "error", code: "UI_EXECUTION_LIMIT", message: `Execution limit reached after ${overview.attemptedInstructions} attempts. Reset or reassemble before running again.` });
    const pc = overview?.registers.PC;
    const currentSource = pc !== undefined && cpu && read(pc) === originalWord(pc) ? mappedSource(pc) : undefined;
    const trace = history.snapshot();
    view = {
      status: running ? "running" : breakpointPause ? "breakpoint-paused" : overview?.status ?? "unassembled", running, assembled: program !== null,
      wordCount: wordCount(), symbolCount, cpu: overview, memoryStart, memory, disassemblyStart, disassembly, speed,
      changedRegisters: overview && view.cpu ? (["A", "B", "PC", "SP"] as const).filter((name) => overview.registers[name] !== view.cpu!.registers[name]) : [],
      diagnostics: structuredClone(diagnostics), logs: [...logs], currentSource: currentSource ? structuredClone(currentSource) : undefined,
      breakpoints: breakpoints.map((breakpoint) => {
        const modified = cpu && breakpoint.address !== undefined ? read(breakpoint.address) !== originalWord(breakpoint.address) : false;
        return { ...breakpoint, modified, message: modified ? "Word modified; breakpoint remains at its original word address." : breakpoint.message };
      }),
      breakpointPause: running ? undefined : breakpointPause ? { ...breakpointPause } : undefined,
      trace, traceDiscarded: history.discarded(), selectedTrace: trace.find(({ step }) => step === selectedStep), navigation: navigation ? { ...navigation } : undefined,
    };
    if (notify) listeners.forEach((listener) => listener());
  }

  function cancel() {
    generation++;
    if (scheduled) scheduler.cancel(pending);
    pending = undefined;
    scheduled = false;
    running = false;
  }
  function finishLog() {
    const state = getCpuOverview(cpu!);
    log(`${state.status === "halted" ? "Halted" : state.status === "error" ? "Runtime error" : "Execution limit reached"} after ${state.attemptedInstructions} attempts.`);
  }
  function scheduleBatch() {
    if (!running || !cpu) return;
    const token = generation;
    const sessionCpu = cpu;
    scheduled = true;
    pending = scheduler.schedule(() => {
      if (token !== generation || !running || !sessionCpu || sessionCpu !== cpu) return;
      scheduled = false;
      pending = undefined;
      let pc = getCpuOverview(sessionCpu).registers.PC;
      for (let index = 0; index < SPEEDS[speed].batch && running; index++) {
        if (enabledAddresses.has(pc) && skipOnce !== pc) {
          const breakpoint = breakpoints.find(({ enabled, address }) => enabled && address === pc)!;
          breakpointPause = { sourceLine: breakpoint.sourceLine, address: pc, modified: read(pc) !== originalWord(pc) };
          cancel();
          log(`Breakpoint at line ${breakpoint.sourceLine}, word ${pc}. Paused before execution.`);
          break;
        }
        skipOnce = undefined;
        const result = attempt();
        if (result.execution.status !== "paused") { cancel(); finishLog(); break; }
        pc = result.entry!.after.PC;
      }
      publish();
      if (running && token === generation) scheduleBatch();
    }, SPEEDS[speed].delay);
  }
  function canExecute() {
    return cpu && !running && ["ready", "paused"].includes(getCpuOverview(cpu).status);
  }

  return {
    getSnapshot: () => view,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setSource(next: string, replace = false) {
      if (source === next && !replace) return;
      source = next;
      cancel();
      const hadResults = !!cpu || assemblyDiagnostics.length > 0;
      cpu = null; program = null; sourceLines = []; symbolCount = 0; assemblyDiagnostics = [];
      locations = new Map(); breakpoints = []; enabledAddresses.clear(); clearHistory();
      if (hadResults) log("Source changed. Reassemble before execution; previous machine state cleared.");
      publish();
    },
    assemble(code = source) {
      if (code !== source) breakpoints = [];
      source = code;
      cancel();
      cpu = null; program = null; symbolCount = 0; assemblyDiagnostics = [];
      locations = new Map(); clearHistory();
      memoryStart = 0; disassemblyStart = 0;
      const assembled = assembleSource(source);
      if (assembled.status === "failure") {
        assemblyDiagnostics = assembled.diagnostics;
        log(`Assembly failed with ${assembled.diagnostics.filter(({ severity }) => severity === "error").length} errors. Nothing executed.`);
      } else {
        const candidate = createCpu();
        const loaded = loadProgram(candidate, assembled.program);
        if (!loaded.ok) { assemblyDiagnostics = [loaded.diagnostic]; log("Program could not be loaded. Nothing executed."); }
        else {
          cpu = candidate; program = assembled.program; symbolCount = assembled.symbols.size;
          locations = breakpointLocations(source, program);
          sourceLines = source.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
          assemblyDiagnostics = assembled.diagnostics;
          log(`Assembled ${wordCount()} words (${program.bytes.length} bytes), ${symbolCount} symbols. ${wordCount() ? "CPU ready" : "Empty image; not runnable"}. Nothing executed.`);
        }
      }
      // A new image has no prior register/cell values to compare.
      resolveBreakpoints();
      view = { ...view, cpu: null, memory: [] };
      publish();
    },
    run() {
      if (!canExecute()) return;
      skipOnce = breakpointPause?.address === getCpuOverview(cpu!).registers.PC ? breakpointPause.address : undefined;
      running = true;
      generation++;
      log(`Execution started at word ${getCpuOverview(cpu!).registers.PC}.`);
      publish();
      scheduleBatch();
    },
    step() {
      if (!canExecute()) return;
      skipOnce = undefined;
      const { execution: result } = attempt();
      if (result.status !== "paused") finishLog();
      else log(`Stepped. Paused after ${result.attemptedInstructions} attempts.`);
      publish();
    },
    pause() {
      if (!running) return;
      cancel();
      log(`Paused after ${getCpuOverview(cpu!).attemptedInstructions} attempts.`);
      publish();
    },
    reset() {
      if (!cpu || !program) return;
      cancel(); resetCpu(cpu); clearHistory(); resolveBreakpoints(); log("Reset loaded image and registers. Attempts: 0."); publish();
    },
    setSpeed(next: ExecutionSpeed) {
      if (!Object.hasOwn(SPEEDS, next) || speed === next) return;
      const resume = running;
      cancel(); speed = next;
      if (resume) { running = true; scheduleBatch(); }
      publish();
    },
    setMemoryStart(address: number) { if (isMemoryAddress(address)) { memoryStart = address; publish(); } },
    setDisassemblyStart(address: number) { if (Number.isInteger(address) && address >= 0 && address < wordCount()) { disassemblyStart = address; publish(); } },
    toggleBreakpoint(line: number) {
      if (!Number.isInteger(line) || line < 1 || line > source.split(/\r\n|\r|\n/).length) return false;
      const existing = breakpoints.find(({ sourceLine }) => sourceLine === line);
      if (existing) breakpoints = breakpoints.filter(({ id }) => id !== existing.id);
      else breakpoints.push({ id: `line-${line}`, sourceLine: line, enabled: true, resolution: "pending", message: "Assemble to resolve this line.", modified: false });
      resolveBreakpoints(); publish(); return true;
    },
    setBreakpointEnabled(id: string, enabled: boolean) { breakpoints = breakpoints.map((breakpoint) => breakpoint.id === id ? { ...breakpoint, enabled } : breakpoint); resolveBreakpoints(); publish(); },
    removeBreakpoint(id: string) { breakpoints = breakpoints.filter((breakpoint) => breakpoint.id !== id); resolveBreakpoints(); publish(); },
    clearBreakpoints() { breakpoints = []; enabledAddresses.clear(); publish(); },
    clearTrace() { history.clear(); selectedStep = undefined; navigation = undefined; publish(); },
    selectTrace(step: number) { if (!history.find(step)) return; selectedStep = step; publish(); },
    navigateToTrace(step: number) { const entry = history.find(step); if (entry?.source) navigate(entry.source.start.line, entry.source.start.column); },
    navigateToBreakpoint(id: string) { const breakpoint = breakpoints.find((entry) => entry.id === id); if (breakpoint) navigate(breakpoint.sourceLine, 1); },
    dispose() { cancel(); listeners.clear(); publish(false); },
  };
}
export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
