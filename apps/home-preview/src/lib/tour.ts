import { t } from "@/lib/i18n";

/**
 * 연구 홈 화면 안내. 처음 쓰는 사람의 안내는 연구 만들기와 시작 체크리스트 두 겹으로 줄여서
 * 이 안내는 저절로 뜨지 않습니다(감사 F3). 사용 안내의 ‘다시 보기’로 부탁했을 때만 엽니다.
 * 부탁한 기록은 이 브라우저에만 둡니다(서버에 저장하지 않음).
 */
const REQUEST_KEY = "margin-home-tour-requested";

export function isTourRequested(): boolean {
  try {
    return localStorage.getItem(REQUEST_KEY) === "true";
  } catch {
    return false;
  }
}

/** 사용 안내의 ‘다시 보기’. 다음에 연구 홈을 열 때 안내가 한 번 나옵니다. */
export function requestTour(): void {
  try {
    localStorage.setItem(REQUEST_KEY, "true");
  } catch {
    // 저장소를 쓸 수 없으면 `?tour=1` 주소로만 열 수 있습니다.
  }
}

export function clearTourRequest(): void {
  try {
    localStorage.removeItem(REQUEST_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 남은 기록도 없습니다.
  }
}

/** 부탁했거나 `?tour=1`로 들어왔을 때만 엽니다. 처음 왔다고 저절로 열지 않습니다. */
export function shouldShowTour(input: {
  requested: boolean;
  forced: boolean;
}): boolean {
  return input.forced || input.requested;
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
    title: t("가장 먼저 할 일은 이 버튼이에요"),
    text: t(
      "미팅 날짜, 기록, 교수님 응답에 따라 지금 가장 먼저 할 일로 바뀌어요.",
    ),
  },
  {
    key: "menu",
    selector: ".ia-rail",
    title: t("옆 창과 설정은 오른쪽 줄에 있어요"),
    text: t("연구 도우미, 이 화면의 옆 창, 의견 보내기, 설정을 여기서 열어요."),
  },
  {
    key: "flow",
    selector: '[data-tour="flow"]',
    title: t("지도 기록은 이 순서로 이어져요"),
    text: t(
      "미팅에서 받은 피드백을 할 일로 만들고, 고친 내용을 검토 요청으로 교수님께 보내요.",
    ),
  },
  {
    key: "search",
    selector: ".ia-search",
    title: t("기록은 ⌘K로 찾아요"),
    text: t(
      "제목이나 초성으로 미팅, 할 일, 화면을 바로 열 수 있어요. Windows에서는 Ctrl+K예요.",
    ),
  },
  {
    key: "start",
    selector: ".rh-start",
    title: t("처음이라면 여기부터 해 보세요"),
    text: t(
      "네 가지를 해 보면 마진의 흐름을 한 번 다 써 보게 돼요. 닫아도 기록은 그대로예요.",
    ),
  },
  {
    key: "guide",
    selector: ".kokonut-profile-trigger",
    title: t("사용 안내는 계정 메뉴에 있어요"),
    text: t("키보드 단축키는 ? 키로 볼 수 있어요."),
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
