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

  useEffect(() => {
    const timer = window.setTimeout(() => setFailed(true), 15000);
    let active = true;
    loader.init().then(() => window.clearTimeout(timer)).catch(() => { if (active) setFailed(true); });
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  if (failed) return (
    <div className="editor-fallback">
      <p role="status">Monaco could not load. You can keep editing in this plain-text editor.</p>
      <textarea aria-label="Assembly source" value={code} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
    </div>
  );

  return (
    <Editor
      height="100%"
      language={LANGUAGE_ID}
      theme="assembly-dark"
      value={code}
      beforeMount={configureAssembly}
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor) => {
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
        contextmenu: true,
        stickyScroll: { enabled: false },
        quickSuggestions: false,
      }}
    />
  );
}
