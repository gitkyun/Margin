interface StepMeterProps {
  count: number;
  /** 지금 단계(0부터). count와 같으면 모두 채웁니다. */
  current: number;
}

/** 단계 수만큼의 진행 막대. 넘어갈 때 다음 칸이 왼쪽부터 채워집니다. 글자 진행 표시가 따로 있어 보조 기술에서는 숨깁니다. */
export function StepMeter({ count, current }: StepMeterProps) {
  return (
    <div className="ob-meter" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} data-on={index <= current || undefined} />
      ))}
    </div>
  );
}
