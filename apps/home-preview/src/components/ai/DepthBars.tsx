/** 답변 깊이를 보여 주는 세 칸 신호 막대. 채운 칸이 많을수록 더 오래 생각해요. */
const FILLED: Record<string, number> = {
  minimal: 1,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 3,
  max: 3,
};

export function DepthBars({ level }: { level?: string }) {
  const filled = FILLED[level ?? ""] ?? 2;
  return (
    <span className="depth-bars" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <i key={n} data-on={n <= filled ? "true" : undefined} />
      ))}
    </span>
  );
}
