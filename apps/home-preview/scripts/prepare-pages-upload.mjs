// Prepares assets for the Cloudflare Pages Direct Upload API. Excludes private files.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname } from "node:path";
const base = new URL("../dist/client/", import.meta.url),
  out = new URL("../../../.local/pages-upload/", import.meta.url);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".ttf": "font/ttf",
};
const manifest = {},
  assets = [];
async function walk(dir, rel = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = rel + entry.name;
    if (entry.isDirectory())
      await walk(new URL(entry.name + "/", dir), path + "/");
    else {
      if (["_headers", "_redirects"].includes(path)) continue;
      // Preserve supplied originals locally; publish only the assets used by the app.
      if (path.startsWith("brand/source-svg/") || path === "brand/sources.json") continue;
      if (
        path.includes(".env") ||
        path.includes("local.json") ||
        path.endsWith(".map")
      )
        throw new Error("Private/debug file in build");
      const bytes = await readFile(new URL(entry.name, dir));
      if (bytes.length > 25 * 1024 * 1024) throw new Error("Asset too large");
      const key = createHash("sha256")
        .update(bytes)
        .update(extname(path))
        .digest("hex")
        .slice(0, 32);
      manifest["/" + path] = key;
      assets.push({
        key,
        value: bytes.toString("base64"),
        base64: true,
        metadata: {
          contentType: types[extname(path)] ?? "text/plain; charset=utf-8",
        },
      });
    }
  }
}
await walk(base);
await mkdir(out, { recursive: true, mode: 0o700 });
await writeFile(new URL("manifest.json", out), JSON.stringify(manifest));
const batches = [];
let batch = [],
  size = 0;
for (const a of assets) {
  const n = a.value.length;
  if (batch.length && size + n > 10 * 1024 * 1024) {
    batches.push(batch);
    batch = [];
    size = 0;
  }
  batch.push(a);
  size += n;
}
if (batch.length) batches.push(batch);
for (let i = 0; i < batches.length; i++)
  await writeFile(new URL(`batch-${i}.json`, out), JSON.stringify(batches[i]));
await writeFile(
  new URL("deployment.json", out),
  JSON.stringify({
    manifest,
    headers: await readFile(new URL("_headers", base), "utf8"),
    redirects: await readFile(new URL("_redirects", base), "utf8"),
  }),
);
console.log(
  JSON.stringify({
    files: assets.length,
    batches: batches.length,
    out: out.pathname,
  }),
);
