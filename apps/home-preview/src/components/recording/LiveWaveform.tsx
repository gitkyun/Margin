import { useEffect, useRef } from "react";
import "./recording.css";

/** 막대 수. 좁은 화면에서도 막대 사이가 보이도록 너무 많지 않게 둬요. */
const BARS = 40;
/** 막대 최소 높이 비율. 조용해도 막대 자리가 보여요. */
const FLOOR = 0.08;

interface LiveWaveformProps {
  /** 매 프레임 분석기를 가져와요(녹음이 끝나면 null). */
  analyser: () => AnalyserNode | null;
  /** 일시정지 중이면 막대를 바닥에 둬요. */
  active: boolean;
  label: string;
}

/**
 * 마이크 음량에 반응하는 막대 파형. React 렌더 없이 막대 높이만 바꿔요.
 * 동작 줄이기를 켜면 4프레임에 한 번만 갱신해요(정보는 유지하고 깜빡임만 줄여요).
 */
export function LiveWaveform({ analyser, active, label }: LiveWaveformProps) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;
  // 부모가 렌더할 때마다 새 함수가 와도 그리기 고리를 다시 만들지 않아요.
  const source = useRef(analyser);
  source.current = analyser;
  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0,
      tick = 0;
    let samples = new Uint8Array(128);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (reduce && tick++ % 4) return;
      const node = source.current();
      if (node && samples.length !== node.frequencyBinCount)
        samples = new Uint8Array(node.frequencyBinCount);
      if (node && activeRef.current) node.getByteTimeDomainData(samples);
      const per = Math.max(1, Math.floor(samples.length / BARS));
      bars.current.forEach((bar, b) => {
        if (!bar) return;
        let peak = 0;
        if (node && activeRef.current)
          for (let j = 0; j < per; j++)
            peak = Math.max(
              peak,
              Math.abs((samples[b * per + j] ?? 128) - 128),
            );
        const scale = Math.max(FLOOR, Math.min(1, (peak / 128) * 1.6));
        bar.style.transform = `scaleY(${scale.toFixed(3)})`;
      });
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="live-waveform" role="img" aria-label={label}>
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}
