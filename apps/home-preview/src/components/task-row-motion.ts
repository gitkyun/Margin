import type { HTMLMotionProps } from "motion/react";

/**
 * 할 일 줄 움직임. 완료된 줄은 줄 그은 채 잠깐 머문 뒤(use-task-completion) 높이가 접히며
 * 빠지고, 남은 줄은 제자리로 미끄러집니다. 동작 줄이기 설정이면 MotionConfig가 생략합니다.
 */
export const taskRowMotion = {
  layout: "position",
  initial: false,
  exit: {
    opacity: 0,
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: "hidden",
  },
  transition: { duration: 0.22, ease: [0.2, 0, 0, 1] },
} satisfies HTMLMotionProps<"div">;
