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
  const raw = storage.getItem(STORAGE_KEY);
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

export function sourceDownload(document: SourceDocument): { filename: string; blob: Blob } {
  return { filename: asmFilename(document.filename), blob: new Blob([document.code], { type: "text/plain;charset=utf-8" }) };
}
