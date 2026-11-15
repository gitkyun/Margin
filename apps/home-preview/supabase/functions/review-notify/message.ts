// 검토 요청 알림 메일. 담는 것은 검토 요청 제목과 검토 링크뿐입니다.
// 수정 내용·파일·피드백·학생 메모 같은 비공개 내용은 넣지 않습니다.
// 메일 클라이언트는 CSS 변수와 웹폰트를 지원하지 않으므로 초대 메일(project-invite/email.ts)과
// 같은 Montage 라이트 테마 값을 그대로 적습니다.
import { escapeHtml, oneLine } from "../project-invite/email.ts";

/** 같은 검토 요청으로 하루에 보낼 수 있는 알림 메일 수(한국 시간 하루를 8시간씩 나눠요). */
export const REVIEW_NOTIFY_DAILY_LIMIT = 3;
const WINDOW_HOURS = 24 / REVIEW_NOTIFY_DAILY_LIMIT;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NotifyInput =
  { action: "status" } | { action: "send"; requestId: string };

/** 요청 본문 검사. 잘못된 값이면 null */
export function parseNotifyInput(raw: string): NotifyInput | null {
  if (raw.length > 512) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.action === "status") return { action: "status" };
  if (
    input.action === "send" &&
    typeof input.requestId === "string" &&
    UUID.test(input.requestId)
  )
    return { action: "send", requestId: input.requestId.toLowerCase() };
  return null;
}

export interface NotifyWindow {
  /** 발송 구간 이름. 예: 2026-11-15#1 (한국 시간 하루의 두 번째 8시간) */
  slot: string;
  /** 다음 구간이 시작하는 시각(ISO). 이때부터 다시 알릴 수 있어요. */
  nextAt: string;
}

/**
 * 지금 시각이 속한 발송 구간. 같은 구간 안에서 다시 누르면 같은 idempotency 키가 되어
 * Resend가 메일을 한 번만 보내므로, DB 없이도 같은 요청은 하루 최대 3통으로 묶여요.
 */
export function notifyWindow(now: Date): NotifyWindow {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kst.toISOString().slice(0, 10);
  const index = Math.floor(kst.getUTCHours() / WINDOW_HOURS);
  const start = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate(),
    index * WINDOW_HOURS,
  );
  const next = start + WINDOW_HOURS * 60 * 60 * 1000 - KST_OFFSET_MS;
  return { slot: `${day}#${index}`, nextAt: new Date(next).toISOString() };
}

export function notifyIdempotencyKey(requestId: string, slot: string): string {
  return `review-notify/${requestId}/${slot}`;
}

export interface ReviewNotifyEmailInput {
  title: string;
  link: string;
}

export interface ReviewNotifyEmail {
  subject: string;
  html: string;
  text: string;
}

const FONT =
  "Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif";

export function reviewNotifyEmail(
  input: ReviewNotifyEmailInput,
): ReviewNotifyEmail {
  const title = oneLine(input.title, 120) || "검토 요청";
  const subject = "[Margin] 검토 요청이 있어요";
  const link = escapeHtml(input.link);
  const note =
    "학생이 지정한 교수 계정으로 로그인해야 열 수 있어요. 공유가 중지되면 링크가 열리지 않아요.";
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F8;font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(`‘${title}’ 검토 요청이 있어요.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E1E2E4;border-radius:12px;">
<tr><td style="padding:28px 28px 0;font-size:18px;line-height:26px;font-weight:700;color:#0066FF;letter-spacing:-0.01em;">Margin</td></tr>
<tr><td style="padding:20px 28px 0;font-size:22px;line-height:32px;font-weight:700;color:#171719;letter-spacing:-0.02em;">검토 요청이 있어요</td></tr>
<tr><td style="padding:16px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E1E2E4;border-bottom:1px solid #E1E2E4;">
<tr><td style="padding:14px 0;color:#171719;font-size:15px;line-height:24px;font-weight:600;word-break:break-word;">${escapeHtml(title)}</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 28px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#0066FF;">
<a href="${link}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;line-height:22px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">검토 열기</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 28px 0;font-size:13px;line-height:20px;color:#5A5C63;">${escapeHtml(note)}</td></tr>
<tr><td style="padding:12px 28px 28px;font-size:13px;line-height:20px;color:#5A5C63;">버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.<br><a href="${link}" style="color:#0066FF;word-break:break-all;">${link}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    "Margin · 검토 요청이 있어요",
    "",
    title,
    "",
    "검토 열기:",
    input.link,
    "",
    note,
  ].join("\n");
  return { subject, html, text };
}
