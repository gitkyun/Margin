/**
 * 연구 안 화면 이동 단축키: G를 누른 뒤 1초 안에 글자 하나(예: G → H = 연구 홈).
 * 물리 키 기준이라 한글 자판 상태에서도 같은 자리를 누르면 됩니다.
 * 키는 경로(사이드바 RESEARCH_NAVIGATION의 path)에 붙입니다.
 */
export const GO_SHORTCUTS: ReadonlyArray<readonly [path: string, key: string]> =
  [
    ["", "h"],
    ["planning", "p"],
    ["meetings", "m"],
    ["writing", "w"],
    ["feedback", "f"],
    ["materials", "d"],
    ["reviews", "r"],
    ["tasks", "t"],
    ["assistant", "a"],
    ["settings", "s"],
  ];

/** 화면에 보여 줄 단축키 글자(예: "G H"). 단축키가 없는 경로면 undefined */
export function goShortcutLabel(path: string): string | undefined {
  const key = GO_SHORTCUTS.find(([p]) => p === path)?.[1];
  return key ? `G ${key.toUpperCase()}` : undefined;
}

export function researchPath(researchId: string, path: string): string {
  return path ? `/r/${researchId}/${path}` : `/r/${researchId}`;
}
