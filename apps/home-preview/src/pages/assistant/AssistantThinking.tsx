import { useEffect, useState } from "react";
import { type AssistantState } from "@/components/brand/BotAvatar";
import { AssistantFace } from "@/components/brand/BotAvatar";
import { Icon } from "@/components/icons";
import type { AssistantStep } from "@/lib/assistant-steps";
import { t } from "@/lib/i18n";

/** 단계 하나를 보여 주는 시간(ms). 마지막 단계는 답이 올 때까지 머뭅니다. */
export const STEP_INTERVAL_MS = 1600;

const CARD_BACK =
  "M59 97.5C59 91.9176 63.1777 83.9444 69.5 81.1532L127.843 56.1241C135.57 52.6351 144 57.5197 144 67.289V111.948C144 118.229 140.488 123.113 134.165 125.904L70.2397 153.119C63.9174 155.91 59 151.723 59 145.443L59 97.5Z";
const CARD_FRONT =
  "M16 73.5C16 66.9611 21.7215 57.2094 29.0777 53.94L96.1009 24.3548C105.092 20.268 114.9 25.9895 114.9 37.4325V89.7433C114.9 97.0995 110.813 102.821 103.457 106.09L29.0777 137.967C21.7215 141.237 16 136.333 16 128.976C16 128.976 16 80.0389 16 73.5Z";

/**
 * 마진 심볼의 두 장이 서로 자리를 바꿉니다(첫 대화에서 연구를 읽는 동안).
 * 한 장이 커지며 앞으로 튀어 오르는 동안 다른 장은 작아지며 물러나고, 색 농도가 천천히 맞바뀝니다.
 * 겹친 곳은 따로 그리지 않고 두 장의 투명도가 겹쳐 진해지게 둡니다.
 */
export function LogoFlip({ size = 112 }: { size?: number }) {
  return (
    <svg
      className="ai-logo-flip"
      width={size}
      viewBox="-20 -20 200 210"
      fill="none"
      aria-hidden="true"
    >
      <path className="ai-logo-back" d={CARD_BACK} />
      <path className="ai-logo-front" d={CARD_FRONT} />
    </svg>
  );
}

/** 단계를 일정한 간격으로 하나씩 넘깁니다. 마지막 단계에서 멈춥니다. */
function useStepIndex(count: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (index >= count - 1) return;
    const timer = window.setTimeout(
      () => setIndex((current) => current + 1),
      STEP_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [index, count]);
  return Math.min(index, count - 1);
}

/**
 * 답을 기다리는 동안의 표시.
 * 첫 질문: 대화 면 전체에 심볼이 앞뒤로 바뀌고, 지금 읽는 것이 한 줄씩 바뀝니다.
 * 그다음부터: 도우미 얼굴 옆에서 단계 글자가 위로 넘어갑니다.
 */
export function AssistantThinking({
  first,
  steps,
  mascot,
  question,
}: {
  first: boolean;
  steps: AssistantStep[];
  mascot: AssistantState;
  /** 계정 설정에서 고른 도우미 아바타. 없으면 마스코트를 씁니다. */
  /** 첫 질문 화면 아래에 작게 보여 줄 내 질문 */
  question?: string;
}) {
  const index = useStepIndex(steps.length);
  const current = steps[index];
  if (!current) return null;
  if (first)
    return (
      <div className="ai-reading" role="status">
        <span className="ai-reading-logo">
          <LogoFlip />
        </span>
        {/* 지금 읽는 것 한 줄이 크게 바뀌고, 읽은 것은 아래에 작게 쌓입니다. */}
        <p className="ai-reading-now">
          <span key={current.doing}>{current.doing}</span>
        </p>
        <span className="ai-reading-progress" aria-hidden="true">
          {steps.map((step, position) => (
            <i
              key={step.doing}
              className={
                position < index
                  ? "is-done"
                  : position === index
                    ? "is-current"
                    : ""
              }
            />
          ))}
        </span>
        <ol className="ai-reading-steps">
          {steps.slice(0, index).map((step) => (
            <li key={step.doing}>
              <Icon name="check" size={14} />
              {step.done}
            </li>
          ))}
        </ol>
        {question && <p className="ai-reading-question">{question}</p>}
        <small>{t("답변이 나와도 연구 기록은 바뀌지 않아요.")}</small>
      </div>
    );
  return (
    <div className="ai-processing" role="status">
      <div className="ai-step-pill">
        <AssistantFace state={mascot} active size={32} />
        <span className="ai-step-window">
          <span key={current.doing} className="ai-step-text">
            {current.doing}
          </span>
        </span>
      </div>
    </div>
  );
}

/** 답 아래에 붙는 '거친 단계'. 이번 화면에서 받은 답에만 보입니다. */
export function AnswerSteps({ steps }: { steps: AssistantStep[] }) {
  if (!steps.length) return null;
  return (
    <p className="ai-answer-steps">
      <span>{t("거친 단계")}</span>
      {steps.map((step, index) => (
        <span key={step.done} className="ai-answer-step">
          {index > 0 && <Icon name="chevron-right" size={12} />}
          {step.done}
        </span>
      ))}
    </p>
  );
}
