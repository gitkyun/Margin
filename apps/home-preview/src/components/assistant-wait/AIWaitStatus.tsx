import { useEffect, useState } from "react";
import AILoadingState from "@/components/kokonut/ai-loading";
import {
  AI_WAIT_TYPICAL_SECONDS,
  aiWaitLevel,
  elapsedSeconds,
  type AIWaitKind,
} from "@/lib/ai-wait";
import { t } from "@/lib/i18n";
import "./ai-wait.css";

/** 요청을 보낸 뒤 지난 시간(ms). 1초마다 다시 그려요. */
export function useAIWaitElapsed(startedAt: number, now?: number) {
  const [tick, setTick] = useState(() => now ?? Date.now());
  useEffect(() => {
    if (now !== undefined) return;
    setTick(Date.now());
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [now, startedAt]);
  return (now ?? tick) - startedAt;
}

/**
 * AI 요청 대기 표시. 서버가 단계별 진행을 알려 주지 않으므로, 화면에서 실제로
 * 알 수 있는 단계(요청 보냄 → 답 기다리는 중 → 받은 결과 정리)만 보여 줘요.
 * 이 화면의 요청은 화면을 떠나면 취소되므로(언마운트 시 abort) 그 사실을 알려요.
 */
export function AIWaitStatus({
  startedAt,
  kind,
  label,
  detail,
  now,
  keepsRunning = false,
}: {
  /** 요청을 보낸 시각(Date.now()) */
  startedAt: number;
  kind: AIWaitKind;
  /** 지금 단계 이름 */
  label: string;
  detail?: string;
  /** 테스트용 현재 시각 고정 */
  now?: number;
  /** 화면을 떠나도 서버가 끝까지 만들고 돌아오면 이어 받는 요청인지(연구 도우미) */
  keepsRunning?: boolean;
}) {
  const elapsed = useAIWaitElapsed(startedAt, now);
  const level = aiWaitLevel(elapsed);
  const [min, max] = AI_WAIT_TYPICAL_SECONDS[kind];

  return (
    <div className="ai-wait">
      {/* 단계가 바뀔 때만 읽어요. 초 단위 변화는 읽지 않아요. */}
      <p className="sr-only" aria-live="polite">
        {level === "none"
          ? ""
          : level === "spinner"
            ? label
            : t("시간이 조금 걸리고 있어요. {label}", { label })}
      </p>
      {level === "spinner" && (
        <AILoadingState
          steps={[
            {
              id: "wait",
              label,
              status: "running",
              detail: detail ? [detail] : undefined,
            },
          ]}
        />
      )}
      {level === "detailed" && (
        <div className="ai-wait-detail">
          <ol className="ai-wait-steps">
            <li data-state="done">
              <span className="ai-wait-mark" aria-hidden="true">
                ✓
              </span>
              <span>
                {t("요청을 보냈어요")}
                <span className="sr-only">{t("(끝남)")}</span>
              </span>
            </li>
            <li data-state="current" aria-current="step">
              <span className="ai-wait-mark" aria-hidden="true" />
              <span>{label}</span>
            </li>
            <li data-state="upcoming">
              <span className="ai-wait-mark" aria-hidden="true" />
              <span>
                {t("받은 결과를 정리해요")}
                <span className="sr-only">{t("(남음)")}</span>
              </span>
            </li>
          </ol>
          <p className="ai-wait-time">
            {t("지난 시간 {seconds}초 · 보통 {min}~{max}초", {
              seconds: elapsedSeconds(elapsed),
              min,
              max,
            })}
          </p>
          {detail && <p className="ai-wait-note">{detail}</p>}
          <p className="ai-wait-note">
            {keepsRunning
              ? t(
                  "다른 화면으로 가도 답은 계속 만들어요. 다시 열면 이어서 보여 드려요.",
                )
              : t(
                  "이 화면을 떠나면 멈춰요. 끝날 때까지 이 화면에 있어 주세요.",
                )}
          </p>
        </div>
      )}
    </div>
  );
}
