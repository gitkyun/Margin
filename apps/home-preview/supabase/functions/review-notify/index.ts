// 검토 요청 알림 메일. 학생이 검토 링크를 만든 뒤 직접 누를 때만 보냅니다(링크 생성 ≠ 전송).
// - 보낼 수 있는 사람: 그 검토 요청의 연구를 편집할 수 있는 사람(소유 학생·활성 참여자). 교수는 안 됨.
// - 받는 사람: 그 검토 요청에 지정된 교수 이메일 하나뿐. 요청 본문에서 주소를 받지 않습니다.
// - 내용: 검토 요청 제목과 검토 링크뿐. 비공개 기록은 넣지 않습니다.
// - 남용 방지: 공유 중인 요청만, 한국 시간 8시간 구간마다 같은 idempotency 키 → 하루 최대 3통.
// 발송 모듈·주소 도우미는 project-invite와 같은 것을 씁니다. 이메일 주소·본문·키는 로그에 남기지 않습니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { allowedOrigins, appUrl } from "../project-invite/origins.ts";
import { sendEmail } from "../project-invite/resend.ts";
import {
  notifyIdempotencyKey,
  notifyWindow,
  parseNotifyInput,
  reviewNotifyEmail,
} from "./message.ts";

const origins = allowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));
const DEFAULT_FROM = "Margin <onboarding@resend.dev>";

interface RequestRow {
  id: string;
  research_id: string;
  professor_id: string;
  professor_email: string;
  title: string;
  status: string;
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
  // code는 화면이 문구를 고르는 열쇠, error는 사람이 읽을 기본 문장입니다.
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers });
  const fail = (status: number, code: string, error: string) =>
    reply(status, { code, error });
  if (!origins.includes(origin))
    return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return fail(405, "bad_request", "요청 방식을 확인해 주세요.");
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    return fail(401, "unauthorized", "다시 로그인해 주세요.");
  try {
    const input = parseNotifyInput(await req.text());
    if (!input) return fail(400, "bad_request", "요청을 확인해 주세요.");

    const url = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user)
      return fail(401, "unauthorized", "다시 로그인해 주세요.");

    const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (input.action === "status")
      return reply(200, { configured: apiKey.length > 0 });

    // 로그인한 사람 권한으로 읽어요. 읽을 수 없는 요청이면 행이 오지 않습니다(RLS).
    const { data: row, error: readError } = await client
      .from("rms_review_requests")
      .select("id,research_id,professor_id,professor_email,title,status")
      .eq("id", input.requestId)
      .maybeSingle<RequestRow>();
    if (readError || !row)
      return fail(404, "not_found", "검토 요청을 찾을 수 없습니다.");
    // 교수도 이 행을 읽을 수 있으므로, 연구 편집 권한(소유자·활성 참여자)을 따로 확인합니다.
    const { data: canEdit, error: editError } = await client.rpc(
      "rms_can_edit_research",
      { p_id: row.research_id },
    );
    if (editError || canEdit !== true || row.professor_id === auth.user.id)
      return fail(
        403,
        "forbidden",
        "이 검토 요청의 알림을 보낼 권한이 없습니다.",
      );
    if (row.status !== "shared")
      return fail(409, "not_shared", "공유 중인 검토 요청만 알릴 수 있습니다.");
    if (!apiKey)
      return fail(
        503,
        "not_configured",
        "메일 발송이 아직 준비되지 않았습니다.",
      );

    const window = notifyWindow(new Date());
    const link = `${appUrl(Deno.env.get("APP_URL"), origin)}/reviews/${row.id}`;
    const message = reviewNotifyEmail({ title: row.title, link });
    const sent = await sendEmail(
      {
        from: Deno.env.get("RESEND_FROM_EMAIL") || DEFAULT_FROM,
        to: row.professor_email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      { apiKey, idempotencyKey: notifyIdempotencyKey(row.id, window.slot) },
    );
    if (!sent.ok) {
      console.error("review-notify: email not sent", {
        requestId: row.id,
        reason: sent.reason,
      });
      return fail(
        sent.reason === "rate_limited" ? 429 : 502,
        sent.reason,
        "메일 발송을 요청하지 못했습니다.",
      );
    }
    // ‘요청함’까지만 알 수 있어요. 실제 도착 여부는 이 응답으로 알 수 없습니다.
    return reply(200, {
      status: "requested",
      requestedAt: new Date().toISOString(),
      nextAt: window.nextAt,
    });
  } catch {
    return fail(500, "unavailable", "잠시 뒤 다시 시도해 주세요.");
  }
});
