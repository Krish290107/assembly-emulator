import type { AssemblyExample } from "@/types/ide";

export const EXAMPLES: readonly AssemblyExample[] = [
  {
    id: "first-program",
    title: "First program",
    filename: "first-program.asm",
    description: "Load two constants and add them. Assemble, then Run or Step.",
    code: "; Assembly Emulator — ISA v1\n; Assemble, then Run or Step to inspect the result.\n\nstart:\n    ldc 5\n    ldc 3\n    add\n    HALT\n",
  },
  {
    id: "countdown",
    title: "Countdown & labels",
    filename: "countdown.asm",
    description: "A loop with a forward branch and case-sensitive labels.",
    code: "; ISA v1 — a countdown with forward and backward branches.\n    ldc 3\nloop: brz done\n    adc -1\n    br loop\ndone: HALT\n",
  },
  {
    id: "memory-data",
    title: "Memory & data",
    filename: "memory-and-data.asm",
    description: "A symbolic word address and a full 32-bit data constant.",
    code: "; data is a directive, not a CPU opcode.\n    ldc value\n    ldnl 0\n    HALT\nvalue: data -0x80000000\n",
  },
];

export const INITIAL_DOCUMENT = {
  code: EXAMPLES[0].code,
  filename: "program.asm",
};
