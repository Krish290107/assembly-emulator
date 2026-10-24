"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleHelp, Code2, Terminal, X } from "lucide-react";
import { useSourceDocument } from "@/lib/editor/use-source-document";
import { handleIdeShortcut } from "@/lib/editor/shortcuts";
import { handleDebuggerShortcut } from "@/lib/workspace/shortcuts";
import { useExecution } from "@/lib/workspace/use-execution";
import type { OutputTab, SourceDocument, ToolPanel } from "@/types/ide";
import { EditorPane } from "@/components/editor/editor-pane";
import { CpuPanel } from "@/components/panels/cpu-panel";
import { MemoryPanel } from "@/components/panels/memory-panel";
import { OutputPanel } from "@/components/panels/output-panel";
import { ToolPanelView } from "@/components/panels/tool-panel";
import { ExecutionToolbar } from "@/components/toolbar/execution-toolbar";
import { FileToolbar } from "@/components/toolbar/file-toolbar";
import { StatusBar } from "./status-bar";

export function IdeWorkspace() {
  const source = useSourceDocument();
  const { controller, view } = useExecution();
  useEffect(() => controller.setSource(source.document.code), [controller, source.document.code]);
  const [panel, setPanel] = useState<ToolPanel>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>("output");
  const [uploading, setUploading] = useState(false);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const onPositionChange = useCallback((line: number, column: number) => setPosition({ line, column }), []);
  const onRunToCursor = useCallback((line: number) => { controller.runToCursor(line); setOutputTab("trace"); }, [controller]);

  function replaceDocument(next: SourceDocument) {
    const accepted = source.replaceDocument(next);
    if (accepted) { controller.setSource(next.code, true); setPosition({ line: 1, column: 1 }); }
    return accepted;
  }

  return (
    <div className="ide-shell" onKeyDownCapture={(event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const sourceInput = target.closest(".monaco-editor .inputarea, .monaco-editor .native-edit-context, .editor-fallback textarea");
      const shortcutContext = {
        active: source.ready && !uploading && event.currentTarget.contains(window.document.activeElement),
        dialogOpen: panel !== null || !!event.currentTarget.querySelector("dialog[open]"),
        unrelatedInput: !sourceInput && !!target.closest("input, textarea, select, [contenteditable], [role='textbox']"),
      };
      if (handleDebuggerShortcut(event.nativeEvent, { ...shortcutContext, sourceInput: !!sourceInput, sourceLine: position.line }, controller.getSnapshot(), {
        run: controller.run, step: controller.step, reset: controller.reset, breakpoint: controller.toggleBreakpoint,
      })) { event.stopPropagation(); return; }
      handleIdeShortcut(event.nativeEvent, shortcutContext, { download: source.download, create: () => replaceDocument({ code: "", filename: "untitled.asm" }) });
    }}>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="app-header">
        <div className="brand"><span className="brand-icon"><Terminal size={21} strokeWidth={1.8} /></span><h1>Assembly Emulator</h1></div>
        <div className="header-meta"><button className="icon-button" aria-label="Open workspace documentation" aria-haspopup="dialog" aria-expanded={panel === "info"} onClick={() => setPanel("info")}><CircleHelp size={17} /></button></div>
      </header>
      <FileToolbar ready={source.ready} uploading={uploading} onUploadingChange={setUploading} onReplace={replaceDocument} onDownload={source.download} onPanel={setPanel} panel={panel} onNotice={source.setNotice} />
      {(source.saveState === "conflict" || source.saveState === "unavailable") && <div className="notice-bar source-recovery" role="region" aria-label="Draft recovery"><span>Autosave is protected or unavailable. Keep editing and download a backup before recovery.</span><div className="toolbar-group"><button className="tool-button" onClick={source.download}>Download editor backup</button><button className="tool-button" onClick={() => source.recoverDraft(false)}>Reload saved draft…</button><button className="tool-button" onClick={() => source.recoverDraft(true)}>Overwrite saved draft…</button></div></div>}
      {source.notice && <div className="notice-bar" role="status"><span>{source.notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => source.setNotice(null)}><X size={15} /></button></div>}
      <main id="workspace" className="workspace" tabIndex={-1}>
        <div className="code-workspace">
          <ExecutionToolbar ready={source.ready && !uploading} view={view} onDebugger={() => setOutputTab("trace")} onRunToCursor={() => onRunToCursor(position.line)} onSpeedChange={controller.setSpeed} onAction={(action) => { if (action === "assemble") controller.assemble(source.document.code); else controller[action](); }} />
          <EditorPane filename={source.document.filename} revision={source.revision} code={source.document.code} ready={source.ready} modified={source.saveState !== "saved"} onChange={(code) => { controller.setSource(code); source.updateCode(code); }} onPositionChange={onPositionChange} diagnostics={view.diagnostics} currentLine={view.currentSource?.start.line} breakpoints={view.breakpoints} onToggleBreakpoint={controller.toggleBreakpoint} onRunToCursor={onRunToCursor} navigation={view.navigation} />
          <OutputPanel view={view} onAddress={controller.setDisassemblyStart} active={outputTab} onTabChange={setOutputTab} debuggerActions={controller} />
        </div>
        <aside className="inspector" aria-label="CPU and memory inspectors"><div className="inspector-title"><Code2 size={14} /><span>MACHINE STATE</span><span className="inspector-draft">{view.status.toUpperCase()}</span></div><CpuPanel view={view} /><MemoryPanel view={view} onAddress={controller.setMemoryStart} /></aside>
      </main>
      <StatusBar saveState={source.saveState} line={position.line} column={position.column} />
      {panel && <ToolPanelView source={source.document.code} key={panel} panel={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
