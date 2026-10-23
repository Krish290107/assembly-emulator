"use client";

import type { AssemblyEditorProps } from "./monaco-editor";

export function EditorFallback({ code, onChange, onPositionChange }: AssemblyEditorProps) {
  return (
    <div className="editor-fallback">
      <p role="status">Monaco could not load. You can keep editing in this plain-text editor.</p>
      <textarea aria-label="Assembly source" value={code} wrap="off" onChange={(event) => onChange(event.target.value)} onSelect={(event) => {
        const editor = event.currentTarget;
        const beforeCursor = editor.value.slice(0, editor.selectionStart);
        const lines = beforeCursor.split("\n");
        onPositionChange(lines.length, lines.at(-1)!.length + 1);
      }} spellCheck={false} />
    </div>
  );
}
