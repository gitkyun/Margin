import { useEffect, useRef, type ReactNode } from "react";

/**
 * 화면 아래에 붙는 줄(녹음 줄, 휴대폰 아래 탭)을 한 묶음으로 쌓습니다(02 §5).
 * 자기 높이를 셸 뿌리의 `--dock-height`로 내보내 본문·사이드 창이 그만큼 비켜 서게 합니다.
 */
export function BottomDock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dock = ref.current;
    const root = dock?.closest<HTMLElement>(".ia-shell");
    if (!dock || !root) return;
    const sync = () => {
      const height = `${dock.offsetHeight}px`;
      root.style.setProperty("--dock-height", height);
      document.documentElement.style.setProperty("--dock-height", height);
    };
    sync();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(sync);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--dock-height");
      document.documentElement.style.removeProperty("--dock-height");
    };
  }, []);
  return (
    <div ref={ref} className="ia-dock">
      {children}
    </div>
  );
}
