"use client";

import dynamic from "next/dynamic";
import { FileCode2 } from "lucide-react";
import type { AssemblyEditorProps } from "./monaco-editor";

const AssemblyEditor = dynamic(() => import("./monaco-editor"), {
  ssr: false,
  loading: () => <div className="editor-loading" role="status">Loading source editor…</div>,
});

export function EditorPane(props: AssemblyEditorProps & { filename: string; ready: boolean; modified: boolean }) {
  return (
    <section className="editor-pane" aria-label="Source editor">
      <div className="editor-tabbar">
        <div className="file-tab"><FileCode2 size={15} /><span>{props.filename}</span>{props.modified && <span className="modified-dot" title="Source is being autosaved" />}</div>
        <span className="editor-language">Assembly <span className="draft-tag">DRAFT ISA</span></span>
      </div>
      <div className="editor-surface">
        {props.ready ? <AssemblyEditor code={props.code} onChange={props.onChange} onPositionChange={props.onPositionChange} /> : <div className="editor-loading" role="status">Restoring your workspace…</div>}
      </div>
      <div className="editor-footnote"><span>Provisional syntax</span><span>Instruction set will be defined in Days 3–5.</span></div>
    </section>
  );
}
