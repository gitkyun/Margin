import { DialogBody } from "@/components/ui/dialog";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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

interface FieldErrors {
  title?: string;
  description?: string;
}

/** 열린 버튼 자리에서 창이 커지며 자리 잡는 시간·곡선(--motion-duration-page, --motion-ease-standard) */
const MORPH_MS = 300;
const MORPH_EASING = "cubic-bezier(0.2, 0, 0, 1)";

/**
 * 창이 연 버튼 자리에서 부드럽게 커지며 열려요(모핑). 768px 이상 가운데 창에서만,
 * 동작 줄이기 설정이면 하지 않아요. Montage 창의 스타일을 덮지 않게 Web Animations로
 * 잠깐만 움직이고 끝나면 원래 모습 그대로예요.
 */
function morphFrom(container: Element, from: DOMRect | null) {
  if (
    !window.matchMedia("(min-width: 768px)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dx = from
    ? from.left + from.width / 2 - (rect.left + rect.width / 2)
    : 0;
  const dy = from
    ? from.top + from.height / 2 - (rect.top + rect.height / 2)
    : 8;
  const scale = from
    ? Math.max(0.3, Math.min(1, from.width / rect.width))
    : 0.94;
  container.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    { duration: MORPH_MS, easing: MORPH_EASING, fill: "backwards" },
  );
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const titleInput = useRef<HTMLInputElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const formElement = useRef<HTMLFormElement>(null);
  // 창을 연 버튼의 자리. 열리는 순간(포커스가 창으로 옮겨 가기 전)에 기억해요.
  const openedFrom = useRef<DOMRect | null>(null);
  const openedFor = useRef<string | null>(null);
  if (
    draft &&
    openedFor.current !== draft.id &&
    typeof document !== "undefined"
  ) {
    openedFor.current = draft.id;
    const active = document.activeElement;
    openedFrom.current =
      active instanceof HTMLElement && active !== document.body
        ? active.getBoundingClientRect()
        : null;
  }
  if (!draft) openedFor.current = null;
  useEffect(() => {
    form.setError(null);
    setErrors({});
  }, [draft?.id]);
  useLayoutEffect(() => {
    if (!draft?.id) return;
    const run = () => {
      const container = formElement.current?.closest(
        '[data-slot="dialog-content"]',
      );
      if (!container) return false;
      morphFrom(container, openedFrom.current);
      return true;
    };
    // 창 내용이 다음 프레임에 붙는 경우를 위해 한 번 더 시도해요.
    if (run()) return;
    const frame = requestAnimationFrame(() => void run());
    return () => cancelAnimationFrame(frame);
  }, [draft?.id]);
  /** 비어 있는 필수 칸에 오류를 붙이고(흔들림) 첫 칸으로 포커스를 옮겨요. */
  function flagMissing(next: FieldErrors) {
    // 같은 칸을 다시 막아도 흔들리도록 표시를 한 번 지웠다가 다음 프레임에 붙여요.
    setErrors({});
    requestAnimationFrame(() => {
      setErrors(next);
      (next.title ? titleInput : descriptionInput).current?.focus();
    });
  }
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
        ref={formElement}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft) return;
          const missing: FieldErrors = {
            title: draft.title.trim() ? undefined : t("제목을 입력해 주세요."),
            description: draft.description.trim()
              ? undefined
              : t("실제로 수정한 내용을 적어 주세요."),
          };
          if (missing.title || missing.description) {
            form.setError(null);
            flagMissing(missing);
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
        <DialogBody>
          {draft && (
            <>
              <LabeledInput
                label={t("제목")}
                required
                value={draft.title}
                error={errors.title}
                inputRef={titleInput}
                onChange={(title) => {
                  setErrors((current) => ({ ...current, title: undefined }));
                  setDraft((value) => (value ? { ...value, title } : value));
                }}
              />
              <LabeledText
                label={
                  draft.kind === "other"
                    ? t("실제로 한 일")
                    : t("실제로 수정한 내용")
                }
                required
                value={draft.description}
                error={errors.description}
                textareaRef={descriptionInput}
                onChange={(description) => {
                  setErrors((current) => ({
                    ...current,
                    description: undefined,
                  }));
                  setDraft((value) =>
                    value ? { ...value, description } : value,
                  );
                }}
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
        </DialogBody>
        <SaveActions
          saving={form.saving}
          onCancel={() => setDraft(null)}
          label={t("수정 결과 저장")}
        />
      </form>
    </FormDialog>
  );
}
