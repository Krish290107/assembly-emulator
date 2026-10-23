"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState, SourceDocument } from "@/types/ide";
import { INITIAL_DOCUMENT } from "./examples";
import { confirmSourceReplacement, persistDocument, restoreDocument, sourceDownload } from "./document";

export function useSourceDocument() {
  const [document, setDocument] = useState<SourceDocument>(INITIAL_DOCUMENT);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const current = useRef(document);
  const downloadedCode = useRef(INITIAL_DOCUMENT.code);
  const savedCode = useRef<string | null>(null);
  const storageAvailable = useRef(true);
  const autosaveEnabled = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect -- Restore browser-only storage after hydration so server and initial client renders match. */
  useEffect(() => {
    try {
      const restored = restoreDocument(window.localStorage);
      if (restored) {
        current.current = restored;
        savedCode.current = restored.code;
        // A restored draft has not necessarily been downloaded.
        downloadedCode.current = "";
        setDocument(restored);
      }
      autosaveEnabled.current = true;
      setSaveState(restored ? "saved" : "saving");
    } catch {
      storageAvailable.current = false;
      setSaveState("unavailable");
      setNotice("Your saved draft could not be restored. It will stay untouched until you edit or replace the source. Download a copy to keep your work.");
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useCallback((next: SourceDocument) => {
    try {
      persistDocument(window.localStorage, next);
      savedCode.current = next.code;
      storageAvailable.current = true;
      setSaveState("saved");
    } catch {
      storageAvailable.current = false;
      setSaveState("unavailable");
      setNotice("Browser autosave failed. Download your source to keep a copy.");
    }
  }, []);

  useEffect(() => {
    if (!ready || !autosaveEnabled.current) return;
    const timer = window.setTimeout(() => save(document), 400);
    return () => window.clearTimeout(timer);
  }, [document, ready, save]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      if (autosaveEnabled.current) save(current.current);
    };
    const onVisibility = () => { if (window.document.visibilityState === "hidden") flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (!storageAvailable.current && current.current.code !== downloadedCode.current && current.current.code !== savedCode.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", beforeUnload);
    window.document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
      window.document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, save]);

  function updateCode(code: string) {
    const next = { ...current.current, code };
    current.current = next;
    autosaveEnabled.current = true;
    setDocument(next);
    setSaveState("saving");
  }

  function replaceDocument(next: SourceDocument): boolean {
    if (!confirmSourceReplacement(current.current, downloadedCode.current, () =>
      window.confirm("Replace the current source? Download a copy first if you want to keep it. The autosaved draft will also be replaced."))) return false;
    current.current = next;
    autosaveEnabled.current = true;
    setDocument(next);
    setRevision((value) => value + 1);
    setSaveState("saving");
    return true;
  }

  function download() {
    try {
      const { filename, blob } = sourceDownload(current.current);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      downloadedCode.current = current.current.code;
      setNotice(`Download requested: ${filename}`);
    } catch { setNotice("The download could not be started. Try again or copy your source from the editor."); }
  }

  return { document, revision, ready, saveState, notice, setNotice, updateCode, replaceDocument, download };
}
