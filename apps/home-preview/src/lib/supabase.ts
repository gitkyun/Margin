import { t } from "@/lib/i18n";
import { createClient } from "@supabase/supabase-js";
import { localizeServerMessage } from "./server-messages";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export function assertConnected() {
  if (!supabase)
    throw new Error(
      t(
        "미리보기에서는 쓸 수 없는 기능이에요. 미리보기의 변경 내용은 이 브라우저에만 저장돼요.",
      ),
    );
  return supabase;
}
export function friendlyError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : t("요청을 처리하지 못했어요. 다시 시도해 주세요.");
  const message = localizeServerMessage(raw);
  if (/fetch|network|Failed to|Load failed/i.test(message))
    return t(
      "서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
    );
  if (/JWT|session|token|auth.*required/i.test(message))
    return t("로그인이 만료됐어요. 다시 로그인해 주세요.");
  if (
    /permission|denied|not.allowed|forbidden|not_found|not found/i.test(message)
  )
    return t("내용을 찾을 수 없거나 접근 권한이 없어요.");
  if (/conflict|stale/i.test(message))
    return t(
      "다른 창에서 내용이 바뀌었어요. 지금 쓴 내용을 복사해 둔 뒤 새로고침해 주세요.",
    );
  return message.length > 220
    ? t("요청을 처리하지 못했어요. 입력한 내용은 그대로 있어요.")
    : message;
}

/** Verify the current password without replacing the app's active session. */
export function createPasswordVerificationClient() {
  if (!configured) throw new Error(t("서버에 연결하지 못했어요."));
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
