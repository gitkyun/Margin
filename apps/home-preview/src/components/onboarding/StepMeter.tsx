interface StepMeterProps {
  count: number;
  /** 지금 단계(0부터). count와 같으면 모두 채웁니다. */
  current: number;
  /** 지금 칸을 이 시간(ms)에 걸쳐 채웁니다. 자동 넘김까지 남은 시간을 보여 줍니다. */
  timedMs?: number;
}

/** 단계 수만큼의 진행 막대. 넘어갈 때 다음 칸이 왼쪽부터 채워집니다. 글자 진행 표시가 따로 있어 보조 기술에서는 숨깁니다. */
export function StepMeter({ count, current, timedMs }: StepMeterProps) {
  return (
    <div className="ob-meter" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index === current && timedMs ? `timed-${index}` : index}
          data-on={index <= current || undefined}
          data-timed={(index === current && !!timedMs) || undefined}
          style={
            index === current && timedMs
              ? { animationDuration: `${timedMs}ms` }
              : undefined
          }
        />
      ))}
    </div>
  );
}
