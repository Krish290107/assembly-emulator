"use client";

import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/editor/browser/coreCommands";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/editor/contrib/comment/browser/comment";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/editor/contrib/find/browser/findController";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution";
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
import type { Diagnostic } from "@/types/engine";
import { editorMarkers } from "@/lib/workspace/markers";
import type { SourceBreakpoint, SourceNavigation } from "@/lib/workspace/debugger";

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
  diagnostics?: readonly Diagnostic[];
  currentLine?: number;
  breakpoints?: readonly SourceBreakpoint[];
  onToggleBreakpoint?: (line: number) => void;
  onRunToCursor?: (line: number) => void;
  navigation?: SourceNavigation;
}

const NO_DIAGNOSTICS: readonly Diagnostic[] = [];
const NO_BREAKPOINTS: readonly SourceBreakpoint[] = [];
export default function AssemblyEditor({ code, onChange, onPositionChange, diagnostics = NO_DIAGNOSTICS, currentLine, breakpoints = NO_BREAKPOINTS, onToggleBreakpoint, onRunToCursor, navigation }: AssemblyEditorProps) {
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [instance, setInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const navigationLine = navigation?.line;
  const navigationColumn = navigation?.column;
  const navigationRequest = navigation?.request;

  useEffect(() => {
    const model = instance?.getModel();
    if (!instance || !model || model.isDisposed()) return;
    const markers = editorMarkers(diagnostics).map((marker) => ({ ...marker, severity: { error: monaco.MarkerSeverity.Error, warning: monaco.MarkerSeverity.Warning, info: monaco.MarkerSeverity.Info }[marker.severity] }));
    monaco.editor.setModelMarkers(model, "assembly-emulator", markers);
    const decorations = instance.createDecorationsCollection(currentLine && currentLine <= model.getLineCount() ? [{ range: new monaco.Range(currentLine, 1, currentLine, 1), options: { isWholeLine: true, className: "current-instruction-line", linesDecorationsClassName: "current-instruction-gutter" } }] : []);
    return () => { if (!model.isDisposed()) monaco.editor.setModelMarkers(model, "assembly-emulator", []); decorations.clear(); };
  }, [instance, diagnostics, currentLine]);

  useEffect(() => {
    const model = instance?.getModel();
    if (!instance || !model || model.isDisposed()) return;
    const decorations = instance.createDecorationsCollection(breakpoints.filter(({ sourceLine }) => sourceLine <= model.getLineCount()).map((breakpoint) => ({
      range: new monaco.Range(breakpoint.sourceLine, 1, breakpoint.sourceLine, 1),
      options: { glyphMarginClassName: `breakpoint-glyph ${breakpoint.enabled ? "" : "breakpoint-disabled"} ${breakpoint.resolution === "resolved" ? "" : "breakpoint-pending"}`, glyphMarginHoverMessage: { value: `Breakpoint at line ${breakpoint.sourceLine}${breakpoint.enabled ? "" : " (disabled)"}. ${breakpoint.message}` } },
    })));
    return () => decorations.clear();
  }, [instance, breakpoints]);

  useEffect(() => {
    if (!instance || !onToggleBreakpoint) return;
    const mouse = instance.onMouseDown((event) => {
      if (event.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || !event.target.position) return;
      event.event.preventDefault(); onToggleBreakpoint(event.target.position.lineNumber);
    });
    const action = instance.addAction({ id: "assembly.toggleBreakpoint", label: "Toggle source breakpoint", keybindings: [monaco.KeyCode.F9], run: (editor) => { const position = editor.getPosition(); if (position) onToggleBreakpoint(position.lineNumber); } });
    return () => { mouse.dispose(); action.dispose(); };
  }, [instance, onToggleBreakpoint]);

  useEffect(() => {
    if (!instance || !onRunToCursor) return;
    const action = instance.addAction({
      id: "assembly.runToCursor", label: "Run to Cursor", contextMenuGroupId: "navigation", contextMenuOrder: 1.5,
      run: (editor) => { const position = editor.getPosition(); if (position) onRunToCursor(position.lineNumber); },
    });
    return () => action.dispose();
  }, [instance, onRunToCursor]);

  useEffect(() => {
    const model = instance?.getModel();
    if (!instance || !model || !navigationLine || !navigationColumn || navigationLine > model.getLineCount()) return;
    instance.setPosition({ lineNumber: navigationLine, column: navigationColumn });
    instance.revealLineInCenterIfOutsideViewport(navigationLine); instance.focus();
  }, [instance, navigationLine, navigationColumn, navigationRequest]);

  useEffect(() => {
    if (mounted) return;
    const timer = window.setTimeout(() => setFailed(true), 15000);
    return () => window.clearTimeout(timer);
  }, [mounted]);

  if (failed) return <EditorFallback code={code} onChange={onChange} onPositionChange={onPositionChange} navigation={navigation} />;

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
        setInstance(editor);
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
        glyphMargin: true,
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
