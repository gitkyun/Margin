import { t } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import { Disclosure } from "@/components/ui/disclosure";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import {
  recordBase,
  type AIInput,
  type Feedback,
  type RevisionPlan,
} from "@/lib/domain";
import {
  emptyPlan,
  planFromCandidate,
  taskFromPlan,
} from "@/lib/feedback-plans";
import {
  ErrorNotice,
  FormDialog,
  LabeledInput,
  LabeledText,
  SaveActions,
  useSaving,
} from "@/pages/student/shared";
import { RevisionSuggestions } from "@/pages/student/RevisionSuggestions";
import { isAISourceStale } from "@/pages/student/ai-source";

/**
 * 항목 상세의 수정 방법 구획(IA v2 06 §6.2): 저장한 방법 · [직접 쓰기] · [연구 도우미에게 제안받기].
 * AI 제안은 [이 방법 선택]이나 고쳐 쓰기로 저장할 때만 남습니다. 선택은 완료가 아니고, 선택 취소·다시 선택이 됩니다.
 * 방법에서 [할 일 추가]는 제안된 할 일을 미리 채워 바로 만들고 6초 동안 되돌릴 수 있습니다.
 */
export function FeedbackPlans({
  researchId,
  feedback,
  plans,
}: {
  researchId: string;
  feedback: Feedback;
  plans: RevisionPlan[];
}) {
  const { data, save, remove } = useWorkspace();
  const [draft, setDraft] = useState<RevisionPlan | null>(null);
  const form = useSaving();
  const [aiInput, setAiInput] = useState<AIInput | null>(null);
  const [aiRun, setAiRun] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const saved = plans.filter((plan) => plan.status === "saved");
  const cancelled = plans.filter((plan) => plan.status === "cancelled");
  const aiStale =
    !!aiInput && isAISourceStale(aiInput, { text: feedback.body });
  const isQuoteInSource = (quote: string) =>
    feedback.body.includes(quote) || feedback.sourceQuote === quote;

  function openAI() {
    if (!aiInput || aiStale) {
      setAiInput({
        mode: "suggest_revisions",
        researchId,
        feedbackId: feedback.id,
        sourceText: feedback.body,
      });
      setAiRun((value) => value + 1);
    }
    setAiOpen(true);
  }

  async function setStatus(plan: RevisionPlan, status: RevisionPlan["status"]) {
    setBusy(plan.id);
    try {
      await save("plans", { ...plan, status });
      toast.success(
        status === "cancelled"
          ? t("선택을 취소했어요. 만든 할 일은 그대로 있어요.")
          : t("방법을 다시 선택했어요"),
        status === "cancelled"
          ? {
              duration: 6000,
              action: {
                label: t("되돌리기"),
                onClick: () =>
                  void save("plans", { ...plan, status: "saved" }).catch(
                    (error) => toast.error(friendlyError(error)),
                  ),
              },
            }
          : undefined,
      );
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(null);
    }
  }

  async function addTask(plan: RevisionPlan) {
    setBusy(plan.id);
    try {
      const task = await save(
        "tasks",
        taskFromPlan(plan, recordBase(researchId)),
      );
      toast.success(t("할 일을 추가했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => void remove("tasks", task.id),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(null);
    }
  }

  const isNew = !!draft && !plans.some((plan) => plan.id === draft.id);

  return (
    <>
      {saved.map((plan, index) => {
        const taskCount = data.tasks.filter(
          (task) => task.planId === plan.id && !task.archivedAt,
        ).length;
        return (
          <article key={plan.id} className="item-detail-plan">
            <small className="item-detail-plan-index">
              {t("방법 {number}", { number: index + 1 })}
              {plan.origin === "ai" && ` · ${t("AI 제안")}`}
            </small>
            <strong>{plan.title}</strong>
            {plan.method && <p>{plan.method}</p>}
            {plan.expectedResult && (
              <p className="item-detail-plan-extra">
                <span>{t("예상 결과")}</span> {plan.expectedResult}
              </p>
            )}
            {plan.requiredMaterials && (
              <p className="item-detail-plan-extra">
                <span>{t("필요한 자료·준비할 것")}</span>{" "}
                {plan.requiredMaterials}
              </p>
            )}
            {plan.assumptions && (
              <p className="item-detail-plan-extra">
                <span>{t("확인이 필요한 가정")}</span> {plan.assumptions}
              </p>
            )}
            <div className="item-detail-plan-actions">
              <small>{t("할 일 {count}개", { count: taskCount })}</small>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("{title} 편집", { title: plan.title })}
                disabled={busy === plan.id}
                onClick={() => {
                  setDraft({ ...plan });
                  form.setError(null);
                }}
              >
                <Icon name="edit" size={15} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === plan.id}
                onClick={() => void setStatus(plan, "cancelled")}
              >
                {t("선택 취소")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === plan.id}
                onClick={() => void addTask(plan)}
              >
                <Icon name="plus" size={15} />
                {t("할 일 추가")}
              </Button>
            </div>
          </article>
        );
      })}
      {!saved.length && (
        <p className="item-detail-empty">
          {t("아직 정한 수정 방법이 없어요.")}
        </p>
      )}
      <div className="item-detail-actions">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft(emptyPlan(recordBase(researchId), feedback.id));
            form.setError(null);
          }}
        >
          <Icon name="edit" size={15} />
          {t("직접 쓰기")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={aiOpen}
          onClick={() => (aiOpen && !aiStale ? setAiOpen(false) : openAI())}
        >
          <Icon name="sparkles" size={15} />
          {t("연구 도우미에게 제안받기")}
        </Button>
      </div>
      {aiOpen && aiInput && (
        <div className="item-detail-suggestions">
          <RevisionSuggestions
            key={aiRun}
            input={aiInput}
            stale={aiStale}
            isQuoteInSource={isQuoteInSource}
            onRefresh={openAI}
            onAdopt={async (candidate, base) => {
              await save("plans", planFromCandidate(candidate, base, feedback));
              toast.success(
                t(
                  "이 방법을 선택했어요. 수정 방법에서 할 일에 추가할 수 있어요.",
                ),
              );
            }}
            onEdit={(candidate, base) => {
              setDraft(planFromCandidate(candidate, base, feedback));
              form.setError(null);
            }}
          />
        </div>
      )}
      {cancelled.length > 0 && (
        <Disclosure
          className="item-detail-cancelled"
          summary={t("선택 취소한 방법 {count}개", {
            count: cancelled.length,
          })}
        >
          {cancelled.map((plan) => (
            <div key={plan.id} className="item-detail-plan is-cancelled">
              <strong>{plan.title}</strong>
              {plan.method && <p>{plan.method}</p>}
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === plan.id}
                onClick={() => void setStatus(plan, "saved")}
              >
                {t("다시 선택")}
              </Button>
            </div>
          ))}
        </Disclosure>
      )}
      <FormDialog
        busy={form.saving}
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        title={
          !isNew
            ? t("수정 방법 편집")
            : draft?.origin === "ai"
              ? t("AI 제안 고쳐서 쓰기")
              : t("수정 방법 작성")
        }
        description={
          isNew && draft?.origin === "ai"
            ? t("고친 뒤 저장해야 기록에 남아요. 닫으면 저장되지 않아요.")
            : undefined
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft || !draft.title.trim() || !draft.method.trim()) {
              form.setError(t("제목과 ‘어떻게 고칠지’를 입력해 주세요."));
              return;
            }
            void form.perform(async () => {
              await save("plans", {
                ...draft,
                title: draft.title.trim(),
                method: draft.method.trim(),
              });
              setDraft(null);
              toast.success(t("수정 방법을 저장했어요"));
            });
          }}
        >
          <DialogBody>
            {draft && (
              <>
                <LabeledInput
                  label={t("제목")}
                  required
                  value={draft.title}
                  onChange={(title) =>
                    setDraft((v) => (v ? { ...v, title } : v))
                  }
                />
                <LabeledText
                  label={t("어떻게 고칠지")}
                  required
                  value={draft.method}
                  onChange={(method) =>
                    setDraft((v) => (v ? { ...v, method } : v))
                  }
                />
                <LabeledText
                  label={t("예상 결과")}
                  value={draft.expectedResult}
                  onChange={(expectedResult) =>
                    setDraft((v) => (v ? { ...v, expectedResult } : v))
                  }
                  rows={2}
                />
                <LabeledText
                  label={t("필요한 자료·준비할 것")}
                  value={draft.requiredMaterials}
                  onChange={(requiredMaterials) =>
                    setDraft((v) => (v ? { ...v, requiredMaterials } : v))
                  }
                  rows={2}
                />
                <LabeledText
                  label={t("확인이 필요한 가정")}
                  value={draft.assumptions}
                  onChange={(assumptions) =>
                    setDraft((v) => (v ? { ...v, assumptions } : v))
                  }
                  rows={2}
                />
              </>
            )}
            <ErrorNotice error={form.error} />
          </DialogBody>
          <SaveActions saving={form.saving} onCancel={() => setDraft(null)} />
        </form>
      </FormDialog>
    </>
  );
}
