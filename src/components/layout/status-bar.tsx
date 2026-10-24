import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { SaveState } from "@/types/ide";

const LABELS: Record<SaveState, string> = { loading: "Restoring draft", saving: "Saving draft…", saved: "Saved in this browser", unavailable: "Autosave unavailable", conflict: "Draft conflict — autosave paused" };

export function StatusBar({ saveState, line, column }: { saveState: SaveState; line: number; column: number }) {
  const Icon = saveState === "saved" ? Check : saveState === "unavailable" || saveState === "conflict" ? CircleAlert : LoaderCircle;
  return <footer className="status-bar"><div className="status-left"><span className={`save-status ${saveState}`} role="status"><Icon size={12} />{LABELS[saveState]}</span></div><div className="status-right"><span>Ln {line}, Col {column}</span><span>Spaces: 4</span><span>UTF-8</span><span className="status-language">Assembly ISA v1</span></div></footer>;
}
