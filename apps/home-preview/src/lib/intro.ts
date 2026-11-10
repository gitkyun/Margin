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
 * 소개를 보여 줄지 정합니다. 연구가 하나도 없고 아직 보지 않았을 때만 자동으로 뜨고,
 * `/r/new?intro=1`로 들어오면 다시 볼 수 있습니다.
 */
export function shouldShowIntro(input: {
  hasResearches: boolean;
  seen: boolean;
  forced: boolean;
}): boolean {
  if (input.forced) return true;
  return !input.hasResearches && !input.seen;
}

export interface IntroFlowStep {
  icon: string;
  label: string;
  text: string;
  /** 오른쪽 장면의 화면 그림에 넣는 예시 글. 피드백 한 건이 단계를 따라가는 모습입니다. */
  example: string;
}

/** 사이드바 ‘지도 흐름’과 같은 순서·이름입니다. */
export const INTRO_FLOW: IntroFlowStep[] = [
  {
    icon: "calendar",
    label: "미팅",
    text: "지도 미팅을 메모나 녹음으로 남겨요.",
    example: "교수님: 연구 질문이 너무 넓다. 범위를 좁혀 보자.",
  },
  {
    icon: "feedback",
    label: "피드백",
    text: "미팅에서 받은 말을 한 건씩 정리해요.",
    example: "연구 질문이 넓어요. 범위를 좁혀 보세요.",
  },
  {
    icon: "tasks",
    label: "할 일",
    text: "고칠 것을 할 일로 만들어요.",
    example: "연구 질문을 두 개로 줄이기",
  },
  {
    icon: "edit",
    label: "수정 결과",
    text: "어떻게 고쳤는지 적어 둬요.",
    example: "질문을 두 개로 줄이고 2장을 고쳤어요.",
  },
  {
    icon: "send",
    label: "검토 요청",
    text: "고친 내용을 교수님께 확인받아요.",
    example: "2장 수정 내용을 확인해 주세요.",
  },
];

export const INTRO_SLIDE_COUNT = 3;
