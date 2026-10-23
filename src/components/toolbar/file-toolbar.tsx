"use client";

import { useId, useRef, useState } from "react";
import { BookOpen, ChevronDown, Download, FilePlus2, FlaskConical, Upload } from "lucide-react";
import { EXAMPLES } from "@/lib/editor/examples";
import { readSourceFile } from "@/lib/editor/document";
import type { SourceDocument, ToolPanel } from "@/types/ide";

interface FileToolbarProps {
  ready: boolean;
  onReplace: (document: SourceDocument) => boolean;
  onDownload: () => void;
  onPanel: (panel: ToolPanel) => void;
  panel: ToolPanel;
  onNotice: (message: string) => void;
}

export function FileToolbar({ ready, onReplace, onDownload, onPanel, panel, onNotice }: FileToolbarProps) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const selectId = useId();

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const source = await readSourceFile(file);
      onReplace(source);
    } catch (error) { onNotice(error instanceof Error ? error.message : "The file could not be opened."); }
    finally { setUploading(false); }
  }

  const busy = !ready || uploading;
  return (
    <nav className="file-toolbar" aria-label="Source file actions">
      <div className="toolbar-group">
        <button className="tool-button" disabled={busy} onClick={() => onReplace({ code: "", filename: "untitled.asm" })}><FilePlus2 /><span>Create</span></button>
        <button className="tool-button" disabled={busy} onClick={() => input.current?.click()}><Upload /><span>{uploading ? "Reading…" : "Upload"}</span></button>
        <input ref={input} type="file" accept=".asm,.txt" aria-label="Upload assembly source" className="sr-only" tabIndex={-1} onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void upload(file);
        }} />
        <button className="tool-button" disabled={busy} onClick={onDownload}><Download /><span>Download</span></button>
        <span className="toolbar-divider" />
        <div className="example-select">
          <label htmlFor={selectId} className="sr-only">Load a provisional example</label>
          <BookOpen size={15} aria-hidden="true" />
          <select id={selectId} disabled={busy} value="" onChange={(event) => {
            const example = EXAMPLES.find(({ id }) => id === event.target.value);
            if (example) onReplace({ code: example.code, filename: example.filename });
          }}>
            <option value="" disabled>Examples</option>
            {EXAMPLES.map((example) => <option key={example.id} value={example.id}>{example.title} (provisional)</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </div>
      </div>
      <div className="toolbar-group auxiliary-tools">
        <button className={`tool-button ${panel === "info" ? "selected" : ""}`} aria-expanded={panel === "info"} aria-controls="info-panel" onClick={() => onPanel(panel === "info" ? null : "info")}><BookOpen /><span>Info</span></button>
        <button className={`tool-button ${panel === "tests" ? "selected" : ""}`} aria-expanded={panel === "tests"} aria-controls="tests-panel" onClick={() => onPanel(panel === "tests" ? null : "tests")}><FlaskConical /><span>Test Cases</span></button>
      </div>
    </nav>
  );
}
