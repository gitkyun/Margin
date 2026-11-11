// One-off copy of Supabase Storage originals into Cloudflare R2.
// Copies only; never deletes or changes the originals. Safe to run again:
// files already registered in R2 are skipped. Protected by the file service
// secret (its sha256 is in public.rms_file_service).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";

const workerUrl =
  Deno.env.get("FILE_WORKER_URL") ??
  "https://margin-files.rlgus801-dad.workers.dev";

async function sha256(buffer: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const secret = req.headers.get("x-file-service") ?? "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: ok } = await admin.rpc("rms_file_service_ok", {
    p_secret: secret,
  });
  if (ok !== true) return new Response("forbidden", { status: 403 });
  const { data: list, error } = await admin.rpc("rms_file_list", {
    p_secret: secret,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const done = new Set(
    (list.r2 as { bucket: string; name: string }[]).map(
      (r) => `${r.bucket}/${r.name}`,
    ),
  );
  const result = { copied: 0, skipped: 0, failed: [] as string[] };
  for (const f of list.supabase as {
    bucket: string;
    name: string;
    size: number;
    mimetype: string;
  }[]) {
    if (done.has(`${f.bucket}/${f.name}`)) {
      result.skipped++;
      continue;
    }
    const { data: blob, error: readError } = await admin.storage
      .from(f.bucket)
      .download(f.name);
    if (readError || !blob || blob.size !== f.size) {
      result.failed.push(`${f.bucket}/${f.name.split("/").slice(1).join("/")}`);
      continue;
    }
    const body = await blob.arrayBuffer();
    const digest = await sha256(body);
    const params = new URLSearchParams({
      bucket: f.bucket,
      path: f.name,
      mimetype: f.mimetype,
      sha256: digest,
    });
    const response = await fetch(`${workerUrl}/admin/copy?${params}`, {
      method: "PUT",
      headers: { "x-file-service": secret },
      body,
    });
    if (response.ok) result.copied++;
    else
      result.failed.push(`${f.bucket}/${f.name.split("/").slice(1).join("/")}`);
  }
  return Response.json(result);
});
