import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Segments } from "@/components/experience";
import type { Feedback } from "@/lib/domain";

export interface SuggestRequest {
  scope: "selection" | "all";
  question: string;
  feedbackIds: string[];
}

/**
 * 수정 제안받기(IA v2 05 §3.6): 보낼 글(고른 부분 / 글 전체)과 지시·근거를 확인하고 보냅니다.
 * 저장한 글을 서버가 읽으므로, 저장하지 않은 변경은 보내기 전에 먼저 저장합니다.
 */
export function SuggestRequestDialog({
  open,
  onOpenChange,
  hasSelection,
  feedback,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSelection: boolean;
  feedback: { feedback: Feedback; number: number }[];
  busy: boolean;
  onSubmit: (request: SuggestRequest) => void;
}) {
  const [scope, setScope] = useState<SuggestRequest["scope"]>("all");
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    setScope(hasSelection ? "selection" : "all");
    setPicked([]);
  }, [open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>{t("수정 제안받기")}</DialogTitle>
          <DialogDescription>
            {t(
              "저장한 글을 연구 도우미에게 보내요. 제안은 나만 보고, 적용해야 글이 바뀌어요.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            onSubmit({ scope, question: question.trim(), feedbackIds: picked });
          }}
        >
          <DialogBody>
            {hasSelection && (
              <Segments
                fill
                label={t("보낼 범위")}
                value={scope}
                onChange={(v) => setScope(v as SuggestRequest["scope"])}
                options={[
                  { value: "selection", label: t("고른 부분") },
                  { value: "all", label: t("글 전체") },
                ]}
              />
            )}
            <label className="field">
              <span>{t("지시 (선택)")}</span>
              <Textarea
                value={question}
                maxLength={2000}
                rows={3}
                placeholder={t("예: 문장을 더 간결하게, 용어를 하나로 맞춰서")}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
            {feedback.length > 0 && (
              <fieldset className="suggest-request-feedback">
                <legend>{t("반영할 피드백 (선택)")}</legend>
                {feedback.map(({ feedback: item, number }) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={picked.includes(item.id)}
                      onChange={(e) =>
                        setPicked((prev) =>
                          e.target.checked
                            ? [...prev, item.id]
                            : prev.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span className="editor-gutter-num" aria-hidden>
                      {number}
                    </span>
                    <span>{item.title}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {t("취소")}
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? t("제안받는 중") : t("제안받기")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
