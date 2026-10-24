import type { SourceDocument } from "../../types/ide";

export const STORAGE_KEY = "assembly-emulator:source:v1";
export const MAX_SOURCE_BYTES = 1024 * 1024;

export function asmFilename(name: string): string {
  const basename = name.split(/[\\/]/).pop() ?? "program";
  let stem = basename.normalize("NFKC").replace(/\.(asm|txt)$/i, "").replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-").replace(/^[. -]+|[. -]+$/g, "").slice(0, 120).replace(/[. -]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = `program-${stem}`;
  return `${stem || "program"}.asm`;
}

export function needsReplacementConfirmation(current: SourceDocument, downloadedCode: string): boolean {
  return current.code.length > 0 && current.code !== downloadedCode;
}

export function confirmSourceReplacement(current: SourceDocument, downloadedCode: string, confirm: () => boolean): boolean {
  return !needsReplacementConfirmation(current, downloadedCode) || confirm();
}

export async function readSourceFile(file: Pick<File, "name" | "size" | "arrayBuffer">): Promise<SourceDocument> {
  if (!/\.(asm|txt)$/i.test(file.name)) throw new Error("Choose an .asm or .txt file.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("This file is too large. Choose a source file of 1 MB or less.");
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); } catch { throw new Error("The file could not be read. Try selecting it again."); }
  let code: string;
  try { code = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("The file is not valid UTF-8 text. Save it as UTF-8 and try again."); }
  for (let index = 0; index < code.length; index++) {
    const value = code.charCodeAt(index);
    if ((value < 32 && value !== 9 && value !== 10 && value !== 13) || value === 127) {
      throw new Error("This looks like a binary file. Choose a plain-text .asm or .txt file.");
    }
  }
  return { code: code.replace(/^\uFEFF/, ""), filename: asmFilename(file.name) };
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

export function restoreDocument(storage: ReadStorage): SourceDocument | null {
  return parseDocument(storage.getItem(STORAGE_KEY));
}

export function parseDocument(raw: string | null): SourceDocument | null {
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("code" in parsed) || !("filename" in parsed)
    || typeof parsed.code !== "string" || typeof parsed.filename !== "string") {
    throw new Error("The saved draft is invalid.");
  }
  return { code: parsed.code, filename: asmFilename(parsed.filename) };
}

export function persistDocument(storage: WriteStorage, document: SourceDocument): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(document));
}

export class SourceConflictError extends Error {
  constructor() { super("The saved draft changed or is protected. Current editor content was kept; download a backup before recovery."); }
}

/** One baseline per tab. All saves, including lifecycle flushes, use this guard. */
export function createSourcePersistence(storage: ReadStorage & WriteStorage) {
  let baseline: string | null = null, protectedData = true;
  const read = () => storage.getItem(STORAGE_KEY);
  function observe(raw: string | null) {
    if (raw !== baseline) protectedData = true;
    return protectedData;
  }
  const changed = () => observe(read());
  function write(document: SourceDocument, expected: string | null) {
    const raw = JSON.stringify(document);
    if (read() !== expected) { protectedData = true; throw new SourceConflictError(); }
    if (raw !== expected) storage.setItem(STORAGE_KEY, raw);
    baseline = raw;
    protectedData = false;
  }
  return {
    read, changed, observe,
    restore(expected?: string | null) {
      protectedData = true;
      const raw = read();
      if (expected !== undefined && raw !== expected) throw new SourceConflictError();
      const document = parseDocument(raw);
      baseline = raw;
      protectedData = false;
      return document;
    },
    save(document: SourceDocument) {
      if (changed()) throw new SourceConflictError();
      write(document, baseline);
    },
    // Capture expected BEFORE asking for confirmation; recheck AFTER it returns.
    overwrite(document: SourceDocument, expected: string | null) { write(document, expected); },
  };
}

export function sourceDownload(document: SourceDocument): { filename: string; blob: Blob } {
  return { filename: asmFilename(document.filename), blob: new Blob([document.code], { type: "text/plain;charset=utf-8" }) };
}
