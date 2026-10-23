import { createCpu, decodeInstruction, getCpuSnapshot, loadProgram, writeRegister, type Cpu } from "../src/lib/cpu/index.ts";
import type { CpuResult } from "../src/types/cpu.ts";
import type { CpuState } from "../src/types/engine.ts";

const cpu: Cpu = createCpu();
const detachedState: CpuState = getCpuSnapshot(cpu);
const loaded: CpuResult<void> = loadProgram(cpu, { origin: 0, bytes: new Uint8Array(), sourceMap: [] });
// @ts-expect-error CPU handles cannot be constructed as ordinary state objects.
const forgedCpu: Cpu = {};
// @ts-expect-error Private memory is only available through detached snapshots or checked helpers.
const liveMemory = cpu.memory;
// @ts-expect-error Only the ISA's four registers can be written.
writeRegister(cpu, "X", 0);
const decoded = decodeInstruction(18);
if (!decoded.ok) {
  // @ts-expect-error Failure has no decoded value.
  void decoded.value;
}

void [detachedState, loaded, forgedCpu, liveMemory];
