import type { AssemblyExample } from "@/types/ide";

export const EXAMPLES: readonly AssemblyExample[] = [
  {
    id: "first-program",
    title: "First program",
    filename: "first-program.asm",
    description: "A small source file to explore the editor.",
    code: "; Assembly Emulator\n; Your workspace for exploring assembly.\n;\n; PROVISIONAL EXAMPLE — syntax is not final.\n; The ISA and encoding will be specified in Days 3–5.\n; This source cannot be assembled or executed yet.\n\nstart:\n    MOV A, 5       ; Example operand syntax\n    MOV B, 3\n    ADD A, B\n    HLT\n",
  },
  {
    id: "labels-comments",
    title: "Labels & comments",
    filename: "labels-and-comments.asm",
    description: "Try labels, comments, and editor highlighting.",
    code: "; PROVISIONAL — illustrative syntax only.\n; No instruction behavior is defined yet.\n\nstart:\n    MOV A, 0x0A\n\nnext_label:\n    ; Write your notes here.\n    HLT\n",
  },
];

export const INITIAL_DOCUMENT = {
  code: EXAMPLES[0].code,
  filename: "program.asm",
};
