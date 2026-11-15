import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * 안쪽 내용의 높이를 재서 바깥 높이를 부드럽게 맞춥니다(질문 단계 전환 시 카드 높이 보간).
 * 높이 전환은 CSS(.ob-auto-height)가 맡고, 동작 줄이기 설정이면 바로 바뀝니다.
 * ResizeObserver가 없는 환경에서는 높이를 정하지 않아 원래대로 보여요.
 */
export function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className="ob-auto-height"
      style={height === undefined ? undefined : { height }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
