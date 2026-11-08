import { useEffect, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
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
          ? "수정 결과 편집"
          : "수정 결과 작성"
      }
      description="개인 저장본입니다. 저장만으로 교수에게 공개되지 않습니다."
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft || !draft.title.trim() || !draft.description.trim()) {
            form.setError("결과 제목과 실제 수정한 내용을 입력하세요.");
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
            toast.success("수정 결과를 저장했습니다");
            onSaved?.(result);
          });
        }}
      >
        {draft && (
          <>
            <LabeledInput
              label="결과 제목"
              required
              value={draft.title}
              onChange={(title) =>
                setDraft((value) => (value ? { ...value, title } : value))
              }
            />
            <LabeledText
              label={
                draft.kind === "other"
                  ? "실제로 수행한 내용"
                  : "실제로 수정한 내용"
              }
              required
              value={draft.description}
              onChange={(description) =>
                setDraft((value) => (value ? { ...value, description } : value))
              }
              placeholder="어떤 부분을 어떻게 바꿨는지 적어 주세요."
              rows={5}
            />
            <label className="field">
              <span className="field-name">작업 종류</span>
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
                <option value="document">문서 수정</option>
                <option value="other">비문서 작업</option>
              </SelectField>
            </label>
            {draft.kind === "document" && (
              <>
                <label className="field">
                  <span className="field-name">보존 파일</span>
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
                    <option value="">나중에 연결</option>
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
                    문서 수정의 교수 검토에는 보존 파일과 확인 위치가
                    필요합니다.
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
                  label="확인 위치"
                  value={draft.location}
                  onChange={(location) =>
                    setDraft((value) =>
                      value ? { ...value, location } : value,
                    )
                  }
                  placeholder="예: 4페이지 표 2, 2장 마지막 문단"
                />
              </>
            )}
            <div className="student-picker">
              <h3>연결할 피드백</h3>
              {data.feedback
                .filter((feedback) => feedback.researchId === researchId)
                .map((feedback) => (
                  <label className="student-choice-row" key={feedback.id}>
                    <input
                      type="checkbox"
                      checked={draft.feedbackIds.includes(feedback.id)}
                      onChange={(event) =>
                        setDraft((value) =>
                          value
                            ? {
                                ...value,
                                feedbackIds: event.target.checked
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
              <h3>연결할 작업</h3>
              {data.tasks
                .filter((task) => task.researchId === researchId)
                .map((task) => (
                  <label className="student-choice-row" key={task.id}>
                    <input
                      type="checkbox"
                      checked={draft.taskIds.includes(task.id)}
                      onChange={(event) =>
                        setDraft((value) =>
                          value
                            ? {
                                ...value,
                                taskIds: event.target.checked
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
          label="수정 결과 저장"
        />
      </form>
    </FormDialog>
  );
}
