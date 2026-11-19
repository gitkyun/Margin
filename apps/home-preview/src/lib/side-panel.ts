import type { AIContext } from "@/lib/domain";

/** 사이드 창 열림·마지막 탭 기억(IA v2 02 §4.5). 이 브라우저에만 둡니다. */
export type SidePanelTab = "assistant" | "tasks" | "log" | "materials";

const OPEN_KEY = "margin-panel-open";
const TAB_KEY = "margin-panel-tab";
const TABS: readonly SidePanelTab[] = [
  "assistant",
  "tasks",
  "log",
  "materials",
];

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

/** 주소로 여는 사이드 창(01 §3.3, 02 §4.5): `?panel=assistant|tasks|log|materials`, 연구 도우미는 `&panelView=suggestions|runs` */
export interface PanelRequest {
  tab: SidePanelTab;
  view?: "suggestions" | "runs";
}

export function panelRequest(search: string): PanelRequest | null {
  const params = new URLSearchParams(search);
  const tab = params.get("panel");
  if (!(TABS as readonly string[]).includes(tab ?? "")) return null;
  const view = params.get("panelView");
  return {
    tab: tab as SidePanelTab,
    ...(tab === "assistant" && (view === "suggestions" || view === "runs")
      ? { view }
      : {}),
  };
}

/**
 * 창을 연 뒤 주소에서 `panel`·`panelView`를 지운 검색어(`?…` 또는 빈 문자열).
 * 열림은 주소가 아니라 창이 들고 있어서, 닫은 뒤 새로 고쳐도 다시 열리지 않습니다.
 */
export function withoutPanelRequest(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("panel");
  params.delete("panelView");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** 접었다 다시 펼 때 열 탭: 마지막으로 연 탭, 없으면 할 일 */
export function lastPanelTab(): SidePanelTab {
  const tab = read(TAB_KEY);
  return (TABS as readonly string[]).includes(tab ?? "")
    ? (tab as SidePanelTab)
    : "tasks";
}

/**
 * 연구 도우미 창을 열 때 함께 넘기는 것: 보여 줄 보기와 놓을 근거 칩(자료 창의 [연구 도우미에게 묻기], 06 §5).
 * `at`이 바뀔 때마다 한 번 적용합니다.
 */
export interface AssistantOpen {
  view?: PanelRequest["view"];
  context?: AIContext;
  at: number;
}

/** 휴대폰 층(02 §6, D16)의 세그먼트. 할 일은 아래 탭에 따로 있어 빠집니다. */
export const LAYER_SEGMENTS = ["assistant", "log", "materials"] as const;
export type LayerSegment = (typeof LAYER_SEGMENTS)[number];
const LAYER_KEY = "margin-phone-layer";

export function isLayerSegment(tab: string | null): tab is LayerSegment {
  return (LAYER_SEGMENTS as readonly string[]).includes(tab ?? "");
}

/** 아래 탭 '연구 도우미'로 층을 열 때 보일 세그먼트: 마지막에 본 것, 없으면 연구 도우미 */
export function lastLayerSegment(): LayerSegment {
  const segment = read(LAYER_KEY);
  return isLayerSegment(segment) ? segment : "assistant";
}

export function rememberLayerSegment(segment: LayerSegment): void {
  write(LAYER_KEY, segment);
}
