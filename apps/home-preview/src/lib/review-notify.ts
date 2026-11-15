import { t } from "@/lib/i18n";
import { assertConnected } from "@/lib/supabase";

/**
 * ‘교수님께 메일로도 알리기’(서버: functions/review-notify).
 * 링크를 만든 것과 메일을 보낸 것은 다릅니다. 학생이 버튼을 눌러야만 서버에 발송을 요청하고,
 * 화면은 ‘메일 발송 요청함’까지만 말해요. 실제 도착은 알 수 없어요.
 * 서버는 같은 검토 요청을 한국 시간 8시간 구간마다 한 통으로 묶어요(하루 최대 3통).
 */

export interface NotifyRecord {
  /** 서버가 발송 요청을 받은 시각(ISO) */
  requestedAt: string;
  /** 다시 알릴 수 있는 시각(ISO) */
  nextAt: string;
}

const STORAGE_PREFIX = "margin-review-notify:";

export function readNotifyRecord(requestId: string): NotifyRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + requestId);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<NotifyRecord>;
    return typeof value.requestedAt === "string" &&
      typeof value.nextAt === "string"
      ? { requestedAt: value.requestedAt, nextAt: value.nextAt }
      : null;
  } catch {
    return null;
  }
}

export function saveNotifyRecord(requestId: string, record: NotifyRecord) {
  try {
    localStorage.setItem(STORAGE_PREFIX + requestId, JSON.stringify(record));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 기억해요. 서버가 중복 발송을 막아요.
  }
}

/** 지금 다시 알릴 수 있는지. 기록이 없거나 다음 구간이 시작됐으면 true */
export function canNotifyAgain(
  record: NotifyRecord | null,
  now: Date = new Date(),
): boolean {
  if (!record) return true;
  const next = Date.parse(record.nextAt);
  return Number.isNaN(next) || now.getTime() >= next;
}

export type NotifyFailure =
  | "not_configured"
  | "not_shared"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "sender_not_verified"
  | "rejected"
  | "unavailable"
  | "unauthorized"
  | "bad_request";

/** 서버가 돌려준 실패 코드를 화면 문구로 바꿔요. */
export function notifyFailureMessage(code: string | undefined): string {
  switch (code as NotifyFailure | undefined) {
    case "not_configured":
    case "sender_not_verified":
      return t(
        "메일 발송이 아직 준비되지 않았어요. 링크를 복사해 교수님께 직접 전해 주세요.",
      );
    case "not_shared":
      return t("공유를 중지한 검토 요청은 메일로 알릴 수 없어요.");
    case "forbidden":
    case "not_found":
      return t("이 검토 요청의 알림을 보낼 권한이 없어요.");
    case "rate_limited":
      return t(
        "메일 요청이 많아 잠시 받을 수 없어요. 조금 뒤 다시 시도해 주세요.",
      );
    case "rejected":
      return t(
        "교수님 이메일로 메일을 보낼 수 없었어요. 링크를 복사해 직접 전해 주세요.",
      );
    case "unauthorized":
      return t("다시 로그인해 주세요.");
    default:
      return t("메일 발송을 요청하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await assertConnected().functions.invoke(
    "review-notify",
    { body },
  );
  if (error) {
    let code: string | undefined;
    try {
      code = (await error.context?.json())?.code;
    } catch {
      // 응답을 읽지 못하면 기본 문구를 써요.
    }
    throw new Error(notifyFailureMessage(code));
  }
  return data as T;
}

let statusPromise: Promise<boolean> | null = null;

/** 서버에 메일 발송 키가 있는지. 함수가 없거나 실패하면 false(버튼을 끄고 이유를 보여요). */
export function reviewNotifyAvailable(): Promise<boolean> {
  statusPromise ??= invoke<{ configured?: boolean }>({ action: "status" })
    .then((value) => value?.configured === true)
    .catch(() => {
      statusPromise = null; // 다음에 다시 물어봐요.
      return false;
    });
  return statusPromise;
}

export async function requestReviewNotify(
  requestId: string,
): Promise<NotifyRecord> {
  const value = await invoke<Partial<NotifyRecord> & { status?: string }>({
    action: "send",
    requestId,
  });
  if (
    value?.status !== "requested" ||
    typeof value.requestedAt !== "string" ||
    typeof value.nextAt !== "string"
  )
    throw new Error(notifyFailureMessage(undefined));
  const record = { requestedAt: value.requestedAt, nextAt: value.nextAt };
  saveNotifyRecord(requestId, record);
  return record;
}
