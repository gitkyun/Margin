import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "@/lib/i18n";

/** 카카오에서 돌아올 때 주소 뒤(#…)에 실려 오는 값의 이름. */
const ACCESS = "access_token";
const REFRESH = "refresh_token";
const ADMITTED_PREFIX = "margin-admitted:";

/** 로그인 뒤 돌아올 수 있는 앱 안 주소인지. 바깥 주소로 보내지 않습니다. */
export function safeNext(next: string | null | undefined): string {
  return next &&
    /^\/(r|reviews|schedule|join)(\/|\?|$)/.test(next) &&
    !next.startsWith("//")
    ? next
    : "/r";
}

/** 인증 서버의 영어 메시지를 화면에 보여 줄 말로 바꿉니다. */
export function socialLoginProblem(message: string): string {
  if (/email/i.test(message))
    return t(
      "카카오 계정의 이메일을 받지 못했어요. 카카오 로그인 화면에서 이메일 제공에 동의해 주세요.",
    );
  if (/access_denied|cancel/i.test(message))
    return t("카카오 로그인을 취소했어요. 다시 시도해 주세요.");
  if (/provider is not enabled|unsupported provider/i.test(message))
    return t("카카오 로그인을 아직 쓸 수 없어요. 이메일로 로그인해 주세요.");
  return t("카카오로 로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
}

/** 카카오 로그인 화면으로 보냅니다. 끝나면 next 주소로 돌아옵니다. */
export async function startKakaoLogin(
  client: SupabaseClient,
  next: string,
): Promise<void> {
  const { error } = await client.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: `${window.location.origin}${safeNext(next)}` },
  });
  if (error) throw new Error(socialLoginProblem(error.message));
}

export interface SocialReturn {
  /** 돌아온 주소에 로그인 결과가 실려 있었는지. */
  handled: boolean;
  problem?: string;
}

/**
 * 카카오에서 돌아온 주소(#access_token=… 또는 error=…)를 읽어 로그인을 마칩니다.
 * 읽은 값은 주소에서 바로 지웁니다.
 */
export async function finishSocialLogin(
  client: SupabaseClient,
): Promise<SocialReturn> {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const failure =
    hash.get("error_description") ??
    hash.get("error") ??
    query.get("error_description") ??
    (query.has("error_code") ? query.get("error") : null);
  const access = hash.get(ACCESS);
  const refresh = hash.get(REFRESH);
  if (!failure && !(access && refresh)) return { handled: false };
  for (const name of ["error", "error_code", "error_description"])
    query.delete(name);
  const rest = query.toString();
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (rest ? `?${rest}` : ""),
  );
  if (failure) return problemReturn(socialLoginProblem(failure));
  const { error } = await client.auth.setSession({
    access_token: access as string,
    refresh_token: refresh as string,
  });
  return error
    ? problemReturn(socialLoginProblem(error.message))
    : { handled: true };
}

let pendingProblem = "";

/** 로그인 화면이 한 번 보여 줄 문제를 맡겨 둡니다. */
function problemReturn(problem: string): SocialReturn {
  pendingProblem = problem;
  return { handled: true, problem };
}

export function takeSocialProblem(): string {
  const problem = pendingProblem;
  pendingProblem = "";
  return problem;
}

function admittedBefore(userId: string): boolean {
  try {
    return window.localStorage.getItem(ADMITTED_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

/**
 * 가입한 계정을 허용 목록에 넣습니다(초대 없이 가입한 계정, 카카오로 처음 온 계정).
 * 한 번 들어간 계정은 이 브라우저에서 다시 묻지 않습니다.
 * 실패해도 막지 않습니다. 중지된 계정 같은 경우는 다음 화면이 이유를 알려 줍니다.
 */
export async function admit(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  if (admittedBefore(userId)) return;
  const { error } = await client.rpc("rms_join");
  if (error) return;
  try {
    window.localStorage.setItem(ADMITTED_PREFIX + userId, "1");
  } catch {
    // 저장소를 못 쓰면 다음에 다시 물을 뿐입니다.
  }
}
