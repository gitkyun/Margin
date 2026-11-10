/** 연구 홈 화면 안내. 봤다는 기록은 이 브라우저에만 둡니다(서버에 저장하지 않음). */
const SEEN_KEY = "margin-home-tour-seen";

export function isTourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "true");
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 닫습니다.
  }
}

/** 사용 안내의 ‘다시 보기’. 다음에 연구 홈을 열 때 안내가 다시 나옵니다. */
export function resetTourSeen(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 원래도 매번 나옵니다.
  }
}

/** 아직 보지 않았을 때 한 번 자동으로 뜨고, `?tour=1`로 들어오면 다시 볼 수 있습니다. */
export function shouldShowTour(input: {
  seen: boolean;
  forced: boolean;
}): boolean {
  return input.forced || !input.seen;
}

export interface TourStep {
  key: string;
  /** 짚어 줄 요소. 화면에 없거나 가려져 있으면 그 단계는 건너뜁니다. */
  selector: string;
  title: string;
  text: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    key: "lead",
    selector: ".rh-lead-action",
    title: "지금 할 일은 이 버튼 하나예요",
    text: "미팅 날짜와 기록 상태에 따라 ‘미팅 준비하기’, ‘기록 시작’처럼 바뀌어요.",
  },
  {
    key: "menu",
    selector: 'button[aria-label="메뉴 열기"]',
    title: "메뉴는 여기서 열어요",
    text: "미팅, 피드백, 할 일, 검토 요청으로 가는 메뉴가 들어 있어요.",
  },
  {
    key: "flow",
    selector: '[data-tour="flow"]',
    title: "지도 흐름을 따라가요",
    text: "미팅에서 받은 피드백을 할 일로 만들고, 고친 내용을 검토 요청으로 교수님께 보내요.",
  },
  {
    key: "search",
    selector: ".sidebar-search",
    title: "기록은 ⌘K로 찾아요",
    text: "제목이나 초성으로 미팅, 할 일, 화면을 바로 열 수 있어요. Windows에서는 Ctrl+K예요.",
  },
  {
    key: "start",
    selector: ".rh-start",
    title: "처음이라면 여기부터 해 보세요",
    text: "네 가지를 해 보면 마진의 흐름을 한 번 다 써 보게 돼요. 닫아도 기록은 그대로예요.",
  },
  {
    key: "guide",
    selector: 'a[aria-label="사용 안내"]',
    title: "더 알고 싶으면 사용 안내를 열어요",
    text: "키보드 단축키는 ? 키로 볼 수 있어요.",
  },
];

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const EDGE = 16;
const GAP = 12;

/**
 * 설명 카드를 놓을 자리. 대상의 오른쪽 → 아래 → 위 순서로 들어가는 곳을 고르고,
 * 어디에도 안 들어가면 화면 아래에 붙입니다. 항상 화면 안쪽 16px에 둡니다.
 */
export function placeCard(
  target: Box,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const clampLeft = (left: number) =>
    Math.max(EDGE, Math.min(left, viewport.width - card.width - EDGE));
  const clampTop = (top: number) =>
    Math.max(EDGE, Math.min(top, viewport.height - card.height - EDGE));
  const right = target.left + target.width + GAP;
  if (right + card.width + EDGE <= viewport.width && target.width < 360)
    return { top: clampTop(target.top), left: right };
  const below = target.top + target.height + GAP;
  if (below + card.height + EDGE <= viewport.height)
    return { top: below, left: clampLeft(target.left) };
  const above = target.top - GAP - card.height;
  if (above >= EDGE) return { top: above, left: clampLeft(target.left) };
  return {
    top: viewport.height - card.height - EDGE,
    left: clampLeft(target.left),
  };
}
