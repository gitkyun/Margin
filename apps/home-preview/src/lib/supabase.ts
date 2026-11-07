import { createClient } from "@supabase/supabase-js";
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
      "아직 서버에 연결하지 않았습니다. 미리보기의 변경은 이 브라우저에만 저장됩니다.",
    );
  return supabase;
}
export function friendlyError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "요청을 처리하지 못했습니다.";
  if (/fetch|network|Failed to|Load failed/i.test(message))
    return "서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.";
  if (/JWT|session|token|auth.*required/i.test(message))
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  if (
    /permission|denied|not.allowed|forbidden|not_found|not found/i.test(message)
  )
    return "이 내용을 열거나 변경할 권한이 없습니다.";
  if (/conflict|stale/i.test(message))
    return "다른 창에서 내용이 바뀌었습니다. 작성한 내용을 보관한 뒤 새로 불러와 주세요.";
  return message.length > 220
    ? "요청을 처리하지 못했습니다. 입력한 내용은 유지됩니다."
    : message;
}

/** Verify the current password without replacing the app's active session. */
export function createPasswordVerificationClient() {
  if (!configured) throw new Error("서버에 연결하지 못했습니다.");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
