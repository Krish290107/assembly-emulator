"use client";

import type { AssemblyEditorProps } from "./monaco-editor";
import { useEffect, useRef } from "react";
import { sourceOffset } from "@/lib/workspace/debugger";

export function EditorFallback({ code, onChange, onPositionChange, navigation }: AssemblyEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const navigationLine = navigation?.line;
  const navigationColumn = navigation?.column;
  const navigationRequest = navigation?.request;
  useEffect(() => {
    const editor = textarea.current;
    if (!editor || !navigationLine || !navigationColumn) return;
    const offset = sourceOffset(editor.value, navigationLine, navigationColumn);
    if (offset !== null) { editor.focus(); editor.setSelectionRange(offset, offset); }
  }, [navigationLine, navigationColumn, navigationRequest]);
  return (
    <div className="editor-fallback">
      <p role="status">Monaco could not load. Keep editing here; use Run to cursor in the toolbar and manage breakpoints by line in Execution Trace.</p>
      <textarea ref={textarea} aria-label="Assembly source" value={code} wrap="off" onChange={(event) => onChange(event.target.value)} onSelect={(event) => {
        const editor = event.currentTarget;
        const beforeCursor = editor.value.slice(0, editor.selectionStart);
        const lines = beforeCursor.split(/\r\n|\r|\n/);
        onPositionChange(lines.length, lines.at(-1)!.length + 1);
      }} spellCheck={false} />
    </div>
  );
}
