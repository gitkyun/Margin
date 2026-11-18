/** 사이드 창 열림·마지막 탭 기억(IA v2 02 §4.5). 이 브라우저에만 둡니다. */
export type SidePanelTab = "assistant" | "tasks" | "log";

const OPEN_KEY = "margin-panel-open";
const TAB_KEY = "margin-panel-tab";
const TABS: readonly SidePanelTab[] = ["assistant", "tasks", "log"];

/** 창이 본문을 미는 폭. 그보다 좁으면 열림을 읽지도 쓰지도 않습니다(D15). */
export const PUSH_MIN_WIDTH = 1200;
/** 처음 쓰는 사람에게 열린 채로 보여 주는 폭(D17) */
export const OPEN_BY_DEFAULT_WIDTH = 1440;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장소를 못 쓰면 기본값으로 동작합니다(오류를 내지 않음).
  }
}

/**
 * 처음 열 탭. 1200px 미만이면 늘 닫힘. 그 이상이면 기억한 열림, 기억이 없으면 1440px 이상일 때 열림.
 * 탭은 마지막 탭, 없으면 할 일.
 */
export function initialPanelTab(width: number): SidePanelTab | null {
  if (width < PUSH_MIN_WIDTH) return null;
  const open = read(OPEN_KEY);
  const shouldOpen =
    open === "1" ? true : open === "0" ? false : width >= OPEN_BY_DEFAULT_WIDTH;
  if (!shouldOpen) return null;
  const tab = read(TAB_KEY);
  return (TABS as readonly string[]).includes(tab ?? "")
    ? (tab as SidePanelTab)
    : "tasks";
}

/** 1200px 이상에서만 열림과 마지막 탭을 남깁니다. */
export function rememberPanel(width: number, tab: SidePanelTab | null): void {
  if (tab) write(TAB_KEY, tab);
  if (width < PUSH_MIN_WIDTH) return;
  write(OPEN_KEY, tab ? "1" : "0");
}

/** 접었다 다시 펼 때 열 탭: 마지막으로 연 탭, 없으면 할 일 */
export function lastPanelTab(): SidePanelTab {
  const tab = read(TAB_KEY);
  return (TABS as readonly string[]).includes(tab ?? "")
    ? (tab as SidePanelTab)
    : "tasks";
}
