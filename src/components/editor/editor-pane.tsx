"use client";

import dynamic from "next/dynamic";
import { FileCode2 } from "lucide-react";
import type { AssemblyEditorProps } from "./monaco-editor";
import { EditorBoundary } from "./editor-boundary";

const AssemblyEditor = dynamic(() => import("./monaco-editor"), {
  ssr: false,
  loading: () => <div className="editor-loading" role="status">Loading source editor…</div>,
});

export function EditorPane(props: AssemblyEditorProps & { filename: string; revision: number; ready: boolean; modified: boolean }) {
  return (
    <section className="editor-pane" aria-label="Source editor">
      <div className="editor-tabbar">
        <div className="file-tab"><FileCode2 size={15} /><span title={props.filename}>{props.filename}</span>{props.modified && <span className="modified-dot" title="Source is being autosaved" />}</div>
        <span className="editor-language">Assembly <span className="draft-tag">ISA v1</span></span>
      </div>
      <div className="editor-surface">
        {props.ready ? <EditorBoundary key={props.revision} code={props.code} onChange={props.onChange} onPositionChange={props.onPositionChange}><AssemblyEditor code={props.code} onChange={props.onChange} onPositionChange={props.onPositionChange} /></EditorBoundary> : <div className="editor-loading" role="status">Restoring your workspace…</div>}
      </div>
      <div className="editor-footnote"><span>ISA v1</span><span>Highlighting does not validate source. Assembly and execution are unavailable.</span></div>
    </section>
  );
}
