import assert from "node:assert/strict";
import { test } from "node:test";
import { asmFilename, MAX_SOURCE_BYTES, needsReplacementConfirmation, persistDocument, readSourceFile, restoreDocument, sourceDownload, STORAGE_KEY } from "../src/lib/editor/document.ts";

test("replacement protects undownloaded work, including a restored draft", () => {
  assert.equal(needsReplacementConfirmation({ code: "MOV A, 9", filename: "program.asm" }, "MOV A, 1"), true);
  assert.equal(needsReplacementConfirmation({ code: "restored source", filename: "program.asm" }, ""), true);
  assert.equal(needsReplacementConfirmation({ code: "", filename: "untitled.asm" }, "old source"), false);
  assert.equal(needsReplacementConfirmation({ code: "downloaded", filename: "a.asm" }, "downloaded"), false);
});

test("upload accepts .asm and .txt, preserving text and stripping a UTF-8 BOM", async () => {
  const source = "; note\r\nMOV A, 10\r\n";
  assert.deepEqual(await readSourceFile(new File([source], "source.ASM")), { code: source, filename: "source.asm" });
  assert.deepEqual(await readSourceFile({ name: "notes.txt", size: 8, text: async () => "\uFEFF; hello" }), { code: "; hello", filename: "notes.asm" });
  assert.deepEqual(await readSourceFile(new File([], "empty.asm")), { code: "", filename: "empty.asm" });
});

test("upload rejects invalid extensions, binary content, oversized files, and read failures", async () => {
  await assert.rejects(readSourceFile(new File(["code"], "source.exe")), /\.asm or \.txt/);
  await assert.rejects(readSourceFile(new File(["a\0b"], "binary.asm")), /binary/);
  await assert.rejects(readSourceFile({ name: "large.asm", size: MAX_SOURCE_BYTES + 1, text: async () => "" }), /too large/);
  await assert.rejects(readSourceFile({ name: "locked.txt", size: 1, text: async () => { throw new Error("read denied"); } }), /could not be read/);
});

test("download produces current source bytes and an .asm filename", async () => {
  const code = "; Unicode: α\r\nMOV A, 5\n";
  const { filename, blob } = sourceDownload({ code, filename: "notes.txt" });
  assert.equal(filename, "notes.asm");
  assert.equal(await blob.text(), code);
  assert.equal(blob.type, "text/plain;charset=utf-8");
});

test("filenames remove paths and unsafe characters", () => {
  assert.equal(asmFilename("C:\\sources\\my file.txt"), "my-file.asm");
  assert.equal(asmFilename("../../main.asm"), "main.asm");
  assert.equal(asmFilename("..."), "program.asm");
});

test("autosave round-trips source and filename, including an intentionally blank program", () => {
  const map = new Map();
  const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  assert.equal(restoreDocument(storage), null);
  for (const document of [{ code: "MOV A, 7", filename: "source.asm" }, { code: "", filename: "untitled.asm" }]) {
    persistDocument(storage, document);
    assert.ok(map.has(STORAGE_KEY));
    assert.deepEqual(restoreDocument(storage), document);
  }
});

test("storage errors and corrupt records are surfaced for the UI to handle", () => {
  assert.throws(() => restoreDocument({ getItem: () => "broken JSON" }));
  assert.throws(() => restoreDocument({ getItem: () => '{"code":4,"filename":"bad.asm"}' }), /invalid/);
  assert.throws(() => restoreDocument({ getItem: () => { throw new Error("access denied"); } }), /access denied/);
  assert.throws(() => persistDocument({ setItem: () => { throw new Error("quota"); } }, { code: "test", filename: "a.asm" }), /quota/);
});
