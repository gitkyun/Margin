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
 * 0단계: 새 화면이 아직 없는 G F(할 일 › 피드백)·G R(미팅 › 검토 요청)·G A(사이드 창 연구 도우미)는
 * 지금 화면으로 갑니다. J/K/X/H, ⌘⇧Enter는 그 기능이 생기는 단계에서 더합니다.
 */
export const GO_SHORTCUTS: readonly GoShortcut[] = [
  { to: "", key: "h", label: t("홈") },
  { to: "meetings", key: "m", label: t("미팅") },
  { to: "docs", key: "d", label: t("글·자료") },
  { to: "docs?kind=writing", key: "w", label: t("글") },
  { to: "tasks", key: "t", label: t("할 일") },
  { to: "feedback", key: "f", label: t("피드백") },
  { to: "reviews", key: "r", label: t("검토 요청") },
  { to: "assistant", key: "a", label: t("연구 도우미") },
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
