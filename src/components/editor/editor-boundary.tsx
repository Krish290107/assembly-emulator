"use client";

import { Component, type ReactNode } from "react";
import { EditorFallback } from "./editor-fallback";
import type { AssemblyEditorProps } from "./monaco-editor";

export class EditorBoundary extends Component<AssemblyEditorProps & { children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <EditorFallback {...this.props} /> : this.props.children;
  }
}
