import {
  SWIPE_FLICK_DISTANCE,
  SWIPE_FLICK_VELOCITY,
  SWIPE_MIN_DISTANCE,
  SWIPE_RATIO,
} from "@/lib/swipe-toggle";

/**
 * 스와이프 행이 어느 방향 동작을 실행할지 정해요(할 일 완료 스와이프와 같은 기준).
 * 행 너비의 30%(최소 88px) 넘게 밀었거나, 짧게라도 빠르게 튕기면 그 방향. 아니면 실행하지 않아요.
 */
export function shouldSwipe(
  offsetX: number,
  velocityX: number,
  rowWidth: number,
): "start" | "end" | null {
  const distance = Math.max(SWIPE_MIN_DISTANCE, rowWidth * SWIPE_RATIO);
  const abs = Math.abs(offsetX);
  const fast =
    abs >= SWIPE_FLICK_DISTANCE &&
    Math.abs(velocityX) >= SWIPE_FLICK_VELOCITY &&
    Math.sign(velocityX) === Math.sign(offsetX);
  if (abs < distance && !fast) return null;
  return offsetX > 0 ? "start" : "end";
}
