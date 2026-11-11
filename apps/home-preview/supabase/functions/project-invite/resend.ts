// Resend 메일 발송(https://resend.com/docs/api-reference/emails/send-email).
// 결과에는 사용자에게 보여 줄 수 있는 짧은 사유 코드만 담고, 응답 본문·주소·키는 남기지 않습니다.
export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendFailure =
  | "not_configured"
  | "rate_limited"
  | "sender_not_verified"
  | "rejected"
  | "unavailable";

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: SendFailure };

export interface SendOptions {
  apiKey: string;
  /** 같은 발송을 다시 시도해도 메일이 두 번 가지 않게 하는 키(초대 id + 발송 회차). */
  idempotencyKey: string;
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  attempts?: number;
}

const ENDPOINT = "https://api.resend.com/emails";
const RETRY_DELAYS_MS = [400, 1200];

function reasonFor(status: number): SendFailure {
  if (status === 429) return "rate_limited";
  // 403: 인증되지 않은 발신 도메인이거나, 테스트 발신 주소로 계정 주인 외의 주소에 보낸 경우
  if (status === 403) return "sender_not_verified";
  if (status === 401) return "not_configured";
  if (status >= 500) return "unavailable";
  return "rejected";
}

export async function sendEmail(
  email: OutgoingEmail,
  options: SendOptions,
): Promise<SendResult> {
  if (!options.apiKey) return { ok: false, reason: "not_configured" };
  const fetcher = options.fetcher ?? fetch;
  const wait =
    options.wait ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const attempts = options.attempts ?? RETRY_DELAYS_MS.length + 1;
  let reason: SendFailure = "unavailable";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(RETRY_DELAYS_MS[attempt - 1] ?? 1200);
    try {
      const response = await fetcher(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": options.idempotencyKey,
        },
        body: JSON.stringify({
          from: email.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          id?: unknown;
        };
        return { ok: true, id: typeof body.id === "string" ? body.id : "" };
      }
      await response.body?.cancel().catch(() => undefined);
      reason = reasonFor(response.status);
      // 다시 해도 결과가 같은 오류(주소·발신 도메인·키 문제)는 재시도하지 않습니다.
      if (reason !== "rate_limited" && reason !== "unavailable")
        return { ok: false, reason };
    } catch {
      reason = "unavailable";
    }
  }
  return { ok: false, reason };
}
