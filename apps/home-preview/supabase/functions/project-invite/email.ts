// 연구 초대 메일 본문. 메일 클라이언트는 CSS 변수와 웹폰트를 지원하지 않으므로
// Montage 라이트 테마 값을 그대로 적습니다(브랜드 블루 #0066FF, 본문 #171719, 보조 #5A5C63, 선 #E1E2E4).
export type InviteRole = "editor" | "advisor";

export interface InviteEmailInput {
  researchName: string;
  inviterName: string;
  role: InviteRole;
  link: string;
  expiresAt: string;
}

export interface InviteEmail {
  subject: string;
  html: string;
  text: string;
}

const ROLE_LABEL: Record<InviteRole, string> = {
  editor: "공동연구자",
  advisor: "지도교수",
};

const ROLE_NOTE: Record<InviteRole, string> = {
  editor:
    "수락하면 이 연구의 공동 기록을 함께 보고 편집할 수 있어요. 다른 참여자의 개인 메모와 AI 대화는 보이지 않아요.",
  advisor:
    "수락하면 마진 계정이 열리고, 학생이 검토를 요청한 항목과 연구 방향만 볼 수 있어요. 연구의 다른 기록은 보이지 않아요.",
};

const FONT =
  "Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 제목·본문에 들어가는 이름에서 줄바꿈과 제어 문자를 빼고 길이를 줄입니다. */
export function oneLine(value: string, max: number): string {
  const flat = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function inviteEmail(input: InviteEmailInput): InviteEmail {
  const research = oneLine(input.researchName, 80) || "이름 없는 연구";
  const inviter = oneLine(input.inviterName, 40) || "마진 사용자";
  const role = ROLE_LABEL[input.role];
  const note = ROLE_NOTE[input.role];
  const expiry = formatExpiry(input.expiresAt);
  const expiryLine = expiry
    ? `이 초대는 ${expiry}(한국 시간)까지 수락할 수 있어요.`
    : "이 초대는 7일 동안 수락할 수 있어요.";
  const subject = "[Margin] 연구 프로젝트에 초대되었습니다";
  const link = escapeHtml(input.link);
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;width:88px;color:#5A5C63;font-size:14px;line-height:22px;vertical-align:top;">${label}</td><td style="padding:6px 0;color:#171719;font-size:14px;line-height:22px;font-weight:600;word-break:break-word;">${escapeHtml(value)}</td></tr>`;

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F8;font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(`${inviter}님이 ‘${research}’ 연구에 ${role}로 초대했어요.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E1E2E4;border-radius:12px;">
<tr><td style="padding:28px 28px 0;font-size:18px;line-height:26px;font-weight:700;color:#0066FF;letter-spacing:-0.01em;">Margin</td></tr>
<tr><td style="padding:20px 28px 0;font-size:22px;line-height:32px;font-weight:700;color:#171719;letter-spacing:-0.02em;">연구에 초대받았어요</td></tr>
<tr><td style="padding:8px 28px 0;font-size:15px;line-height:24px;color:#37383C;">${escapeHtml(inviter)}님이 아래 연구에 함께하자고 초대했어요.</td></tr>
<tr><td style="padding:20px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E1E2E4;border-bottom:1px solid #E1E2E4;">
<tr><td style="padding:10px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("연구", research)}
${row("초대한 사람", inviter)}
${row("역할", role)}
</table></td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 28px 0;font-size:14px;line-height:22px;color:#5A5C63;">${escapeHtml(note)}</td></tr>
<tr><td style="padding:24px 28px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#0066FF;">
<a href="${link}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;line-height:22px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">초대 수락</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 28px 0;font-size:13px;line-height:20px;color:#5A5C63;">${escapeHtml(expiryLine)} 초대받은 이메일로 로그인하거나 가입해야 수락할 수 있어요.</td></tr>
<tr><td style="padding:12px 28px 0;font-size:13px;line-height:20px;color:#5A5C63;">버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.<br><a href="${link}" style="color:#0066FF;word-break:break-all;">${link}</a></td></tr>
<tr><td style="padding:24px 28px 28px;"><div style="border-top:1px solid #E1E2E4;padding-top:16px;font-size:12px;line-height:18px;color:#878A93;">요청한 적 없는 초대라면 이 메일을 무시해도 돼요. 수락하지 않으면 아무 일도 일어나지 않아요.</div></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    "Margin · 연구에 초대받았어요",
    "",
    `${inviter}님이 아래 연구에 함께하자고 초대했어요.`,
    "",
    `연구: ${research}`,
    `초대한 사람: ${inviter}`,
    `역할: ${role}`,
    "",
    note,
    "",
    "초대 수락:",
    input.link,
    "",
    `${expiryLine} 초대받은 이메일로 로그인하거나 가입해야 수락할 수 있어요.`,
    "",
    "요청한 적 없는 초대라면 이 메일을 무시해도 돼요. 수락하지 않으면 아무 일도 일어나지 않아요.",
  ].join("\n");

  return { subject, html, text };
}
