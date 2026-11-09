import { useReducedMotion, type HTMLMotionProps } from "motion/react";

/**
 * 할 일 줄 움직임. 완료된 줄은 줄 그은 채 잠깐 머문 뒤(use-task-completion) 높이가 접히며
 * 빠지고, 남은 줄은 제자리로 미끄러집니다(부품 단계: 퇴장 160ms, docs/design/patterns.md §3).
 *
 * MotionConfig의 reducedMotion="user"는 이동·배치만 끄고 높이·투명도는 남기므로,
 * 동작 줄이기 설정이면 여기서 접힘을 직접 없애고 바로 빠지게 합니다.
 */
const taskRowMotion = {
  layout: "position",
  initial: false,
  exit: {
    opacity: 0,
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: "hidden",
  },
  transition: { duration: 0.16, ease: [0.3, 0, 1, 1] },
} satisfies HTMLMotionProps<"div">;

const reducedTaskRowMotion = {
  initial: false,
  exit: { opacity: 0 },
  transition: { duration: 0 },
} satisfies HTMLMotionProps<"div">;

export function useTaskRowMotion() {
  return useReducedMotion() ? reducedTaskRowMotion : taskRowMotion;
}
