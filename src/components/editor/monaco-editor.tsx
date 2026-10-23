"use client";

import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/editor/browser/coreCommands";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/editor/contrib/comment/browser/comment";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/editor/contrib/find/browser/findController";
import "monaco-editor/editor/contrib/folding/browser/folding";
import "monaco-editor/editor/contrib/indentation/browser/indentation";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations";
import "monaco-editor/editor/contrib/multicursor/browser/multicursor";
import "monaco-editor/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode";
import "monaco-editor/editor/contrib/tokenization/browser/tokenization";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations";
import { useEffect, useState } from "react";
import { configureAssembly, LANGUAGE_ID } from "@/lib/editor/language";
import { EditorFallback } from "./editor-fallback";

// Bundle from source so npm's patched sanitizer is used, rather than the
// sanitizer embedded in Monaco's prebuilt AMD distribution.
self.MonacoEnvironment = {
  getWorker: () => new Worker("/monaco/editor.worker.js", { name: "assembly-editor" }),
};
loader.config({ monaco });

export interface AssemblyEditorProps {
  code: string;
  onChange: (code: string) => void;
  onPositionChange: (line: number, column: number) => void;
}

export default function AssemblyEditor({ code, onChange, onPositionChange }: AssemblyEditorProps) {
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const timer = window.setTimeout(() => setFailed(true), 15000);
    return () => window.clearTimeout(timer);
  }, [mounted]);

  if (failed) return <EditorFallback code={code} onChange={onChange} onPositionChange={onPositionChange} />;

  return (
    <Editor
      height="100%"
      language={LANGUAGE_ID}
      theme="assembly-dark"
      value={code}
      beforeMount={configureAssembly}
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor: monaco.editor.IStandaloneCodeEditor) => {
        setMounted(true);
        const position = editor.getPosition();
        if (position) onPositionChange(position.lineNumber, position.column);
        const subscription = editor.onDidChangeCursorPosition(({ position }) => onPositionChange(position.lineNumber, position.column));
        editor.onDidDispose(() => subscription.dispose());
      }}
      loading={<div className="editor-loading" role="status">Loading source editor…</div>}
      options={{
        ariaLabel: "Assembly source",
        automaticLayout: true,
        fontFamily: "Consolas, 'Cascadia Code', 'Liberation Mono', monospace",
        fontSize: 13,
        lineHeight: 23,
        lineNumbers: "on",
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        padding: { top: 20, bottom: 20 },
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        renderLineHighlight: "line",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        glyphMargin: false,
        folding: true,
        wordWrap: "off",
        scrollbar: { horizontalScrollbarSize: 10, verticalScrollbarSize: 10 },
        contextmenu: true,
        stickyScroll: { enabled: false },
        quickSuggestions: false,
      }}
    />
  );
}
