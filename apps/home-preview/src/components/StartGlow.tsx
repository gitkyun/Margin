import { useRef, type CSSProperties, type ReactNode } from "react";
import { useInView } from "motion/react";
import "./start-glow.css";

/**
 * 시작 버튼 둘레를 빛이 한 바퀴만 도는 강조(docs/design/patterns.md §3 ‘강조’).
 * 버튼 모양은 건드리지 않고 감싼 요소의 ::before로 그립니다. 화면에 처음 들어올 때
 * 한 번만 돌고, 올리거나 다시 스크롤해도 반복하지 않습니다. 동작 줄이기에서는 돌지 않습니다.
 */
export function StartGlow({
  children,
  delay = 0,
  tone = "brand",
}: {
  children: ReactNode;
  /** 먼저 끝나야 하는 등장 움직임이 있을 때 기다리는 시간(ms) */
  delay?: number;
  /** 브랜드 색 배경 위에서는 "on-brand" */
  tone?: "brand" | "on-brand";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 1 });
  return (
    <span
      ref={ref}
      className={`rms-start-glow rms-start-glow-${tone}`}
      data-run={seen ? "true" : undefined}
      style={{ "--start-glow-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </span>
  );
}
