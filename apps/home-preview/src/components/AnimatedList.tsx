import type { ReactNode } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";

interface AnimatedListProps {
  className: string;
  children: ReactNode;
}

/**
 * 항목이 생기거나 빠지거나 순서가 바뀔 때 자리를 부드럽게 옮기는 목록 판입니다
 * (@formkit/auto-animate). ‘동작 줄이기’를 켜면 움직이지 않습니다.
 */
export function AnimatedList({ className, children }: AnimatedListProps) {
  const [listRef] = useAutoAnimate<HTMLElement>();
  return (
    <section ref={listRef} className={className}>
      {children}
    </section>
  );
}
