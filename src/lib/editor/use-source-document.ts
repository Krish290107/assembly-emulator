"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState, SourceDocument } from "@/types/ide";
import { INITIAL_DOCUMENT } from "./examples";
import { confirmSourceReplacement, createSourcePersistence, SourceConflictError, STORAGE_KEY, sourceDownload } from "./document";

export function useSourceDocument() {
  const [document, setDocument] = useState<SourceDocument>(INITIAL_DOCUMENT);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const current = useRef(document);
  const downloadedCode = useRef(INITIAL_DOCUMENT.code);
  const storageAvailable = useRef(true);
  const autosaveEnabled = useRef(false);
  const persistence = useRef<ReturnType<typeof createSourcePersistence> | null>(null);

  const failedSave = useCallback((error: unknown) => {
    storageAvailable.current = false;
    if (error instanceof SourceConflictError) {
      autosaveEnabled.current = false;
      setSaveState("conflict");
      setNotice(error.message);
    } else {
      setSaveState("unavailable");
      setNotice("Browser autosave failed. Your editor content is still available; download a backup.");
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- Restore browser-only storage after hydration so server and initial client renders match. */
  useEffect(() => {
    try {
      const target = createSourcePersistence(window.localStorage);
      persistence.current = target;
      const restored = target.restore();
      if (restored) {
        current.current = restored;
        downloadedCode.current = "";
        setDocument(restored);
      }
      autosaveEnabled.current = true;
      setSaveState(restored ? "saved" : "saving");
    } catch {
      autosaveEnabled.current = false;
      storageAvailable.current = false;
      setSaveState("unavailable");
      setNotice("Your saved draft could not be restored. It stays protected even if you edit. Download a backup before recovery.");
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useCallback((next: SourceDocument) => {
    try {
      if (!persistence.current) throw new Error("Storage unavailable");
      persistence.current.save(next);
      storageAvailable.current = true;
      setSaveState("saved");
    } catch (error) { failedSave(error); }
  }, [failedSave]);

  useEffect(() => {
    if (!ready || !autosaveEnabled.current) return;
    const timer = window.setTimeout(() => { if (autosaveEnabled.current) save(current.current); }, 400);
    return () => window.clearTimeout(timer);
  }, [document, ready, save]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => { if (autosaveEnabled.current) save(current.current); };
    const onVisibility = () => { if (window.document.visibilityState === "hidden") flush(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        const target = persistence.current;
        if (event.storageArea === window.localStorage && target && (target.observe(event.newValue) || target.changed())) failedSave(new SourceConflictError());
      } catch (error) { failedSave(error); }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (!storageAvailable.current && current.current.code !== downloadedCode.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", beforeUnload);
    window.document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
      window.document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, save, failedSave]);

  function updateCode(code: string) {
    const next = { ...current.current, code };
    current.current = next;
    setDocument(next);
    if (autosaveEnabled.current) setSaveState("saving");
  }

  function replaceDocument(next: SourceDocument): boolean {
    if (!confirmSourceReplacement(current.current, downloadedCode.current, () =>
      window.confirm("Replace the current source? Download a copy first if you want to keep it. Autosave protection stays active if another tab changed the saved draft."))) return false;
    current.current = next;
    setDocument(next);
    setRevision((value) => value + 1);
    if (autosaveEnabled.current) setSaveState("saving");
    return true;
  }

  function recoverDraft(overwrite: boolean) {
    try {
      const target = persistence.current ?? createSourcePersistence(window.localStorage);
      const expected = target.read();
      if (!overwrite && expected === null) { setNotice("There is no saved draft to reload. Download a backup or explicitly save this editor's source."); return; }
      if (!window.confirm(overwrite
        ? "Overwrite the saved draft with this editor's source? Download a backup first. Another tab's saved work will be replaced."
        : "Reload the latest saved draft? Download this editor's source first; unsaved editor content will be replaced.")) return;
      if (overwrite) target.overwrite(current.current, expected);
      else {
        // Do not adopt a different draft than the one present when confirmation opened.
        const restored = target.restore(expected);
        if (!restored) return;
        current.current = restored;
        downloadedCode.current = "";
        setDocument(restored);
        setRevision((value) => value + 1);
      }
      persistence.current = target;
      autosaveEnabled.current = true;
      storageAvailable.current = true;
      setSaveState("saved");
      setNotice(overwrite ? "Current source saved after confirmation." : "Latest saved draft reloaded.");
    } catch (error) { failedSave(error); }
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

  return { document, revision, ready, saveState, notice, setNotice, updateCode, replaceDocument, download, recoverDraft };
}
