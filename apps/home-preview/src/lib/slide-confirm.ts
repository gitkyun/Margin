/**
 * 밀어서 확인(SlideToConfirm)의 순수 계산. 진행도는 0(처음)~1(끝)입니다.
 * 끝까지 밀어야만 실행되고, 손을 떼면 처음으로 돌아갑니다.
 */

/** 이 진행도 이상에서 손을 떼면 끝까지 민 것으로 봐요(손끝 오차 여유). */
export const SLIDE_CONFIRM_THRESHOLD = 0.96;
/** →·← 키 한 번에 움직이는 양 */
export const SLIDE_KEY_STEP = 0.25;
/** Enter를 이만큼 누르고 있으면 끝까지 간 것으로 봐요. */
export const SLIDE_HOLD_MS = 900;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 손잡이를 dx(px)만큼 끌었을 때의 진행도. 손잡이가 움직일 수 있는 길이로 나눕니다. */
export function slideProgress(
  startProgress: number,
  dx: number,
  travel: number,
): number {
  if (travel <= 0) return clamp01(startProgress);
  return clamp01(startProgress + dx / travel);
}

/** 화살표·Home·End 키로 바뀐 진행도. 다른 키면 null(기본 동작 유지). */
export function keyProgress(progress: number, key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowUp")
    return clamp01(progress + SLIDE_KEY_STEP);
  if (key === "ArrowLeft" || key === "ArrowDown")
    return clamp01(progress - SLIDE_KEY_STEP);
  if (key === "Home") return 0;
  if (key === "End") return 1;
  return null;
}

/** Enter를 누르고 있던 시간(ms)에 맞는 진행도 */
export function holdProgress(elapsedMs: number): number {
  return clamp01(elapsedMs / SLIDE_HOLD_MS);
}

export function isSlideComplete(progress: number): boolean {
  return progress >= SLIDE_CONFIRM_THRESHOLD;
}
