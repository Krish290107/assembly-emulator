import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "node_modules/monaco-editor");
const destination = path.join(root, "public/monaco");
const { version } = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));

// Monaco also vendors DOMPurify in its ESM tree. An npm override alone does
// not replace that copy. Keep the vendored module aligned with the patched
// dependency before either development or production compilation.
const require = createRequire(import.meta.url);
const sanitizerEntry = require.resolve("dompurify", { paths: [source] });
const sanitizer = (await readFile(path.join(path.dirname(sanitizerEntry), "purify.es.mjs"), "utf8"))
  .replace(/\n\/\/# sourceMappingURL=.*$/, "");
const vendoredSanitizer = path.join(source, "esm/vs/base/browser/dompurify/dompurify.js");
if (await readFile(vendoredSanitizer, "utf8") !== sanitizer) {
  await writeFile(vendoredSanitizer, sanitizer);
  console.log("Aligned Monaco's vendored sanitizer with the patched npm dependency.");
}

const marker = `${version}:esm-worker-v1`;
let existing;
try { existing = await readFile(path.join(destination, "version.txt"), "utf8"); } catch {}
if (existing !== marker) {
  await mkdir(destination, { recursive: true });
  // Only the standalone plain-text worker is needed. The patched editor is
  // bundled from ESM rather than the unpatched prebuilt AMD distribution.
  const assets = path.join(source, "min/vs/assets");
  const workers = (await readdir(assets)).filter((name) => /^editor\.worker-[\w-]+\.js$/.test(name));
  if (workers.length !== 1) throw new Error("Expected one Monaco editor worker. Check the installed package layout.");
  await cp(path.join(assets, workers[0]), path.join(destination, "editor.worker.js"));
  await cp(path.join(source, "LICENSE"), path.join(destination, "LICENSE"));
  await writeFile(path.join(destination, "version.txt"), marker);
  console.log(`Prepared local Monaco ${version} worker.`);
}
