import assert from "node:assert/strict";
import { test } from "node:test";
import { asmFilename, confirmSourceReplacement, MAX_SOURCE_BYTES, needsReplacementConfirmation, persistDocument, readSourceFile, restoreDocument, sourceDownload, STORAGE_KEY } from "../src/lib/editor/document.ts";

test("replacement protects undownloaded work, including a restored draft", () => {
  assert.equal(needsReplacementConfirmation({ code: "MOV A, 9", filename: "program.asm" }, "MOV A, 1"), true);
  assert.equal(needsReplacementConfirmation({ code: "restored source", filename: "program.asm" }, ""), true);
  assert.equal(needsReplacementConfirmation({ code: "", filename: "untitled.asm" }, "old source"), false);
  assert.equal(needsReplacementConfirmation({ code: "downloaded", filename: "a.asm" }, "downloaded"), false);
});

test("upload accepts .asm and .txt, preserving text and stripping a UTF-8 BOM", async () => {
  const source = "; note\r\nMOV A, 10\r\n";
  assert.deepEqual(await readSourceFile(new File([source], "source.ASM")), { code: source, filename: "source.asm" });
  assert.deepEqual(await readSourceFile(new File(["\uFEFF; hello"], "notes.txt")), { code: "; hello", filename: "notes.asm" });
  assert.deepEqual(await readSourceFile(new File([], "empty.asm")), { code: "", filename: "empty.asm" });
});

test("upload rejects invalid extensions, binary content, oversized files, and read failures", async () => {
  await assert.rejects(readSourceFile(new File(["code"], "source.exe")), /\.asm or \.txt/);
  await assert.rejects(readSourceFile(new File(["a\0b"], "binary.asm")), /binary/);
  await assert.rejects(readSourceFile({ name: "large.asm", size: MAX_SOURCE_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }), /too large/);
  await assert.rejects(readSourceFile({ name: "locked.txt", size: 1, arrayBuffer: async () => { throw new Error("read denied"); } }), /could not be read/);
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

test("upload accepts exactly 1 MB and rejects one byte over without reading it", async () => {
  const code = ";".repeat(MAX_SOURCE_BYTES);
  assert.equal((await readSourceFile(new File([code], "limit.asm"))).code, code);
  let read = false;
  await assert.rejects(readSourceFile({ name: "over.asm", size: MAX_SOURCE_BYTES + 1, arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } }), /too large/);
  assert.equal(read, false);
});

test("upload preserves UTF-8, whitespace, line endings, and inert JavaScript-looking text", async () => {
  const code = "; α 日本語 🛠\r\n\t  label:  \n<script>alert('text only')</script>\n";
  assert.equal((await readSourceFile(new File([code], "unicode.txt"))).code, code);
});

test("upload rejects malformed UTF-8 and binary controls without NUL", async () => {
  await assert.rejects(readSourceFile(new File([new Uint8Array([0xc3, 0x28])], "bad.asm")), /UTF-8/);
  for (const control of [1, 8, 11, 12, 27, 31, 127]) {
    await assert.rejects(readSourceFile(new File([new Uint8Array([65, control, 66])], "binary.txt")), /binary/);
  }
});

test("filename normalization is bounded, safe on Windows, and idempotent", () => {
  for (const [input, expected] of [["   .txt", "program.asm"], ["CON.txt", "program-CON.asm"], ["lpt1.asm", "program-lpt1.asm"], ["ＮＯＴＥＳ.txt", "NOTES.asm"], ["a???b.txt", "a-b.asm"], ["日本語.txt", "program.asm"]]) {
    assert.equal(asmFilename(input), expected);
    assert.equal(asmFilename(expected), expected);
  }
  const long = asmFilename("a".repeat(500) + ".asm");
  assert.equal(long.length, 124);
  assert.equal(asmFilename(long), long);
});

test("create, upload, and example replacement cancellation do not mutate the current document", () => {
  const current = Object.freeze({ code: "unsaved source", filename: "work.asm" });
  for (const next of [{ code: "", filename: "untitled.asm" }, { code: "upload", filename: "upload.asm" }, { code: "example", filename: "example.asm" }]) {
    let selected = current;
    if (confirmSourceReplacement(current, "older download", () => false)) selected = next;
    assert.equal(selected, current);
    assert.equal(confirmSourceReplacement(current, "older download", () => true), true);
  }
  assert.equal(confirmSourceReplacement({ code: "", filename: "blank.asm" }, "old", () => { throw new Error("Blank source should not prompt"); }), true);
});

test("corrupt draft restoration leaves the original storage record untouched", () => {
  const raw = '{"code":"incomplete';
  let writes = 0;
  const storage = { getItem: () => raw, setItem: () => { writes++; } };
  assert.throws(() => restoreDocument(storage));
  assert.equal(writes, 0);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
