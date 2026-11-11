import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

const user = "11111111-1111-4111-8111-111111111111";
const research = "55555555-5555-4555-8555-555555555555";
const file = "99999999-9999-4999-8999-999999999999";
const path = `${user}/${research}/${file}.pdf`;
const origin = "https://margin-research.pages.dev";

function memoryR2() {
  const objects = new Map();
  const uploads = new Map();
  return {
    objects,
    async createMultipartUpload(key, options) {
      const uploadId = `u${uploads.size + 1}`;
      uploads.set(uploadId, { key, options, parts: new Map() });
      return { uploadId };
    },
    resumeMultipartUpload(key, uploadId) {
      const u = uploads.get(uploadId);
      return {
        async uploadPart(n, body) {
          u.parts.set(n, new Uint8Array(body));
          return { partNumber: n, etag: `e${n}` };
        },
        async complete(parts) {
          const chunks = parts.map((p) => u.parts.get(p.partNumber));
          const size = chunks.reduce((a, c) => a + c.length, 0);
          objects.set(key, {
            size,
            body: Buffer.concat(chunks),
            httpMetadata: u.options.httpMetadata,
            customMetadata: {},
          });
        },
        async abort() {
          uploads.delete(uploadId);
        },
      };
    },
    async head(key) {
      return objects.get(key) ?? null;
    },
    async get(key) {
      const o = objects.get(key);
      return o ? { ...o, body: o.body } : null;
    },
    async put(key, body, options) {
      objects.set(key, {
        size: body.byteLength,
        body: Buffer.from(body),
        ...options,
      });
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

function setup({ canUpload = true, canRead = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const name = String(url).split("/rpc/")[1];
    calls.push({
      name,
      auth: init.headers.Authorization,
      body: JSON.parse(init.body ?? "null"),
    });
    const status = init.headers.Authorization === "Bearer expired" ? 401 : 200;
    const value =
      name === "rms_file_can_upload"
        ? canUpload
        : name === "rms_can_read_file"
          ? canRead
          : name === "rms_file_is_service"
            ? init.headers.apikey === "service-key"
            : null;
    if (value === null)
      return new Response(null, { status: status === 200 ? 204 : status });
    return new Response(JSON.stringify(value), { status });
  };
  const env = {
    FILES: memoryR2(),
    SUPABASE_URL: "https://db.example.test",
    SUPABASE_ANON_KEY: "publishable",
    FILE_SERVICE_SECRET: "good-secret",
  };
  return { env, calls };
}
const req = (p, init = {}) =>
  new Request(`https://files.example.test${p}`, {
    ...init,
    headers: {
      Origin: origin,
      Authorization: "Bearer token",
      ...(init.headers ?? {}),
    },
  });

test("uploads in parts, registers the file, and serves it back to a reader", async () => {
  const { env, calls } = setup();
  const content = new Uint8Array(25 * 1024 * 1024).fill(7);
  const start = await worker.fetch(
    req("/upload/start", {
      method: "POST",
      body: JSON.stringify({
        bucket: "research-files",
        path,
        size: content.length,
        mimeType: "application/pdf",
      }),
    }),
    env,
  );
  assert.equal(start.status, 200);
  assert.equal(start.headers.get("Access-Control-Allow-Origin"), origin);
  const { uploadId, partSize } = await start.json();
  const parts = [];
  for (let i = 0, n = 1; i < content.length; i += partSize, n++) {
    const q = new URLSearchParams({
      bucket: "research-files",
      path,
      uploadId,
      part: String(n),
    });
    const r = await worker.fetch(
      req(`/upload/part?${q}`, {
        method: "PUT",
        body: content.slice(i, i + partSize),
      }),
      env,
    );
    assert.equal(r.status, 200);
    parts.push(await r.json());
  }
  assert.equal(parts.length, 2);
  const done = await worker.fetch(
    req("/upload/complete", {
      method: "POST",
      body: JSON.stringify({
        bucket: "research-files",
        path,
        uploadId,
        parts,
        size: content.length,
        mimeType: "application/pdf",
      }),
    }),
    env,
  );
  assert.equal(done.status, 200);
  const reg = calls.find((c) => c.name === "rms_file_register");
  assert.equal(reg.body.p_input.size, content.length);
  assert.equal(
    reg.auth,
    undefined,
    "registration uses the secret, not a user token",
  );
  const got = await worker.fetch(
    req(`/file?${new URLSearchParams({ bucket: "research-files", path })}`),
    env,
  );
  assert.equal(got.status, 200);
  assert.equal(got.headers.get("Cache-Control"), "private, no-store");
});

test("refuses uploads over 500MB, without permission, or without login", async () => {
  const { env } = setup({ canUpload: false });
  const body = (size) =>
    JSON.stringify({
      bucket: "research-files",
      path,
      size,
      mimeType: "application/pdf",
    });
  assert.equal(
    (
      await worker.fetch(
        req("/upload/start", {
          method: "POST",
          body: body(500 * 1024 * 1024 + 1),
        }),
        env,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await worker.fetch(
        req("/upload/start", { method: "POST", body: body(10) }),
        env,
      )
    ).status,
    403,
  );
  const anon = new Request("https://files.example.test/upload/start", {
    method: "POST",
    headers: { Origin: origin },
    body: body(10),
  });
  assert.equal((await worker.fetch(anon, env)).status, 401);
  assert.equal(
    (
      await worker.fetch(
        req("/upload/start", {
          method: "POST",
          body: body(10),
          headers: { Authorization: "Bearer expired" },
        }),
        env,
      )
    ).status,
    401,
  );
});

test("readers without permission get 403; files not yet copied get NOT_IN_R2", async () => {
  const denied = setup({ canRead: false });
  const q = new URLSearchParams({ bucket: "research-files", path });
  assert.equal((await worker.fetch(req(`/file?${q}`), denied.env)).status, 403);
  const { env } = setup();
  const missing = await worker.fetch(req(`/file?${q}`), env);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "NOT_IN_R2");
});

test("blocks other sites and requires the service secret for copies", async () => {
  const { env } = setup();
  const evil = new Request("https://files.example.test/file", {
    headers: { Origin: "https://evil.example" },
  });
  assert.equal((await worker.fetch(evil, env)).status, 403);
  const copy = (secret) =>
    req(
      `/admin/copy?${new URLSearchParams({ bucket: "research-files", path, mimetype: "application/pdf", sha256: "x" })}`,
      { method: "PUT", body: "x", headers: { "x-service-key": secret } },
    );
  assert.equal((await worker.fetch(copy("publishable"), env)).status, 403);
  assert.equal(
    (await worker.fetch(copy("service-key"), env)).status,
    422,
    "checksum mismatch is refused",
  );
  const verify = (secret) =>
    req("/admin/verify", { headers: { "x-file-service": secret } });
  assert.equal((await worker.fetch(verify("bad"), env)).status, 403);
});
