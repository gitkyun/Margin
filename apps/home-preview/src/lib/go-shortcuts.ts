import { t } from "./i18n";

export interface GoShortcut {
  /** `/r/:id` 뒤에 붙는 곳. 빈 문자열은 홈, `?`로 시작하면 지금 화면 위(설정 창) */
  to: string;
  key: string;
  label: string;
}

/**
 * 연구 안 화면 이동 단축키(IA v2 01 §4): G를 누른 뒤 1초 안에 글자 하나.
 * 물리 키 기준이라 한글 자판 상태에서도 같은 자리를 누르면 됩니다.
 * G F는 할 일 화면의 피드백 보기, G R은 미팅 목록의 검토 요청 보기로 갑니다(5단계).
 * G A는 화면을 옮기지 않고 사이드 창의 연구 도우미를 엽니다(4단계). 목록의 J/K/X는 `lib/list-keys.ts`입니다.
 */
export const GO_SHORTCUTS: readonly GoShortcut[] = [
  { to: "", key: "h", label: t("홈") },
  { to: "meetings", key: "m", label: t("미팅") },
  { to: "docs", key: "d", label: t("글·자료") },
  { to: "docs?kind=writing", key: "w", label: t("글") },
  { to: "tasks", key: "t", label: t("할 일") },
  { to: "tasks?view=feedback", key: "f", label: t("피드백") },
  { to: "meetings?type=review", key: "r", label: t("검토 요청") },
  { to: "?panel=assistant", key: "a", label: t("연구 도우미") },
  { to: "flow", key: "p", label: t("연구 흐름") },
  { to: "?settings=research", key: "s", label: t("설정") },
];

/** 화면에 보여 줄 단축키 글자(예: "G H"). 단축키가 없는 곳이면 undefined */
export function goShortcutLabel(to: string): string | undefined {
  const key = GO_SHORTCUTS.find((item) => item.to === to)?.key;
  return key ? `G ${key.toUpperCase()}` : undefined;
}

/** 이동할 주소. `?`로 시작하면 지금 화면에 붙이는 상대 주소 그대로 */
export function researchPath(researchId: string, to: string): string {
  if (to.startsWith("?")) return to;
  return to ? `/r/${researchId}/${to}` : `/r/${researchId}`;
}
