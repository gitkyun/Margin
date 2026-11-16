/**
 * AI 대기 표시 규칙(수업 기준): 1초 미만은 아무것도 보이지 않고, 1~10초는
 * 스피너와 지금 단계, 10초부터는 단계 목록·지난 시간·보통 걸리는 시간을 보여 줘요.
 * 서버는 진행률을 주지 않으므로 진행 막대는 쓰지 않아요.
 */
export type AIWaitLevel = "none" | "spinner" | "detailed";

export const AI_WAIT_SPINNER_MS = 1_000;
export const AI_WAIT_DETAILED_MS = 10_000;

export function aiWaitLevel(elapsedMs: number): AIWaitLevel {
  if (elapsedMs < AI_WAIT_SPINNER_MS) return "none";
  if (elapsedMs < AI_WAIT_DETAILED_MS) return "spinner";
  return "detailed";
}

export type AIWaitKind = "answer" | "revision" | "organize" | "writing";

/**
 * 요청 종류별 보통 걸리는 시간(초). 실제 측정값이 아니라 추정치예요.
 * 12주차 사용자 테스트에서 잰 시간으로 다시 맞춰요.
 */
export const AI_WAIT_TYPICAL_SECONDS: Record<AIWaitKind, [number, number]> = {
  answer: [5, 30],
  revision: [10, 40],
  organize: [10, 60],
  writing: [5, 30],
};

/** AIInput mode → 대기 종류 */
export function aiWaitKindForMode(mode: string): AIWaitKind {
  if (mode === "suggest_revisions") return "revision";
  if (mode === "organize_meeting") return "organize";
  if (
    mode === "continue_writing" ||
    mode === "inline_edit" ||
    mode === "review_writing"
  )
    return "writing";
  return "answer";
}

export function elapsedSeconds(elapsedMs: number) {
  return Math.max(0, Math.floor(elapsedMs / 1000));
}
