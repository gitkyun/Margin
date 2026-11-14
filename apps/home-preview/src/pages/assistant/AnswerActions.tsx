import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { t } from "@/lib/i18n";

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
 * 연구 도우미 답변 아래 동작 줄(감사 F4): 복사, 다시 답하기.
 * ‘저장’은 넣지 않습니다. 자유 질문 답변을 담을 서버 저장 대상이 없고,
 * 답변은 이미 대화 기록에 남아 있어요.
 */
export function AnswerActions({
  text,
  question,
  disabled,
  onRetry,
}: AnswerActionsProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("복사했어요"));
    } catch {
      toast.error(t("복사하지 못했어요. 답변을 직접 선택해 복사해 주세요."));
    }
  }
  return (
    <div className="ai-answer-actions" role="group" aria-label={t("답변 동작")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("답변 복사")}
        onClick={() => void copy()}
      >
        <Icon name="copy" size={15} />
        {t("복사")}
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
