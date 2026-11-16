import { t } from "@/lib/i18n";
import { Icon } from "@/components/icons";

interface StepMeterProps {
  /** 단계마다 마우스를 올리면 보여 줄 이름(질문·소개 제목). 개수가 곧 단계 수입니다. */
  labels: string[];
  /** 지금 단계(0부터). 단계 수와 같으면 모두 지난 단계로 보여요. */
  current: number;
  /** 지금 칸을 이 시간(ms)에 걸쳐 채웁니다. 자동 넘김까지 남은 시간을 보여 줍니다. */
  timedMs?: number;
  /** 단계를 누르면 부르는 함수. 앞 단계로 건너뛸 때의 필수 입력 검사는 부르는 쪽이 맡습니다. */
  onPick(index: number): void;
  disabled?: boolean;
}

type StepState = "done" | "current" | "next";

function stepState(index: number, current: number): StepState {
  if (index < current) return "done";
  return index === current ? "current" : "next";
}

const STATE_LABEL: Record<StepState, string> = {
  done: t("지난 단계"),
  current: t("지금 단계"),
  next: t("다음 단계"),
};

/**
 * 단계 이동 막대(Step player). 지금 단계는 길게 강조하고, 지난 단계는 체크로,
 * 남은 단계는 번호로 보여 줍니다. 눌러서 그 단계로 옮겨 갈 수 있어요.
 */
export function StepMeter({
  labels,
  current,
  timedMs,
  onPick,
  disabled = false,
}: StepMeterProps) {
  return (
    <ol className="ob-meter" aria-label={t("단계 이동")}>
      {labels.map((label, index) => {
        const state = stepState(index, current);
        const timed = state === "current" && !!timedMs;
        return (
          <li key={label} data-state={state}>
            <button
              type="button"
              className="ob-meter-step"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              // 이름은 번호와 상태만 읽어 줘요(단계 내용은 바로 아래 제목이 읽힘). 마우스에는 제목을 띄워요.
              aria-label={t("{number}단계 · {state}", {
                number: index + 1,
                state: STATE_LABEL[state],
              })}
              title={label}
              disabled={disabled}
              onClick={() => onPick(index)}
            >
              <span
                // 남은 시간 막대는 자동 넘김이 켜질 때마다 처음부터 다시 찹니다.
                // 상태만 바뀔 때는 같은 점을 두어 길이 전환이 이어지게 해요.
                key={timed ? "timed" : "dot"}
                className="ob-meter-dot"
                data-timed={timed || undefined}
                style={
                  timed ? { animationDuration: `${timedMs}ms` } : undefined
                }
                aria-hidden="true"
              >
                {state === "done" ? (
                  <Icon name="check" size={12} />
                ) : state === "next" || (state === "current" && !timed) ? (
                  index + 1
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
