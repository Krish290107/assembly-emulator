"use client";

import { useId, useRef } from "react";
import { BookOpen, ChevronDown, Download, FilePlus2, FlaskConical, Upload } from "lucide-react";
import { EXAMPLES } from "@/lib/editor/examples";
import { readSourceFile } from "@/lib/editor/document";
import type { SourceDocument, ToolPanel } from "@/types/ide";

interface FileToolbarProps {
  ready: boolean;
  uploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  onReplace: (document: SourceDocument) => boolean;
  onDownload: () => void;
  onPanel: (panel: ToolPanel) => void;
  panel: ToolPanel;
  onNotice: (message: string) => void;
}

export function FileToolbar({ ready, uploading, onUploadingChange, onReplace, onDownload, onPanel, panel, onNotice }: FileToolbarProps) {
  const input = useRef<HTMLInputElement>(null);
  const selectId = useId();

  async function upload(file?: File) {
    if (!file) return;
    onUploadingChange(true);
    try {
      const source = await readSourceFile(file);
      onReplace(source);
    } catch (error) { onNotice(error instanceof Error ? error.message : "The file could not be opened."); }
    finally { onUploadingChange(false); }
  }

  const busy = !ready || uploading;
  return (
    <nav className="file-toolbar" aria-label="Source file actions">
      <div className="toolbar-group">
        <button className="tool-button" disabled={busy} title="Create a blank program (Ctrl+N)" aria-keyshortcuts="Control+N" onClick={() => onReplace({ code: "", filename: "untitled.asm" })}><FilePlus2 /><span>Create</span></button>
        <button className="tool-button" disabled={busy} onClick={() => input.current?.click()}><Upload /><span>{uploading ? "Reading…" : "Upload"}</span></button>
        <input ref={input} type="file" accept=".asm,.txt" aria-label="Upload assembly source" className="sr-only" tabIndex={-1} onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void upload(file);
        }} />
        <button className="tool-button" disabled={busy} title="Download current source (Ctrl+S)" aria-keyshortcuts="Control+S" onClick={onDownload}><Download /><span>Download</span></button>
        <span className="toolbar-divider" />
        <div className="example-select">
          <label htmlFor={selectId} className="sr-only">Load an ISA v1 example</label>
          <BookOpen size={15} aria-hidden="true" />
          <select id={selectId} disabled={busy} value="" onChange={(event) => {
            const example = EXAMPLES.find(({ id }) => id === event.target.value);
            if (example) onReplace({ code: example.code, filename: example.filename });
          }}>
            <option value="" disabled>Examples</option>
            {EXAMPLES.map((example) => <option key={example.id} value={example.id}>{example.title}</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </div>
      </div>
      <div className="toolbar-group auxiliary-tools">
        <button className={`tool-button ${panel === "info" ? "selected" : ""}`} aria-haspopup="dialog" aria-expanded={panel === "info"} aria-controls={panel === "info" ? "info-panel" : undefined} onClick={() => onPanel(panel === "info" ? null : "info")}><BookOpen /><span>Info</span></button>
        <button className={`tool-button ${panel === "tests" ? "selected" : ""}`} aria-haspopup="dialog" aria-expanded={panel === "tests"} aria-controls={panel === "tests" ? "tests-panel" : undefined} onClick={() => onPanel(panel === "tests" ? null : "tests")}><FlaskConical /><span>Test Cases</span></button>
      </div>
    </nav>
  );
}
