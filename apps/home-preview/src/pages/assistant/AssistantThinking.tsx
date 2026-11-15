import { useEffect, useState } from "react";
import {
  AssistantFace,
  type AssistantState,
} from "@/components/brand/BotAvatar";
import { Icon } from "@/components/icons";
import type { AssistantStep } from "@/lib/assistant-steps";
import { t } from "@/lib/i18n";

/** 단계 하나를 보여 주는 시간(ms). 마지막 단계는 답이 올 때까지 머뭅니다. */
export const STEP_INTERVAL_MS = 1600;

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
 * 첫 질문: 대화 면 가운데에서 고른 도우미 봇이 생각하며 깡충거리고, 지금 읽는 것이 한 줄씩 바뀝니다.
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
          <AssistantFace state={mascot} active size={120} />
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
