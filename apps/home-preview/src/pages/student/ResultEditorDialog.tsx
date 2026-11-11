import { useEffect, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { SelectField } from "@/components/experience";
import { useWorkspace } from "@/lib/workspace";
import type { RevisionResult } from "@/lib/domain";
import {
  ErrorNotice,
  FormDialog,
  LabeledInput,
  LabeledText,
  SaveActions,
  useSaving,
} from "./shared";
import { QuickPdfUpload } from "./QuickPdfUpload";
import { Checkbox } from "@montage-ui/core";

interface ResultEditorDialogProps {
  researchId: string;
  draft: RevisionResult | null;
  setDraft: Dispatch<SetStateAction<RevisionResult | null>>;
  // Called after a successful save. Omit it to stay on the current screen.
  onSaved?: (result: RevisionResult) => void;
}

// Create/edit dialog for a revision result. Shared by the results list and the
// feedback detail so the screen behind the dialog stays where the student was.
export function ResultEditorDialog({
  researchId,
  draft,
  setDraft,
  onSaved,
}: ResultEditorDialogProps) {
  const { data, save } = useWorkspace();
  const form = useSaving();
  useEffect(() => {
    form.setError(null);
  }, [draft?.id]);
  return (
    <FormDialog
      busy={form.saving}
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) setDraft(null);
      }}
      title={
        draft && data.results.some((result) => result.id === draft.id)
          ? t("수정 결과 편집")
          : t("수정 결과 작성")
      }
      description={t("저장해도 교수님께 공개되지 않아요.")}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft || !draft.title.trim() || !draft.description.trim()) {
            form.setError(t("제목과 수정한 내용을 적어 주세요."));
            return;
          }
          void form.perform(async () => {
            const result = await save("results", {
              ...draft,
              title: draft.title.trim(),
              description: draft.description.trim(),
              location: draft.location.trim(),
            });
            setDraft(null);
            toast.success(t("수정 결과를 저장했어요"));
            onSaved?.(result);
          });
        }}
      >
        {draft && (
          <>
            <LabeledInput
              label={t("제목")}
              required
              value={draft.title}
              onChange={(title) =>
                setDraft((value) => (value ? { ...value, title } : value))
              }
            />
            <LabeledText
              label={
                draft.kind === "other"
                  ? t("실제로 한 일")
                  : t("실제로 수정한 내용")
              }
              required
              value={draft.description}
              onChange={(description) =>
                setDraft((value) => (value ? { ...value, description } : value))
              }
              placeholder={t("예: 2장 선행연구 비교표에 비교 기준 3개 추가")}
              rows={5}
            />
            <label className="field">
              <span className="field-name">{t("수정 종류")}</span>
              <SelectField
                className="native-select"
                value={draft.kind}
                onChange={(event) =>
                  setDraft((value) =>
                    value
                      ? {
                          ...value,
                          kind: event.target.value as RevisionResult["kind"],
                        }
                      : value,
                  )
                }
              >
                <option value="document">{t("문서 수정")}</option>
                <option value="other">{t("문서 외 수정")}</option>
              </SelectField>
            </label>
            {draft.kind === "document" && (
              <>
                <label className="field">
                  <span className="field-name">{t("파일")}</span>
                  <SelectField
                    className="native-select"
                    value={draft.versionId ?? ""}
                    onChange={(event) =>
                      setDraft((value) =>
                        value
                          ? {
                              ...value,
                              versionId: event.target.value || undefined,
                            }
                          : value,
                      )
                    }
                  >
                    <option value="">{t("나중에 선택")}</option>
                    {data.versions
                      .filter((version) => version.researchId === researchId)
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.fileName} · v{version.number}
                        </option>
                      ))}
                  </SelectField>
                  <small className="field-hint">
                    {t(
                      "문서 수정을 검토 요청에 넣으려면 파일과 볼 위치가 필요해요.",
                    )}
                  </small>
                </label>
                <QuickPdfUpload
                  researchId={researchId}
                  onUploaded={(version) =>
                    setDraft((value) =>
                      value ? { ...value, versionId: version.id } : value,
                    )
                  }
                />
                <LabeledInput
                  label={t("볼 위치")}
                  hint={t(
                    "교수님이 먼저 볼 위치예요. 검토 요청에는 파일 전체가 공개돼요.",
                  )}
                  value={draft.location}
                  onChange={(location) =>
                    setDraft((value) =>
                      value ? { ...value, location } : value,
                    )
                  }
                  placeholder={t("예: 4페이지 표 2, 2장 마지막 문단")}
                />
              </>
            )}
            <div className="student-picker">
              <h3>{t("연결할 피드백")}</h3>
              {data.feedback
                .filter((feedback) => feedback.researchId === researchId)
                .map((feedback) => (
                  <label className="student-choice-row" key={feedback.id}>
                    <Checkbox
                      checked={draft.feedbackIds.includes(feedback.id)}
                      onCheckedChange={(next) =>
                        setDraft((value) =>
                          value
                            ? {
                                ...value,
                                feedbackIds: next
                                  ? [...value.feedbackIds, feedback.id]
                                  : value.feedbackIds.filter(
                                      (id) => id !== feedback.id,
                                    ),
                              }
                            : value,
                        )
                      }
                    />
                    <span>{feedback.title}</span>
                  </label>
                ))}
            </div>
            <div className="student-picker">
              <h3>{t("연결할 할 일")}</h3>
              {data.tasks
                .filter((task) => task.researchId === researchId)
                .map((task) => (
                  <label className="student-choice-row" key={task.id}>
                    <Checkbox
                      checked={draft.taskIds.includes(task.id)}
                      onCheckedChange={(next) =>
                        setDraft((value) =>
                          value
                            ? {
                                ...value,
                                taskIds: next
                                  ? [...value.taskIds, task.id]
                                  : value.taskIds.filter(
                                      (id) => id !== task.id,
                                    ),
                              }
                            : value,
                        )
                      }
                    />
                    <span>{task.title}</span>
                  </label>
                ))}
            </div>
          </>
        )}
        <ErrorNotice error={form.error} />
        <SaveActions
          saving={form.saving}
          onCancel={() => setDraft(null)}
          label={t("수정 결과 저장")}
        />
      </form>
    </FormDialog>
  );
}
