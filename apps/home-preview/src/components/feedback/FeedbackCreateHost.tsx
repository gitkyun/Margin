import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DialogBody } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace";
import { useOpenDetail } from "@/lib/item-detail";
import { recordBase, type BaseRecord } from "@/lib/domain";
import { t } from "@/lib/i18n";
import {
  ErrorNotice,
  FormDialog,
  LabeledInput,
  LabeledText,
  SaveActions,
  useSaving,
} from "@/pages/student/shared";

/** `?new=feedback`면 true(01 §3.3) */
export function newFeedbackRequest(search: string): boolean {
  return new URLSearchParams(search).get("new") === "feedback";
}

/** 창을 연 뒤 주소에서 `new=feedback`을 지운 검색어. 다른 값(보기·필터)은 남깁니다. */
export function withoutNewFeedback(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("new");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * 어느 화면에서든 피드백 직접 추가 창을 그 자리에서 엽니다(01 §3.3 `new=feedback`).
 * ⌘K '피드백 추가'와 할 일 화면 피드백 보기의 [피드백 추가]가 이 주소를 씁니다.
 * 저장하면 지금 화면 위에 그 피드백의 항목 상세를 엽니다. 미팅 기록에서 고른 문장으로 만드는 창은 미팅 화면에 따로 있습니다.
 */
export function FeedbackCreateHost({ researchId }: { researchId: string }) {
  const { save } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const openDetail = useOpenDetail();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const form = useSaving();
  // 같은 창에서 다시 저장해도(네트워크 오류 뒤 재시도) 한 건만 생기도록 id를 창마다 한 번 정합니다.
  const base = useRef<BaseRecord | null>(null);

  useEffect(() => {
    if (!newFeedbackRequest(location.search)) return;
    base.current = recordBase(researchId);
    setTitle("");
    setBody("");
    form.setError(null);
    setOpen(true);
    navigate(
      {
        pathname: location.pathname,
        search: withoutNewFeedback(location.search),
        hash: location.hash,
      },
      { replace: true, state: location.state },
    );
  }, [location.search, researchId]);

  return (
    <FormDialog
      busy={form.saving}
      open={open}
      onOpenChange={setOpen}
      title={t("피드백 직접 추가")}
      description={t("직접 작성한 피드백으로 저장돼요.")}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || !body.trim()) {
            form.setError(t("제목과 피드백 내용을 입력해 주세요."));
            return;
          }
          void form.perform(async () => {
            base.current ??= recordBase(researchId);
            const item = await save("feedback", {
              ...base.current,
              origin: "manual",
              title: title.trim(),
              body: body.trim(),
              notes: "",
              status: "unprocessed",
            });
            setOpen(false);
            openDetail({ kind: "feedback", id: item.id });
            toast.success(t("피드백을 저장했어요"));
          });
        }}
      >
        <DialogBody>
          <LabeledInput
            label={t("제목")}
            required
            value={title}
            onChange={setTitle}
          />
          <LabeledText
            label={t("피드백 내용")}
            required
            value={body}
            onChange={setBody}
          />
          <ErrorNotice error={form.error} />
        </DialogBody>
        <SaveActions saving={form.saving} onCancel={() => setOpen(false)} />
      </form>
    </FormDialog>
  );
}
