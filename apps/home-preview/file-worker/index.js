// Margin file Worker: stores research files in Cloudflare R2 (binding FILES).
// Login and permissions stay in Supabase: every browser request carries the
// user's Supabase access token, and permission RPCs run as that user.
// The Worker writes the file registry with FILE_SERVICE_SECRET (a Worker
// secret; only its sha256 is in public.rms_file_service). /admin/* accepts
// only the Supabase service role key, confirmed by Supabase itself.
const MAX_SIZE = 500 * 1024 * 1024;
const PART_SIZE = 20 * 1024 * 1024;
const MIME = {
  "research-files": ["application/pdf"],
  "research-private": [
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "application/pdf",
    "text/plain",
    "text/markdown",
  ],
};
const ORIGINS = [
  "https://margin-research.pages.dev",
  "https://rms-classroom-demo.pages.dev",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4175",
  "http://127.0.0.1:4175",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const allowed = [
      ...ORIGINS,
      ...(env.ALLOWED_ORIGINS ?? "").split(",").map((v) => v.trim()),
    ].filter(Boolean);
    const cors = allowed.includes(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization,content-type",
          "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
          "Access-Control-Expose-Headers": "content-length,content-type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        }
      : { Vary: "Origin" };
    // Browsers from other sites are refused; server calls send no Origin.
    if (origin && !allowed.includes(origin))
      return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    const json = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    const fail = (status, code, message) =>
      json(status, { error: { code, message } });
    try {
      return await route(request, env, json, fail, cors);
    } catch (error) {
      console.error(error);
      return fail(500, "INTERNAL", "파일 요청을 처리하지 못했어요.");
    }
  },
};

