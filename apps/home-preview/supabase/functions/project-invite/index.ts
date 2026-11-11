// 연구 초대 메일을 보냅니다.
// 1) 로그인한 사용자 권한으로 초대를 만들고(권한·중복·발송 한도는 DB 함수가 검사)
// 2) Resend로 메일을 보낸 뒤 3) 발송 결과를 초대 기록에 남깁니다.
// 초대 토큰 원문은 메일과 이 응답에만 있고, DB에는 SHA-256 해시만 저장합니다.
// 토큰·이메일 주소·메일 본문은 로그에 남기지 않습니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { inviteEmail, type InviteRole } from "./email.ts";
import { allowedOrigins, appUrl } from "./origins.ts";
import { sendEmail, type SendFailure } from "./resend.ts";

const origins = allowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));
const DEFAULT_FROM = "Margin <onboarding@resend.dev>";
const UUID = /^[0-9a-f-]{36}$/i;

interface InviteRecord {
  id: string;
  researchId: string;
  role: InviteRole;
  email: string;
  expiresAt: string;
  sendCount: number;
  researchName: string | null;
  invitedByName: string | null;
  emailStatus: string;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
    if (raw.length > 2048)
      return reply(400, { error: "요청을 확인해 주세요." });
    const input = JSON.parse(raw) as Record<string, unknown>;
    const resend = input.action === "resend";
    if (!resend && input.action !== "send")
      return reply(400, { error: "요청을 확인해 주세요." });
    if (resend) {
      if (typeof input.inviteId !== "string" || !UUID.test(input.inviteId))
        return reply(400, { error: "요청을 확인해 주세요." });
    } else if (
      typeof input.researchId !== "string" ||
      !UUID.test(input.researchId) ||
      typeof input.email !== "string" ||
      input.email.length > 254 ||
      (input.role !== "editor" && input.role !== "advisor")
    )
      return reply(400, { error: "이메일 주소를 확인해 주세요." });

    const url = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user)
      return reply(401, { error: "다시 로그인해 주세요." });

    // 256비트 난수 토큰. 원문은 메일 링크에만 넣습니다.
    const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256Hex(token);
    const { data, error } = resend
      ? await client.rpc("rms_project_invite_resend", {
          p_input: { id: input.inviteId, tokenHash },
        })
      : await client.rpc("rms_project_invite_create", {
          p_input: {
            researchId: input.researchId,
            email: input.email,
            role: input.role,
            tokenHash,
          },
        });
    if (error)
      return reply(
        error.code === "42501" ? 403 : error.code === "53400" ? 429 : 400,
        { error: error.message },
      );
    const invite = data as InviteRecord;
    const link = `${appUrl(Deno.env.get("APP_URL"), origin)}/join?token=${token}`;
    const message = inviteEmail({
      researchName: invite.researchName ?? "",
      inviterName: invite.invitedByName ?? "",
      role: invite.role,
      link,
      expiresAt: invite.expiresAt,
    });
    const sent = await sendEmail(
      {
        from: Deno.env.get("RESEND_FROM_EMAIL") || DEFAULT_FROM,
        to: invite.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      {
        apiKey: Deno.env.get("RESEND_API_KEY") ?? "",
        idempotencyKey: `project-invite/${invite.id}/${invite.sendCount}`,
      },
    );
    const emailStatus = sent.ok ? "sent" : "failed";
    const reason: SendFailure | null = sent.ok ? null : sent.reason;
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: recordError } = await admin.rpc(
      "rms_project_invite_email_result",
      {
        p_id: invite.id,
        p_token_hash: tokenHash,
        p_status: emailStatus,
        p_email_id: sent.ok ? sent.id : null,
        p_error: reason,
      },
    );
    if (recordError)
      console.error("project-invite: could not record email result", {
        inviteId: invite.id,
        code: recordError.code,
      });
    if (!sent.ok)
      console.error("project-invite: email not sent", {
        inviteId: invite.id,
        reason,
      });
    // 링크는 초대받은 이메일로 로그인한 사람만 쓸 수 있으므로, 메일이 가지 않았을 때
    // 초대한 사람이 직접 전할 수 있게 돌려줍니다.
    return reply(200, {
      invite: { ...invite, emailStatus },
      emailStatus,
      emailFailure: reason,
      link,
    });
  } catch {
    return reply(500, {
      error: "초대를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    });
  }
});
