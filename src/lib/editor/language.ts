type Monaco = typeof import("monaco-editor");

export const LANGUAGE_ID = "assembly-draft";

export function configureAssembly(monaco: Monaco) {
  if (!monaco.languages.getLanguages().some(({ id }) => id === LANGUAGE_ID)) {
    monaco.languages.register({ id: LANGUAGE_ID });
    monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
      ignoreCase: true,
      tokenizer: {
        root: [
          [/;.*/, "comment"],
          [/[a-z_]\w*(?=\s*:)/, "type.identifier"],
          [/\b(MOV|ADD|SUB|INC|DEC|CMP|JMP|JZ|JNZ|PUSH|POP|CALL|RET|NOP|HLT|LOAD|STORE)\b/, "keyword"],
          [/\b(A|B|PC|SP)\b/, "variable.predefined"],
          [/\b0x[\da-f]+\b|\b0b[01]+\b|\b\d+\b/, "number"],
          [/"[^"\n]*"|'[^'\n]*'/, "string"],
          [/[,:\[\]]/, "delimiter"],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
      comments: { lineComment: ";" },
      brackets: [["[", "]"], ["(", ")"]],
      autoClosingPairs: [{ open: "[", close: "]" }, { open: "(", close: ")" }, { open: '"', close: '"' }],
    });
  }
  monaco.editor.defineTheme("assembly-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "738296" },
      { token: "keyword", foreground: "8EB7FA" },
      { token: "variable.predefined", foreground: "D6B6F2" },
      { token: "number", foreground: "D5BA86" },
      { token: "type.identifier", foreground: "88C8C0" },
      { token: "string", foreground: "ABC99A" },
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
