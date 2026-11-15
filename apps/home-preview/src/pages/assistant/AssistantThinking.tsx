import { useEffect, useState } from "react";
import { AssistantMascot, type MascotState } from "@/components/brand/Brand";
import { Icon } from "@/components/icons";
import type { AssistantStep } from "@/lib/assistant-steps";
import { t } from "@/lib/i18n";

/** 실제 시계로 경과 시간(초)을 잽니다. 가짜 타이머나 가짜 진행률은 쓰지 않아요. */
function useElapsedSeconds(active: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 200);
    return () => window.clearInterval(timer);
  }, [active]);
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

/**
 * 답을 기다리는 동안의 표시(Kokonut AI State Loading + AI Tool Calls 기준).
 * 가짜 진행률 대신 실제 경과 시간과 현재 단계 목록을 보여 줘요.
 */
export function AssistantThinking({
  first,
  steps,
  mascot,
  question,
}: {
  first: boolean;
  steps: AssistantStep[];
  mascot: MascotState;
  /** 첫 질문 화면 아래에 작게 보여 줄 내 질문 */
  question?: string;
}) {
  const elapsed = useElapsedSeconds(true);
  const primary = steps[0];
  if (!primary) return null;
  if (first)
    return (
      <div className="ai-reading" role="status">
        <span className="ai-reading-logo">
          <AssistantMascot state={mascot} active size={120} eager />
        </span>
        <p className="ai-reading-now">
          <span>{primary.doing}</span>
        </p>
        <span className="ai-tool-elapsed" aria-label={t("경과 시간")}>
          {elapsed}
        </span>
        <ol className="ai-reading-steps">
          {steps.map((step, position) => (
            <li
              key={step.doing}
              className={position === 0 ? "is-current" : undefined}
            >
              <Icon name={position === 0 ? "sparkles" : "check"} size={14} />
              {step.doing}
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
        <AssistantMascot state={mascot} active size={32} eager />
        <span className="ai-step-window">
          <span className="ai-step-text">{primary.doing}</span>
        </span>
        <span className="ai-tool-elapsed">{elapsed}</span>
      </div>
    </div>
  );
}

/** 작업대·수정 제안 패널에서 쓰는 통합 대기 표시(Kokonut AI State Loading). */
export function WorkbenchLoading({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  const elapsed = useElapsedSeconds(true);
  return (
    <div className="ai-running ai-workbench-loading" role="status">
      <div className="ai-workbench-loading-head">
        <span className="ai-workbench-loading-dot" aria-hidden="true" />
        <strong>{label}</strong>
        <span className="ai-tool-elapsed">{elapsed}</span>
      </div>
      {detail && <small>{detail}</small>}
    </div>
  );
}

/** 답 아래에 붙는 접힌 한 줄 요약(Kokonut AI Tool Calls). 누르면 거친 단계를 펼쳐요. */
export function AnswerSteps({
  steps,
  elapsedMs,
}: {
  steps: Array<AssistantStep | string>;
  elapsedMs?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const elapsedLabel =
    elapsedMs !== undefined ? `${(elapsedMs / 1000).toFixed(1)}s` : null;
  return (
    <div className="ai-tool-summary">
      <button
        type="button"
        className="ai-tool-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="sparkles" size={12} />
        <span>
          {t("거친 단계 {count}개", { count: steps.length })}
          {elapsedLabel ? ` · ${elapsedLabel}` : ""}
        </span>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={12} />
      </button>
      {open && (
        <p className="ai-answer-steps">
          {steps.map((step, index) => {
            const label = typeof step === "string" ? step : step.done;
            return (
              <span key={`${index}:${label}`} className="ai-answer-step">
                {index > 0 && <Icon name="chevron-right" size={12} />}
                {label}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
