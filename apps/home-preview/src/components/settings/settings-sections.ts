import { t } from "@/lib/i18n";

// IA v2 설정 창(07 §1): 주소 `?settings=<칸>` 하나로 엽니다.

export type AccountSection =
  "profile" | "display" | "notifications" | "assistant" | "usage" | "shortcuts";
// 미팅 주기(`schedule`, 07 §1.3)는 Q7 확인 뒤 넣습니다. 그 전까지는 틀린 값처럼 지웁니다.
export type ResearchSection = "research" | "people" | "danger";
export type SettingsSection = AccountSection | ResearchSection;

export interface SettingsSectionInfo<S extends SettingsSection> {
  id: S;
  icon: string;
  label: string;
}

export const ACCOUNT_SECTIONS: readonly SettingsSectionInfo<AccountSection>[] =
  [
    { id: "profile", icon: "user", label: t("프로필") },
    { id: "display", icon: "sun", label: t("화면") },
    { id: "notifications", icon: "bell", label: t("알림") },
    { id: "assistant", icon: "sparkles", label: t("연구 도우미") },
    { id: "usage", icon: "chart", label: t("사용량·플랜") },
    { id: "shortcuts", icon: "help", label: t("단축키") },
  ];

export const RESEARCH_SECTIONS: readonly SettingsSectionInfo<ResearchSection>[] =
  [
    { id: "research", icon: "file", label: t("연구 정보") },
    { id: "people", icon: "users", label: t("함께하는 사람") },
    { id: "danger", icon: "folder", label: t("보관·삭제") },
  ];

/** 지금 설정 화면의 `tab=` 이름(SettingsPage가 쓰는 값) */
export const ACCOUNT_TAB: Record<AccountSection, string> = {
  profile: "profile",
  display: "appearance",
  notifications: "notifications",
  assistant: "ai",
  usage: "usage",
  shortcuts: "shortcuts",
};
export const RESEARCH_TAB: Record<ResearchSection, string> = {
  research: "basic",
  people: "members",
  danger: "lifecycle",
};

const PARAM = "settings";

function isAccount(value: string): value is AccountSection {
  return ACCOUNT_SECTIONS.some((s) => s.id === value);
}
function isResearch(value: string): value is ResearchSection {
  return RESEARCH_SECTIONS.some((s) => s.id === value);
}
export function isResearchSection(
  section: SettingsSection,
): section is ResearchSection {
  return isResearch(section);
}

/**
 * 주소 값을 칸으로 바꿉니다. 없으면 null, 모르는 값이면 "invalid"(주소에서 지움),
 * 연구 밖에서 연구 칸을 열면 프로필로 엽니다.
 */
export function resolveSettingsSection(
  raw: string | null,
  inResearch: boolean,
): SettingsSection | "invalid" | null {
  if (raw === null) return null;
  if (isAccount(raw)) return raw;
  if (isResearch(raw)) return inResearch ? raw : "profile";
  return "invalid";
}

/** 다른 주소 값은 두고 `settings=`만 바꾼 검색 문자열 */
export function withSettings(
  search: string,
  section: SettingsSection | null,
): string {
  const params = new URLSearchParams(search);
  if (section) params.set(PARAM, section);
  else params.delete(PARAM);
  const next = params.toString();
  return next ? `?${next}` : "";
}

function invert<S extends string>(map: Record<S, string>, tab: string) {
  return (Object.keys(map) as S[]).find((key) => map[key] === tab);
}

/** 예전 설정 주소(01 §3.3)를 새 주소로. `tab=`은 지우고 다른 값은 넘깁니다. 해당 없으면 null. */
export function legacySettingsTarget(
  pathname: string,
  search: string,
): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") ?? "";
  params.delete("tab");
  const path = pathname.replace(/\/$/, "");
  const match = /^\/r\/([^/]+)\/settings$/.exec(path);
  if (path !== "/account" && !match) return null;
  if (match && tab === "phases") {
    const rest = params.toString();
    return `/r/${match[1]}/flow${rest ? `?${rest}` : ""}`;
  }
  const section = match
    ? (invert(RESEARCH_TAB, tab) ?? "research")
    : (invert(ACCOUNT_TAB, tab) ?? "profile");
  params.set(PARAM, section);
  return `${match ? `/r/${match[1]}` : "/r"}?${params.toString()}`;
}
