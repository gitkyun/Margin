/**
 * 좁은 화면(767px 이하)에서 할 일 행을 오른쪽으로 밀어 완료를 바꿀지 정해요.
 * 행 너비의 30%(최소 88px) 이상 밀었거나, 짧게라도 빠르게 튕기면 바꿔요.
 * 왼쪽으로 민 것과 아주 짧은 움직임(스크롤 중 흔들림)은 무시해요.
 */
export const SWIPE_MIN_DISTANCE = 88;
export const SWIPE_RATIO = 0.3;
export const SWIPE_FLICK_DISTANCE = 40;
export const SWIPE_FLICK_VELOCITY = 500;

export function shouldToggleOnSwipe(
  offsetX: number,
  velocityX: number,
  rowWidth: number,
): boolean {
  if (offsetX <= 0) return false;
  const distance = Math.max(SWIPE_MIN_DISTANCE, rowWidth * SWIPE_RATIO);
  if (offsetX >= distance) return true;
  return offsetX >= SWIPE_FLICK_DISTANCE && velocityX >= SWIPE_FLICK_VELOCITY;
}
