import { t } from "@/lib/i18n";

/** 처음 온 사람에게 한 번 보여 주는 서비스 소개. 봤다는 기록은 이 브라우저에만 둡니다(서버에 저장하지 않음). */
const SEEN_KEY = "margin-intro-seen";

export function isIntroSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "true");
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 넘어갑니다.
  }
}

/**
 * 소개를 보여 줄지 정합니다. 처음 쓰는 사람의 안내는 연구 만들기와 시작 체크리스트 두 겹만 두므로
 * 소개는 저절로 뜨지 않고, 사용 안내의 '서비스 소개 다시 보기'(`/r/new?intro=1`)로만 엽니다(감사 F3).
 * `hasResearches`·`seen`은 호출 쪽 호환을 위해 받기만 합니다.
 */
export function shouldShowIntro(input: {
  hasResearches: boolean;
  seen: boolean;
  forced: boolean;
}): boolean {
  return input.forced;
}

export interface IntroFlowStep {
  icon: string;
  label: string;
  text: string;
  /** 오른쪽 장면의 화면 그림에 넣는 예시 글. 피드백 한 건이 단계를 따라가는 모습입니다. */
  example: string;
}

/** 작업 흐름(미팅 → 피드백 → 할 일 → 수정 결과 → 검토 요청) 순서·이름입니다. */
export const INTRO_FLOW: IntroFlowStep[] = [
  {
    icon: "calendar",
    label: t("미팅"),
    text: t("지도 미팅을 메모나 녹음으로 남겨요."),
    example: t("교수님: 연구 질문이 너무 넓다. 범위를 좁혀 보자."),
  },
  {
    icon: "feedback",
    label: t("피드백"),
    text: t("미팅에서 받은 말을 한 건씩 정리해요."),
    example: t("연구 질문이 넓어요. 범위를 좁혀 보세요."),
  },
  {
    icon: "tasks",
    label: t("할 일"),
    text: t("고칠 것을 할 일에 추가해요."),
    example: t("연구 질문을 두 개로 줄이기"),
  },
  {
    icon: "edit",
    label: t("수정 결과"),
    text: t("어떻게 고쳤는지 적어 둬요."),
    example: t("질문을 두 개로 줄이고 2장을 고쳤어요."),
  },
  {
    icon: "send",
    label: t("검토 요청"),
    text: t("고친 내용을 교수님께 확인받아요."),
    example: t("2장 수정 내용을 확인해 주세요."),
  },
];

export const INTRO_SLIDE_COUNT = 3;

/**
 * 자동 넘김 간격(ms). 소개 장은 5초, 흐름 장의 단계 하나는 6초 머뭅니다.
 * 단계마다 전체 화면 1초 → 천천히 확대(1.6초) → 확대된 화면을 읽을 시간이 들어 있습니다.
 */
export const INTRO_SLIDE_MS = 5000;
export const INTRO_FLOW_MS = 6000;

export type IntroAutoStep =
  { kind: "flow"; flowIndex: number } | { kind: "slide"; slide: number } | null;

/**
 * 자동 넘김의 다음 자리. 흐름 장에서는 단계를 끝까지 돈 뒤 다음 장으로 가고,
 * 마지막 장에서는 멈춥니다(연구 만들기는 사람이 직접 누릅니다).
 */
export function nextIntroAuto(slide: number, flowIndex: number): IntroAutoStep {
  if (slide >= INTRO_SLIDE_COUNT - 1) return null;
  if (slide === 1 && flowIndex < INTRO_FLOW.length - 1)
    return { kind: "flow", flowIndex: flowIndex + 1 };
  return { kind: "slide", slide: slide + 1 };
}
