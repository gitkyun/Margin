import { useEffect, useRef, useState } from "react";
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
  /** [글로 저장](IA v2 06 §2.4): 답이 200자 이상일 때만 보입니다. */
  onSaveDraft?: () => void;
  /** [이 글에 넣기]: 글을 열어 둔 때만 보입니다. */
  onInsert?: () => void;
  /** [할 일 추가]: 답에 할 일 제안이 있을 때만 보입니다. 누르면 제안 줄을 펼치거나 접습니다. */
  tasks?: {
    count: number;
    open: boolean;
    controls: string;
    onToggle: () => void;
  };
}

/** 이보다 짧은 답은 글로 저장할 만큼이 아니라 버튼을 두지 않습니다(06 §2.4). */
export const DRAFT_MIN_LENGTH = 200;

const COPIED_MS = 1800;

/**
 * 연구 도우미 답변 아래 줄: 아이콘 버튼(복사·다시 답하기) 다음에 글자 버튼(할 일 추가·글로 저장·이 글에 넣기)을 둡니다.
 */
export function AnswerActions({
  text,
  question,
  disabled,
  onRetry,
  onSaveDraft,
  onInsert,
  tasks,
}: AnswerActionsProps) {
  const [copied, setCopied] = useState(false);
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
      copyTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      toast.error(t("복사하지 못했어요. 답변을 직접 선택해 복사해 주세요."));
    }
  }
  const copyLabel = copied ? t("복사됨") : t("답변 복사");
  return (
    <div className="ai-answer-actions" role="group" aria-label={t("답변 동작")}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copyLabel}
        title={copyLabel}
        onClick={() => void copy()}
      >
        <Icon name={copied ? "check" : "copy"} size={16} />
      </Button>
      {question && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("같은 질문으로 다시 답하기")}
          title={t("다시 답하기")}
          disabled={disabled}
          onClick={() => onRetry(question)}
        >
          <Icon name="refresh" size={16} />
        </Button>
      )}
      {tasks && tasks.count > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={tasks.open}
          aria-controls={tasks.controls}
          onClick={tasks.onToggle}
        >
          <Icon name="tasks" size={15} />
          {t("할 일 추가")}
        </Button>
      )}
      {onSaveDraft && text.length >= DRAFT_MIN_LENGTH && (
        <Button type="button" variant="ghost" size="sm" onClick={onSaveDraft}>
          <Icon name="file" size={15} />
          {t("글로 저장")}
        </Button>
      )}
      {onInsert && (
        <Button type="button" variant="ghost" size="sm" onClick={onInsert}>
          <Icon name="edit" size={15} />
          {t("이 글에 넣기")}
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
