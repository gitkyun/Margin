import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDisabledReason } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import { recordBase, type AIContext } from "@/lib/domain";
import { answerDocument, draftTitle } from "@/lib/answer-doc";

export interface DraftSource {
  text: string;
  question?: string;
  contexts: AIContext[];
}

/**
 * 답 아래 [글로 저장](IA v2 06 §2.4, 05 §3.9): 제목을 묻고 글·자료에 '메모' 글로 저장합니다.
 * 초안은 나만 보기로 만들고, 근거로 쓴 기록은 본문 없이 종류·제목만 `draftedFrom`에 남깁니다.
 */
export function SaveDraftDialog({
  researchId,
  source,
  onClose,
}: {
  researchId: string;
  source: DraftSource | null;
  onClose: () => void;
}) {
  const { save } = useWorkspace();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  // 실패 뒤 다시 눌러도 같은 id로 저장해 글이 두 개 생기지 않게 합니다.
  const base = useRef<ReturnType<typeof recordBase> | null>(null);
  const reason = useDisabledReason(
    !title.trim() && t("제목을 적으면 저장할 수 있어요."),
  );
  useEffect(() => {
    if (!source) return;
    base.current = null;
    setTitle(draftTitle(source.text, source.question));
  }, [source]);
  async function submit() {
    if (!source || busy || !title.trim()) return;
    setBusy(true);
    base.current ??= recordBase(researchId);
    try {
      const { content, text } = answerDocument(source.text);
      const doc = await save("documents", {
        ...base.current,
        title: title.trim(),
        type: "note",
        visibility: "private",
        content,
        text,
        revision: 0,
        origin: "ai",
        draftedFrom: source.contexts
          .filter((c) => c.kind !== "recordings")
          .map(({ kind, id, title: name }) => ({ kind, id, title: name })),
      });
      onClose();
      toast.success(t("글로 저장했어요."), {
        action: {
          label: t("열기"),
          onClick: () => navigate(`/r/${researchId}/docs/w/${doc.id}`),
        },
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!source}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>{t("글로 저장")}</DialogTitle>
          <DialogDescription>
            {t(
              "글·자료에 '메모' 글로 저장해요. 처음에는 나만 볼 수 있고, 저장한 뒤 고쳐 쓸 수 있어요.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DialogBody>
            <label className="field">
              <span>{t("제목 (필수)")}</span>
              <Input
                autoFocus
                value={title}
                maxLength={300}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {reason.node}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {t("취소")}
            </Button>
            <Button
              type="submit"
              disabled={busy || !title.trim()}
              aria-describedby={reason.describedBy}
            >
              {busy ? t("저장 중") : t("저장")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
