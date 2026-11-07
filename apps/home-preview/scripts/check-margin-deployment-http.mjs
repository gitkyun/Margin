// Public HTTP contract only. This does not execute the app or authenticate users.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const origin = process.env.DEPLOYMENT_ORIGIN ?? "https://margin-research.pages.dev";
const deploymentId = process.argv[2];
if (!deploymentId) throw new Error("Pass the successful Pages deployment ID.");
const built = new URL("../dist/client/", import.meta.url);
const index = await readFile(new URL("index.html", built));
const markup = index.toString();
const js = markup.match(/src="([^"]+\.js)"/)?.[1];
const css = markup.match(/href="([^"]+\.css)"/)?.[1];
if (!js || !css) throw new Error("Missing public entry assets.");
const paths = ["/", "/login", "/r", "/r/00000000-0000-4000-8000-000000000000/writing", "/features", "/pricing", "/guide", "/privacy", js, css, "/fonts/Pretendard-Regular.woff", "/favicon.svg", "/brand/symbol-blue.svg", "/brand/symbol-white.svg", "/brand/wordmark-blue.svg", "/brand/wordmark-white.svg", ...Object.keys(JSON.parse(await readFile(new URL("../../../.local/pages-upload/manifest.json", import.meta.url), "utf8"))).filter(p => p.startsWith("/brand/mascot/"))];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const checks = [];
for (const path of paths) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  const bytes = Buffer.from(await response.arrayBuffer());
  const isPage = paths.indexOf(path) < 8;
  const expected = isPage ? index : await readFile(new URL(path.slice(1), built));
  const matches = hash(bytes) === hash(expected);
  const policy = response.headers.get("permissions-policy");
  checks.push({ path, status: response.status, bytes: bytes.length, matchesBuild: matches, contentType: response.headers.get("content-type"), ...(isPage ? { permissionsPolicy: policy } : {}) });
  if (!response.ok || !matches) throw new Error(`Public build mismatch at ${path}`);
  if (isPage && !policy?.includes("microphone=(self)")) throw new Error("Recording permission is blocked by deployment headers.");
}
await writeFile(new URL("../../../docs/development/deployment-http-margin-research-20261106.json", import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), url: origin, deploymentId, scope: "HTTP resources only, not a browser UI or authenticated flow check", checks }, null, 2) + "\n");
console.log(JSON.stringify({ deploymentId, checks: checks.length, matchesBuild: true, recordingPolicy: "microphone=(self)", scope: "HTTP only" }));
