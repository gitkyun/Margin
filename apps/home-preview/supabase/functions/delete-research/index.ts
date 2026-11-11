import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { allowedOrigins } from "./origins.ts";
const origins = allowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!origins.includes(origin))
    return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply(405, { error: "요청 방식을 확인해 주세요." });
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    return reply(401, { error: "다시 로그인해 주세요." });
  try {
    const raw = await req.text();
    if (raw.length > 4096)
      return reply(400, { error: "요청을 확인해 주세요." });
    const input = JSON.parse(raw);
    if (
      !/^[0-9a-f-]{36}$/i.test(input.researchId ?? "") ||
      typeof input.confirmationName !== "string" ||
      !input.confirmationName ||
      input.confirmationName.length > 300
    )
      return reply(400, { error: "연구 이름을 확인해 주세요." });
    const url = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user)
      return reply(401, { error: "다시 로그인해 주세요." });
    const { data: job, error } = await client.rpc("rms_purge_research", {
      p_input: input,
    });
    if (error)
      return reply(error.code === "42501" ? 403 : 400, {
        error: error.message,
      });
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    for (const bucket of ["research-files", "research-private"]) {
      const paths = (job.files as { bucket: string; path: string }[])
        .filter(
          (f) =>
            f.bucket === bucket && f.path.split("/")[1] === input.researchId,
        )
        .map((f) => f.path);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage
          .from(bucket)
          .remove(paths.slice(i, i + 100));
        if (error)
          return reply(503, {
            error:
              "기록은 삭제했지만 파일 정리가 끝나지 않았습니다. 휴지통에서 다시 시도해 주세요.",
            retryable: true,
          });
      }
    }
    // Files stored in Cloudflare R2: the file Worker deletes only the keys
    // listed in this owner's deletion job.
    const workerUrl =
      Deno.env.get("FILE_WORKER_URL") ??
      "https://margin-files.rlgus801-dad.workers.dev";
    const purge = await fetch(`${workerUrl}/purge`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ researchId: input.researchId }),
    }).catch(() => null);
    if (!purge?.ok)
      return reply(503, {
        error:
          "기록은 삭제했지만 파일 정리가 끝나지 않았습니다. 휴지통에서 다시 시도해 주세요.",
        retryable: true,
      });
    const { error: finishError } = await admin
      .from("rms_deletion_jobs")
      .update({ completed_at: new Date().toISOString(), files: [] })
      .eq("research_id", input.researchId)
      .eq("owner_id", auth.user.id);
    if (finishError)
      return reply(503, {
        error: "삭제 완료를 확인하지 못했습니다. 다시 시도해 주세요.",
        retryable: true,
      });
    return reply(200, { deleted: true });
  } catch {
    return reply(500, {
      error: "삭제를 완료하지 못했습니다. 다시 시도해 주세요.",
    });
  }
});
