import type { MascotState } from "@/components/brand/Brand";
import AIToolCalls, {
  type ToolCallItem,
} from "@/components/kokonut/ai-tool-calls";
import {
  AIWaitStatus,
  useAIWaitElapsed,
} from "@/components/assistant-wait/AIWaitStatus";
import { aiWaitLevel, type AIWaitKind } from "@/lib/ai-wait";
import type { AssistantStep } from "@/lib/assistant-steps";
import { t } from "@/lib/i18n";

/**
 * 서버는 개별 도구 진행 이벤트를 주지 않으므로 실제 요청 대기 한 행만 표시합니다.
 * 답변이 오면 같은 자리의 AnswerSteps(Kokonut AI Tool Calls)로 바뀌어요.
 */
export function AssistantThinking({
  steps,
  startedAt,
  kind,
}: {
  first?: boolean;
  steps: AssistantStep[];
  mascot?: MascotState;
  question?: string;
  startedAt: number;
  kind: AIWaitKind;
}) {
  const elapsed = useAIWaitElapsed(startedAt);
  const level = aiWaitLevel(elapsed);
  const label = t("답변을 기다리고 있어요");
  if (!steps.length || level === "none") return null;
  return (
    <div className="ai-message assistant" role="status">
      {level === "detailed" ? (
        <AIWaitStatus
          startedAt={startedAt}
          kind={kind}
          label={label}
          keepsRunning
        />
      ) : (
        <AIToolCalls
          calls={[
            {
              id: "answer",
              tool: "answer",
              running: label,
              state: "input-available",
            },
          ]}
        />
      )}
    </div>
  );
}

export function WorkbenchLoading({
  label,
  detail,
  startedAt,
  kind,
}: {
  label: string;
  detail?: string;
  startedAt: number;
  kind: AIWaitKind;
}) {
  return (
    <AIWaitStatus
      startedAt={startedAt}
      kind={kind}
      label={label}
      detail={detail}
    />
  );
}

/** 受信 완료 뒤의 실제 요청 요약. 내부 도구 실행을 관측한 것처럼 표시하지 않습니다. */
export function AnswerSteps({
  steps,
}: {
  steps: Array<AssistantStep | string>;
  elapsedMs?: number;
}) {
  if (!steps.length) return null;
  const calls: ToolCallItem[] = [
    {
      id: "answer",
      tool: "answer",
      running: t("답변 요청"),
      done: t("답변 받음"),
      detail: steps
        .map((step) => (typeof step === "string" ? step : step.done))
        .join(" · "),
      state: "output-available",
    },
  ];
  return <AIToolCalls calls={calls} />;
}