async function rpc(env, name, args, token) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    const error = new Error(`rpc ${name} ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const validKey = (bucket, path) =>
  Object.hasOwn(MIME, bucket) &&
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|webm|mp4|ogg|txt|md)$/.test(
    path ?? "",
  );

async function hex(buffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function route(request, env, json, fail, cors) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ----- server-only -----
  // /admin/copy: called by the Supabase function file-copy-to-r2 with the
  // service role key, which Supabase itself confirms (rms_file_is_service).
  if (path.startsWith("/admin/")) {
    const serviceKey = request.headers.get("x-service-key") ?? "";
    let trusted = false;
    if (serviceKey) {
      const r = await fetch(
        `${env.SUPABASE_URL}/rest/v1/rpc/rms_file_is_service`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            ...(serviceKey.startsWith("eyJ")
              ? { Authorization: `Bearer ${serviceKey}` }
              : {}),
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      ).catch(() => null);
      trusted = !!r?.ok && (await r.json()) === true;
    }
    if (!trusted) return fail(403, "FORBIDDEN", "접근할 수 없어요.");
    if (path === "/admin/copy" && request.method === "PUT") {
      const bucket = url.searchParams.get("bucket");
      const name = url.searchParams.get("path");
      const mimetype = url.searchParams.get("mimetype") ?? "";
      const expected = url.searchParams.get("sha256") ?? "";
      if (!validKey(bucket, name) || !MIME[bucket].includes(mimetype))
        return fail(400, "INVALID", "경로를 확인해 주세요.");
      const body = await request.arrayBuffer();
      const sha256 = await hex(body);
      if (sha256 !== expected)
        return fail(422, "CHECKSUM", "복사한 내용이 원본과 달라요.");
      await env.FILES.put(`${bucket}/${name}`, body, {
        httpMetadata: { contentType: mimetype },
        customMetadata: { sha256, source: "copied_from_supabase" },
      });
      const head = await env.FILES.head(`${bucket}/${name}`);
      if (!head || head.size !== body.byteLength)
        return fail(500, "VERIFY", "복사 결과를 확인하지 못했어요.");
      await rpc(env, "rms_file_register", {
        p_secret: env.FILE_SERVICE_SECRET,
        p_input: {
          bucket,
          name,
          size: body.byteLength,
          mimetype,
          sha256,
          source: "copied_from_supabase",
          createdBy: name.split("/")[0],
        },
      });
      return json(200, { bucket, name, size: body.byteLength, sha256 });
    }
    if (path === "/admin/verify" && request.method === "GET") {
      const list = await rpc(env, "rms_file_list", {
        p_secret: env.FILE_SERVICE_SECRET,
      });
      const rows = [];
      for (const s of list.supabase) {
        const head = await env.FILES.head(`${s.bucket}/${s.name}`);
        const reg = list.r2.find(
          (r) => r.bucket === s.bucket && r.name === s.name,
        );
        rows.push({
          key: `${s.bucket}/${s.name.split("/").slice(1).join("/")}`,
          sizeMatches: !!head && head.size === s.size && reg?.size === s.size,
          sha256Matches: !!head && head.customMetadata?.sha256 === reg?.sha256,
        });
      }
      return json(200, {
        supabaseFiles: list.supabase.length,
        r2Registered: list.r2.length,
        missingOrDifferent: rows.filter(
          (r) => !r.sizeMatches || !r.sha256Matches,
        ),
      });
    }
    return fail(404, "NOT_FOUND", "요청을 확인해 주세요.");
  }

  // ----- user requests (Supabase access token) -----
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return fail(401, "UNAUTHENTICATED", "다시 로그인해 주세요.");
  const deny = (error) =>
    error?.status === 401
      ? fail(401, "UNAUTHENTICATED", "다시 로그인해 주세요.")
      : fail(403, "FORBIDDEN", "이 파일에 접근할 수 없어요.");

  if (path === "/file" && request.method === "GET") {
    const bucket = url.searchParams.get("bucket");
    const name = url.searchParams.get("path");
    if (!validKey(bucket, name))
      return fail(400, "INVALID", "경로를 확인해 주세요.");
    let ok = false;
    try {
      ok = await rpc(env, "rms_can_read_file", { p_path: name }, token);
    } catch (error) {
      return deny(error);
    }
    if (ok !== true) return deny();
    const object = await env.FILES.get(`${bucket}/${name}`);
    if (!object)
      return fail(404, "NOT_IN_R2", "새 저장소에 아직 없는 파일이에요.");
    return new Response(object.body, {
      headers: {
        ...cors,
        "Content-Type":
          object.httpMetadata?.contentType ?? "application/octet-stream",
        "Content-Length": String(object.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (path === "/upload/start" && request.method === "POST") {
    const input = await request.json();
    const { bucket, path: name, size, mimeType } = input ?? {};
    if (!validKey(bucket, name) || !MIME[bucket].includes(mimeType))
      return fail(400, "INVALID", "올릴 수 없는 파일 형식이에요.");
    if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE)
      return fail(413, "TOO_LARGE", "500MB 이하 파일만 올릴 수 있어요.");
    let ok = false;
    try {
      ok = await rpc(
        env,
        "rms_file_can_upload",
        { p_bucket: bucket, p_name: name },
        token,
      );
    } catch (error) {
      return deny(error);
    }
    if (ok !== true) return deny();
    const upload = await env.FILES.createMultipartUpload(`${bucket}/${name}`, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { size: String(size) },
    });
    return json(200, { uploadId: upload.uploadId, partSize: PART_SIZE });
  }

  if (path === "/upload/part" && request.method === "PUT") {
    const bucket = url.searchParams.get("bucket");
    const name = url.searchParams.get("path");
    const uploadId = url.searchParams.get("uploadId") ?? "";
    const part = Number(url.searchParams.get("part"));
    if (
      !validKey(bucket, name) ||
      !uploadId ||
      !Number.isInteger(part) ||
      part < 1 ||
      part > 10000
    )
      return fail(400, "INVALID", "요청을 확인해 주세요.");
    let ok = false;
    try {
      ok = await rpc(
        env,
        "rms_file_can_upload",
        { p_bucket: bucket, p_name: name },
        token,
      );
    } catch (error) {
      return deny(error);
    }
    if (ok !== true) return deny();
    const body = await request.arrayBuffer();
    if (!body.byteLength || body.byteLength > PART_SIZE)
      return fail(400, "INVALID", "조각 크기를 확인해 주세요.");
    const upload = env.FILES.resumeMultipartUpload(
      `${bucket}/${name}`,
      uploadId,
    );
    const uploaded = await upload.uploadPart(part, body);
    return json(200, { partNumber: uploaded.partNumber, etag: uploaded.etag });
  }

  if (
    (path === "/upload/complete" || path === "/upload/abort") &&
    request.method === "POST"
  ) {
    const input = await request.json();
    const { bucket, path: name, uploadId, parts, size, mimeType } = input ?? {};
    if (!validKey(bucket, name) || typeof uploadId !== "string")
      return fail(400, "INVALID", "요청을 확인해 주세요.");
    let ok = false;
    try {
      ok = await rpc(
        env,
        "rms_file_can_upload",
        { p_bucket: bucket, p_name: name },
        token,
      );
    } catch (error) {
      return deny(error);
    }
    if (ok !== true) return deny();
    const key = `${bucket}/${name}`;
    const upload = env.FILES.resumeMultipartUpload(key, uploadId);
    if (path === "/upload/abort") {
      await upload.abort().catch(() => {});
      return json(200, { aborted: true });
    }
    if (!Array.isArray(parts) || !parts.length)
      return fail(400, "INVALID", "요청을 확인해 주세요.");
    await upload.complete(parts);
    const head = await env.FILES.head(key);
    if (
      !head ||
      head.size !== size ||
      size > MAX_SIZE ||
      head.httpMetadata?.contentType !== mimeType
    ) {
      await env.FILES.delete(key);
      return fail(
        422,
        "SIZE_MISMATCH",
        "파일이 끝까지 올라가지 않았어요. 다시 시도해 주세요.",
      );
    }
    await rpc(env, "rms_file_register", {
      p_secret: env.FILE_SERVICE_SECRET,
      p_input: {
        bucket,
        name,
        size,
        mimetype: mimeType,
        source: "upload",
        createdBy: name.split("/")[0],
      },
    });
    return json(200, { stored: true, size });
  }

  if (path === "/purge" && request.method === "POST") {
    const { researchId } = (await request.json()) ?? {};
    if (!/^[0-9a-f-]{36}$/.test(researchId ?? ""))
      return fail(400, "INVALID", "요청을 확인해 주세요.");
    const user = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!user.ok) return fail(401, "UNAUTHENTICATED", "다시 로그인해 주세요.");
    const { id } = await user.json();
    const keys = await rpc(env, "rms_file_purge_list", {
      p_secret: env.FILE_SERVICE_SECRET,
      p_research: researchId,
      p_user: id,
    });
    for (const key of keys) {
      if (key.split("/")[2] !== researchId) continue;
      await env.FILES.delete(key);
      await rpc(env, "rms_file_unregister", {
        p_secret: env.FILE_SERVICE_SECRET,
        p_key: key,
      });
    }
    return json(200, { deleted: keys.length });
  }

  return fail(404, "NOT_FOUND", "요청을 확인해 주세요.");
}
