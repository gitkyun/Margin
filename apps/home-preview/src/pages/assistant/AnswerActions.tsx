import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { t } from "@/lib/i18n";
import AIHandoff from "@/components/kokonut/ai-handoff";

export interface AnswerActionsProps {
  /** 복사할 답변 원문 */
  text: string;
  /** 이 답변을 낳은 질문. 없으면 다시 답하기를 보여 주지 않아요. */
  question?: string;
  /** 실행 중이거나 쓸 수 없을 때 다시 답하기를 막아요. */
  disabled: boolean;
  onRetry(question: string): void;
}

/**
 * 연구 도우미 답변 아래 동작 줄: 복사(체크 아이콘 피드백), 다시 답하기, 교수님 검토로 넘기기(Kokonut AI Handoff).
 */
export function AnswerActions({
  text,
  question,
  disabled,
  onRetry,
}: AnswerActionsProps) {
  const { researchId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("복사하지 못했어요. 답변을 직접 선택해 복사해 주세요."));
    }
  }
  return (
    <div className="ai-answer-actions-wrap">
      <div
        className="ai-answer-actions"
        role="group"
        aria-label={t("답변 동작")}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("답변 복사")}
          onClick={() => void copy()}
        >
          <Icon name={copied ? "check" : "copy"} size={15} />
          {copied ? t("복사됨") : t("복사")}
        </Button>
        {question && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("같은 질문으로 다시 답하기")}
            disabled={disabled}
            onClick={() => onRetry(question)}
          >
            <Icon name="refresh" size={15} />
            {t("다시 답하기")}
          </Button>
        )}
        {researchId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ai-handoff-button"
            aria-expanded={handoffOpen}
            onClick={() => setHandoffOpen((v) => !v)}
          >
            <Icon name="send" size={14} />
            {t("교수님 검토로 넘기기")}
          </Button>
        )}
      </div>
      {handoffOpen && researchId && (
        <AIHandoff
          team={t("교수님 검토")}
          status="waiting"
          position={0}
          agents={[]}
          shared={[
            t("연구 이름과 연구 방향(목적·연구 질문)"),
            t("검토 요청에서 직접 골라 공유하는 수정 결과와 첨부 파일"),
            t("이 AI 대화와 개인 메모는 공유되지 않아요."),
          ]}
          waitingLabel={t("검토 요청 전")}
          waitHint={t("검토 요청에서 공유할 항목을 직접 골라요.")}
          actionLabel={t("검토 요청 만들기")}
          onStay={() => navigate(`/r/${researchId}/reviews?new=1`)}
        />
      )}
    </div>
  );
}

/** i번째 답변 바로 앞에 있는 사용자 질문을 찾아요. */
export function questionBefore(
  messages: ReadonlyArray<{ role: string; text: string }>,
  index: number,
): string | undefined {
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].text;
  }
  return undefined;
}
