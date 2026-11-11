// One-off copy of Supabase Storage originals into Cloudflare R2.
// Copies only; never deletes or changes the originals. Safe to run again:
// files already registered in R2 are skipped.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";

const workerUrl =
  Deno.env.get("FILE_WORKER_URL") ??
  "https://margin-files.rlgus801-dad.workers.dev";

async function sha256(buffer: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Copies only, skips files already in R2, and returns counts, so calling it
// again is harmless. The Worker accepts the copy only after Supabase confirms
// the service role key.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: list, error } = await admin.rpc("rms_file_list_service");
  if (error) return Response.json({ error: "list failed" }, { status: 500 });
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
    const label = `${f.bucket}/${f.name.split("/").slice(1).join("/")}`;
    if (done.has(`${f.bucket}/${f.name}`)) {
      result.skipped++;
      continue;
    }
    const { data: blob, error: readError } = await admin.storage
      .from(f.bucket)
      .download(f.name);
    if (readError || !blob || blob.size !== f.size) {
      result.failed.push(label);
      continue;
    }
    const body = await blob.arrayBuffer();
    const params = new URLSearchParams({
      bucket: f.bucket,
      path: f.name,
      mimetype: f.mimetype,
      sha256: await sha256(body),
    });
    const response = await fetch(`${workerUrl}/admin/copy?${params}`, {
      method: "PUT",
      headers: { "x-service-key": serviceKey },
      body,
    });
    if (response.ok) result.copied++;
    else result.failed.push(label);
  }
  return Response.json(result);
});
