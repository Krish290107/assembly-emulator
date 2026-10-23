"use client";

import { useCallback, useState } from "react";
import { CircleHelp, Code2, Terminal, X } from "lucide-react";
import { useSourceDocument } from "@/lib/editor/use-source-document";
import { handleIdeShortcut } from "@/lib/editor/shortcuts";
import type { SourceDocument, ToolPanel } from "@/types/ide";
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
  const [panel, setPanel] = useState<ToolPanel>(null);
  const [uploading, setUploading] = useState(false);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const onPositionChange = useCallback((line: number, column: number) => setPosition({ line, column }), []);

  function replaceDocument(next: SourceDocument) {
    const accepted = source.replaceDocument(next);
    if (accepted) setPosition({ line: 1, column: 1 });
    return accepted;
  }

  return (
    <div className="ide-shell" onKeyDownCapture={(event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const sourceInput = target.closest(".monaco-editor .inputarea, .monaco-editor .native-edit-context, .editor-fallback textarea");
      handleIdeShortcut(event.nativeEvent, {
        active: source.ready && !uploading && event.currentTarget.contains(window.document.activeElement),
        dialogOpen: panel !== null || !!event.currentTarget.querySelector("dialog[open]"),
        unrelatedInput: !sourceInput && !!target.closest("input, textarea, select, [contenteditable], [role='textbox']"),
      }, { download: source.download, create: () => replaceDocument({ code: "", filename: "untitled.asm" }) });
    }}>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="app-header">
        <div className="brand"><span className="brand-icon"><Terminal size={21} strokeWidth={1.8} /></span><h1>Assembly Emulator</h1></div>
        <div className="header-meta"><span className="workspace-indicator" />Editor workspace<span className="header-divider" /><span>v0.1.0</span><button className="icon-button" aria-label="Open workspace documentation" aria-haspopup="dialog" aria-expanded={panel === "info"} onClick={() => setPanel("info")}><CircleHelp size={17} /></button></div>
      </header>
      <FileToolbar ready={source.ready} uploading={uploading} onUploadingChange={setUploading} onReplace={replaceDocument} onDownload={source.download} onPanel={setPanel} panel={panel} onNotice={source.setNotice} />
      {source.notice && <div className="notice-bar" role="status"><span>{source.notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => source.setNotice(null)}><X size={15} /></button></div>}
      <main id="workspace" className="workspace" tabIndex={-1}>
        <div className="code-workspace">
          <ExecutionToolbar available={false} debuggerState={{ breakpoints: [] }} />
          <EditorPane filename={source.document.filename} revision={source.revision} code={source.document.code} ready={source.ready} modified={source.saveState === "saving"} onChange={source.updateCode} onPositionChange={onPositionChange} />
          <OutputPanel />
        </div>
        <aside className="inspector" aria-label="CPU and memory inspectors"><div className="inspector-title"><Code2 size={14} /><span>MACHINE STATE</span><span className="inspector-draft">NOT AVAILABLE</span></div><CpuPanel /><MemoryPanel /></aside>
      </main>
      <StatusBar saveState={source.saveState} line={position.line} column={position.column} />
      {panel && <ToolPanelView key={panel} panel={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
