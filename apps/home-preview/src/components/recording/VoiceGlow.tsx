import { VoiceBeam, type VoiceBeamMotion, type VoiceBeamProps } from "voice-glow";
import { useEffect, useState, type ReactNode } from "react";

/**
 * 목소리에 반응하는 빛(libraries.dev Voice, `voice-glow` MIT).
 * 감싼 요소의 아래 가장자리에서 음량만큼 빛이 차오르고, `processing`이면 빛이 한 줄기로 모여 좌우로 흘러요
 * (처리 중 움직임은 라이브러리의 `motion` 값으로 직접 만들어요).
 * 색은 Montage 파랑 계열 토큰만 써요(로그인 후 화면 색 규칙). 뒤를 비추거나 굴절시키지 않는 칠이에요.
 * 꾸밈이라 상태는 옆 글자·버튼 이름이 알려요. 동작 줄이기면 라이브러리가 움직임을 멈춰요.
 */
const GLOW_TOKENS = [
  "--atomic-blue-50",
  "--atomic-lightBlue-50",
  "--atomic-cyan-50",
  "--atomic-blue-60",
  "--atomic-lightBlue-60",
  "--atomic-blue-40",
  "--atomic-cyan-60",
];

/** 캔버스는 CSS 변수를 못 읽어서 계산된 색 값으로 넘겨요. 원자 색은 테마에 따라 바뀌지 않아요. */
function useGlowColors(): string[] | undefined {
  const [colors, setColors] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const values = GLOW_TOKENS.map((name) =>
      style.getPropertyValue(name).trim(),
    ).filter(Boolean);
    setColors(values.length ? values : undefined);
  }, []);
  return colors;
}

/** 분석기에서 지금 음량(0~1)을 재는 함수를 만들어요. 매 프레임 불러도 렌더가 일어나지 않아요. */
export function analyserLevel(
  analyser: () => AnalyserNode | null,
): () => number {
  let samples = new Uint8Array(128);
  return () => {
    const node = analyser();
    if (!node) return 0;
    if (samples.length !== node.fftSize) samples = new Uint8Array(node.fftSize);
    node.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
    // 말소리의 RMS는 0.02~0.3쯤이라 눈에 보이게 키워요.
    return Math.min(1, Math.sqrt(sum / samples.length) * 4);
  };
}

/** 처리 중: 빛을 한 줄기로 모아 3.6초에 한 번 좌우로 오가게 해요. */
const SWEEP_MS = 3600;
function sweepMotion(): VoiceBeamMotion {
  const phase = (performance.now() / SWEEP_MS) * Math.PI * 2;
  return {
    gather: 1,
    offset: Math.sin(phase) * 0.7,
    stretch: Math.abs(Math.cos(phase)) * 0.35,
    heldLevel: 0.5,
  };
}

export interface VoiceGlowProps {
  children: ReactNode;
  /** 마이크 스트림(있으면 level보다 먼저 써요) */
  stream?: MediaStream | null;
  /** 0~1 음량 또는 매 프레임 불리는 함수 */
  level?: VoiceBeamProps["level"];
  /** 듣는 중인지. 꺼지면 빛이 사라져요. */
  active: boolean;
  /** 답을 기다리는 중이면 빛이 모여 좌우로 흘러요. */
  processing?: boolean;
  /** 감싼 요소의 모양: 입력창(default) 또는 알약(pill) */
  type?: "default" | "pill";
  className?: string;
}

export function VoiceGlow({
  children,
  stream,
  level,
  active,
  processing = false,
  type = "default",
  className,
}: VoiceGlowProps) {
  const colors = useGlowColors();
  return (
    <VoiceBeam
      className={className}
      type={type}
      stream={stream}
      level={level}
      active={active || processing}
      motion={processing ? sweepMotion : null}
      colors={colors}
      staticColors
      theme="auto"
    >
      {children}
    </VoiceBeam>
  );
}
