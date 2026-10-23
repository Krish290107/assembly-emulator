type Monaco = typeof import("monaco-editor");
import { INSTRUCTIONS } from "../assembler/isa.ts";

export const LANGUAGE_ID = "assembly-isa-v1";
export const MNEMONIC_PATTERN = new RegExp(`\\b(${INSTRUCTIONS.map(({ mnemonic }) => mnemonic).join("|")})\\b`, "i");
export const LABEL_PATTERN = /[A-Za-z_][A-Za-z0-9_]*(?=\s*:)/;
export const NUMBER_PATTERN = /[+-]?(?:0[xX][\da-fA-F]+|\d+)\b/;

export function configureAssembly(monaco: Monaco) {
  if (!monaco.languages.getLanguages().some(({ id }) => id === LANGUAGE_ID)) {
    monaco.languages.register({ id: LANGUAGE_ID });
    monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
      ignoreCase: true,
      tokenizer: {
        root: [
          [/;.*/, "comment"],
          [LABEL_PATTERN, "type.identifier"],
          [MNEMONIC_PATTERN, "keyword"],
          [/\bdata\b/, "keyword.directive"],
          [NUMBER_PATTERN, "number"],
          [/[A-Za-z_][A-Za-z0-9_]*/, "identifier"],
          [/:/, "delimiter"],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
      comments: { lineComment: ";" },
    });
  }
  monaco.editor.defineTheme("assembly-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "738296" },
      { token: "keyword", foreground: "8EB7FA" },
      { token: "keyword.directive", foreground: "D6B6F2" },
      { token: "number", foreground: "D5BA86" },
      { token: "type.identifier", foreground: "88C8C0" },
    ],
    colors: {
      "editor.background": "#10151e",
      "editor.foreground": "#c9d3e1",
      "editorLineNumber.foreground": "#4f5d72",
      "editorLineNumber.activeForeground": "#a6b6ca",
      "editor.lineHighlightBackground": "#161e2b",
      "editor.selectionBackground": "#294263",
      "editorCursor.foreground": "#8eb7fa",
      "editorIndentGuide.background1": "#202b3b",
      "editorWidget.background": "#182231",
    },
  });
}
