import { t } from "@/lib/i18n";

/** 가입 주소에 초대 코드를 싣는 쿼리 이름: /signup?invite=<코드> */
export const INVITE_PARAM = "invite";

/** 서버(rms_invites.code)가 받는 초대 코드 모양: 소문자 hex 32자 */
const CODE_PATTERN = /^[0-9a-f]{32}$/;

function asCode(value: string | null | undefined): string | null {
  const code = (value ?? "").trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** 초대 코드만 붙여 넣었든 초대 링크를 통째로 붙여 넣었든 코드를 꺼냅니다. */
export function inviteCodeFrom(text: string | null | undefined): string | null {
  const bare = asCode(text);
  if (bare) return bare;
  const query = (text ?? "").split("?")[1]?.split("#")[0];
  return query ? asCode(new URLSearchParams(query).get(INVITE_PARAM)) : null;
}

export function inviteLink(origin: string, code: string): string {
  return `${origin}/signup?${INVITE_PARAM}=${code}`;
}

/** 가입 요청이 실패했을 때 보여 줄 말. 인증 서버의 영어 메시지를 그대로 보여 주지 않습니다. */
export function signupProblem(message: string): string {
  if (/already (been )?registered|already exists/i.test(message))
    return t("이미 가입한 이메일이에요. 로그인해 주세요.");
  if (/rate limit|too many/i.test(message))
    return t(
      "지금은 확인 메일을 더 보낼 수 없어요. 조금 뒤에 다시 시도해 주세요.",
    );
  if (/not authorized|invalid.*email|email.*invalid/i.test(message))
    return t("이 주소로는 확인 메일을 보낼 수 없어요. 이메일을 확인해 주세요.");
  if (/password/i.test(message)) return t("비밀번호가 조건에 맞지 않아요.");
  if (/fetch|network|Failed to|Load failed/i.test(message))
    return t(
      "서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
    );
  return t("가입하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
}

/** 가입하지 않은 교수 이메일일 때 화면에 보이는 문구(server-messages.ts의 표와 같아야 합니다). */
const UNREGISTERED_REVIEWER =
  "아직 마진에 가입하지 않은 이메일이에요. 초대 링크를 보내 가입을 부탁해 주세요."; // i18n-ignore

/** 검토 요청에서 고른 교수 이메일로 가입한 계정이 없다는 서버 메시지인지. */
export function isUnregisteredReviewer(message: string): boolean {
  return message.includes(t(UNREGISTERED_REVIEWER));
}
