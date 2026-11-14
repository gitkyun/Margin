import { AssistantMascot } from "@/components/brand/Brand";
import {
  workingMascot,
  workMessages,
  researchModelLabel,
  reviewDepthOptions,
  resolveReviewDepth,
  reviewDepthHints,
} from "@/lib/assistant-presentation";
import { useAICapabilities } from "@/lib/ai-capabilities";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  AINotConfiguredError,
  useAINotConfigured,
} from "@/lib/ai-availability";
import { Choice } from "@/components/experience";
import { SelectField } from "@/components/experience";
import { useEffect, useId, useRef, useState } from "react";
import { useDisabledReason } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import {
  recordBase,
  type AICandidate,
  type AIInput,
  type BaseRecord,
} from "@/lib/domain";
import { t } from "@/lib/i18n";
import { ErrorNotice } from "./shared";

// Closing only hides the panel: generation keeps running and candidates stay
// until the student stops generation or the source changes.
export function AIWorkbench({
  title,
  input,
  hidden = false,
  stale = false,
  embedded = false,
  onClose,
  onRefresh,
  onSave,
}: {
  title: string;
  input: AIInput;
  hidden?: boolean;
  stale?: boolean;
  /** 여백 패널 틀 안에 들어가면 틀의 닫기 버튼을 씁니다. */
  embedded?: boolean;
  onClose(): void;
  onRefresh(): void;
  onSave(candidate: AICandidate, base: BaseRecord): Promise<void>;
}) {
  const { runAI, mode, user } = useWorkspace();
  const caps = useAICapabilities();
  const aiNotConfigured = useAINotConfigured();
  // 미리보기·AI 미연결·원문 변경은 위 안내 문장이 이유라서 그 문장과 버튼을 잇습니다.
  const availabilityNoteId = useId(),
    staleNoteId = useId();
  const aiBlocked = mode === "preview" || aiNotConfigured;
  const sourceReason = useDisabledReason(
    !aiBlocked &&
      !input.sourceText.trim() &&
      t("원문이 비어 있어 제안받을 수 없어요."),
  );
  const [selectedModelId, setSelectedModelId] = useState(
    String(input.model ?? user.preferences?.model ?? ""),
  );
  const [preferredDepth, setPreferredDepth] = useState(
    String(input.thinking ?? user.preferences?.thinking ?? "high"),
  );
  const selectedModel =
    caps.data?.models.find((m) => m.id === selectedModelId) ??
    caps.data?.models[0];
  const depth = resolveReviewDepth(
    selectedModel?.thinking ?? [],
    preferredDepth,
  );
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [candidates, setCandidates] = useState<AICandidate[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const candidateBases = useRef<BaseRecord[]>([]);
  const savingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  const [confirmDialog, confirm] = useConfirm();
  async function generate() {
    if (running || savingRef.current) return;
    if (
      candidates.length &&
      !(await confirm({
        title: t(
          "지금 보이는 AI 제안을 새 제안으로 바꿀까요? 저장하지 않은 편집 내용은 사라져요.",
        ),
        confirmLabel: t("다시 제안받기"),
      }))
    )
      return;
    const current = ++sequence.current;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setStopped(false);
    setError(null);
    try {
      const result = await runAI(
        {
          ...input,
          ...(selectedModel
            ? {
                model: selectedModel.id,
                thinking: depth ? (depth as AIInput["thinking"]) : undefined,
              }
            : {}),
        },
        abort.signal,
      );
      if (current !== sequence.current) return;
      candidateBases.current = result.candidates.map(() =>
        recordBase(input.researchId),
      );
      setCandidates(result.candidates);
      setSaved([]);
      setModel(result.model);
    } catch (e) {
      if (current === sequence.current && !abort.signal.aborted)
        setError(
          // 연결 전이면 위 안내 줄이 대신 보여요.
          e instanceof AINotConfiguredError
            ? null
            : e instanceof Error
              ? e.message
              : t(
                  "AI 제안을 받지 못했어요. 다시 시도하거나 직접 작성해 주세요.",
                ),
        );
    } finally {
      if (current === sequence.current) setRunning(false);
    }
  }
  function cancel() {
    sequence.current++;
    controller.current?.abort();
    setRunning(false);
    setStopped(true);
    setError(t("제안받기를 중단했어요. 기록은 바뀌지 않았어요."));
  }
  function edit(index: number, change: Partial<AICandidate>) {
    setCandidates((items) =>
      items.map((item, i) => (i === index ? { ...item, ...change } : item)),
    );
  }
  async function saveCandidate(candidate: AICandidate, index: number) {
    if (savingRef.current || saved.includes(index)) return;
    if (stale) {
      setError(
        t(
          "AI를 실행한 뒤 원문이 바뀌었어요. 바뀐 원문으로 다시 제안받아 주세요.",
        ),
      );
      return;
    }
    if (
      !candidate.title.trim() ||
      !(candidate.method ?? candidate.body ?? "").trim()
    ) {
      setError(t("제목과 내용을 입력해 주세요."));
      return;
    }
    savingRef.current = true;
    setSaving(index);
    setError(null);
    try {
      await onSave(candidate, candidateBases.current[index]);
      setSaved((ids) => [...ids, index]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "저장하지 못했어요. 입력한 내용은 그대로 있으니 다시 시도해 주세요.",
            ),
      );
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  }
  return (
    <aside className="ai-workbench" aria-label={title} hidden={hidden}>
      {confirmDialog}
      <div className="ai-workbench-heading">
        <div className="ai-workbench-title">
          <AssistantMascot
            state={
              running
                ? workingMascot(input.mode)
                : stopped
                  ? "rest"
                  : error || stale
                    ? "attention"
                    : candidates.length
                      ? saved.length === candidates.length
                        ? "completed"
                        : "idea"
                      : "ready"
            }
            active={running}
            size={40}
          />
          <h3>{title}</h3>
        </div>
        {!embedded && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("{title} 닫기", { title })}
            disabled={saving !== null}
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </Button>
        )}
      </div>
      <div className="ai-scope">
        <span>{t("근거")}</span>
        <strong>
          {input.mode === "organize_meeting"
            ? t("이 미팅에 저장된 메모")
            : t("이 피드백의 내용")}
        </strong>
        <small>
          {t("{count}자", { count: input.sourceText.length.toLocaleString() })}
          {input.sourceRevision
            ? ` · ${t("원문 v{revision}", { revision: input.sourceRevision })}`
            : ""}
        </small>
      </div>
      {selectedModel && !aiNotConfigured && (
        <details className="margin-review-settings">
          <summary>
            {t("이번 실행 설정")}
            <Icon name="chevron-down" size={15} />
          </summary>
          <div className="margin-review-fields">
            <label className="field">
              {t("AI 모델")}
              <Choice
                label={t("AI 모델")}
                value={selectedModel.id}
                disabled={running || saving !== null}
                onChange={setSelectedModelId}
                options={caps.data!.models.map((m) => ({
                  value: m.id,
                  label: researchModelLabel(m),
                }))}
              />
            </label>
            {!!selectedModel.thinking.length && (
              <label className="field">
                {t("답변 깊이")}
                <Choice
                  label={t("답변 깊이")}
                  value={depth}
                  disabled={running || saving !== null}
                  onChange={setPreferredDepth}
                  options={reviewDepthOptions(selectedModel.thinking)}
                />
                <small>{reviewDepthHints[depth]}</small>
              </label>
            )}
          </div>
        </details>
      )}
      <p className="ai-disclosure">
        {input.mode === "organize_meeting"
          ? t("원문과 AI 제안을 구분해 확인하고, 필요한 것만 저장하세요.")
          : t("원문과 AI 제안을 구분해 확인하고, 필요한 것만 선택하세요.")}
      </p>
      {mode === "preview" ? (
        <p id={availabilityNoteId} className="student-inline-note">
          {t("이 미리보기에서는 AI를 실행할 수 없어요.")}
        </p>
      ) : (
        aiNotConfigured && (
          <p
            id={availabilityNoteId}
            className="student-inline-note"
            role="status"
          >
            {AI_NOT_CONFIGURED_MESSAGE}
          </p>
        )
      )}
      {stale && (
        <p id={staleNoteId} className="student-inline-note" role="status">
          {input.mode === "organize_meeting"
            ? t(
                "AI를 실행한 뒤 원문이 바뀌었어요. 아래 AI 제안은 바뀌기 전 원문을 기준으로 해서 저장할 수 없어요.",
              )
            : t(
                "AI를 실행한 뒤 원문이 바뀌었어요. 아래 AI 제안은 바뀌기 전 원문을 기준으로 해서 선택할 수 없어요.",
              )}
        </p>
      )}
      <div className="button-row">
        {running ? (
          <Button variant="outline" onClick={cancel}>
            {t("중단")}
          </Button>
        ) : stale ? (
          <Button onClick={onRefresh} disabled={saving !== null}>
            <Icon name="refresh" size={16} />
            {t("바뀐 원문 불러오기")}
          </Button>
        ) : (
          <Button
            onClick={generate}
            disabled={
              mode === "preview" ||
              aiNotConfigured ||
              saving !== null ||
              !input.sourceText.trim()
            }
            aria-describedby={
              aiBlocked ? availabilityNoteId : sourceReason.describedBy
            }
          >
            <Icon name="sparkles" size={16} />
            {candidates.length ? t("다시 제안받기") : t("제안받기")}
          </Button>
        )}
      </div>
      {!running && !stale && sourceReason.node}
      {running && (
        <div className="ai-running" role="status">
          <span>
            {workMessages[input.mode]}
            <small>{t("제안을 저장하기 전에는 기록이 바뀌지 않아요.")}</small>
          </span>
        </div>
      )}
      <ErrorNotice error={error} />
      {candidates.length > 0 && (
        <div className="ai-candidate-list" aria-live="polite">
          <div className="margin-result-note">
            <div>
              <strong>
                {saved.length === candidates.length
                  ? input.mode === "organize_meeting"
                    ? t("AI 제안을 모두 저장했어요.")
                    : t("AI 제안을 모두 선택했어요.")
                  : t("AI 제안 {count}개를 확인해 주세요.", {
                      count: candidates.length,
                    })}
              </strong>
              <small>
                {t("원문과 비교하고, 필요한 내용은 고쳐서 저장할 수 있어요.")}
              </small>
            </div>
          </div>
          {candidates.map((candidate, index) => (
            <section
              className={`ai-candidate ${saved.includes(index) ? "is-saved" : ""}`}
              key={index}
            >
              <div className="ai-candidate-number">
                {input.mode === "organize_meeting"
                  ? t("정리 항목 {number}", { number: index + 1 })
                  : t("수정 방법 {number}", { number: index + 1 })}
                {saved.includes(index) && (
                  <span>
                    {input.mode === "organize_meeting"
                      ? t("저장됨")
                      : t("선택됨")}
                  </span>
                )}
              </div>
              {input.mode === "organize_meeting" && (
                <label className="field">
                  <span className="field-name">{t("종류")}</span>
                  <SelectField
                    className="native-select"
                    value={candidate.category ?? "feedback"}
                    onChange={(e) =>
                      edit(index, {
                        category: e.target.value as AICandidate["category"],
                      })
                    }
                    disabled={saving !== null || saved.includes(index)}
                  >
                    <option value="feedback">{t("피드백")}</option>
                    <option value="decision">{t("결정 사항")}</option>
                    <option value="question">{t("질문")}</option>
                  </SelectField>
                </label>
              )}
              <label className="field">
                <span className="field-name">{t("제목")}</span>
                <Input
                  aria-label={t("제목 (AI 제안 {number})", {
                    number: index + 1,
                  })}
                  value={candidate.title}
                  onChange={(e) => edit(index, { title: e.target.value })}
                  disabled={saving !== null || saved.includes(index)}
                />
              </label>
              {candidate.sourceQuote && (
                <blockquote className="source-excerpt">
                  <small>{t("원문 인용")}</small>
                  {candidate.sourceQuote}
                </blockquote>
              )}
              <label className="field">
                <span className="field-name">
                  {input.mode === "organize_meeting"
                    ? t("정리한 내용")
                    : t("어떻게 고칠지")}
                </span>
                <Textarea
                  aria-label={
                    input.mode === "organize_meeting"
                      ? t("정리한 내용 (AI 제안 {number})", {
                          number: index + 1,
                        })
                      : t("어떻게 고칠지 (AI 제안 {number})", {
                          number: index + 1,
                        })
                  }
                  value={candidate.method ?? candidate.body ?? ""}
                  onChange={(e) =>
                    edit(
                      index,
                      input.mode === "organize_meeting"
                        ? { body: e.target.value }
                        : { method: e.target.value },
                    )
                  }
                  disabled={saving !== null || saved.includes(index)}
                  rows={4}
                />
              </label>
              {input.mode === "suggest_revisions" && (
                <>
                  <label className="field">
                    <span className="field-name">{t("예상 결과")}</span>
                    <Textarea
                      value={candidate.expectedResult ?? ""}
                      onChange={(e) =>
                        edit(index, { expectedResult: e.target.value })
                      }
                      disabled={saving !== null || saved.includes(index)}
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    <span className="field-name">{t("필요한 자료·할 일")}</span>
                    <Textarea
                      value={candidate.requiredMaterials ?? ""}
                      onChange={(e) =>
                        edit(index, { requiredMaterials: e.target.value })
                      }
                      disabled={saving !== null || saved.includes(index)}
                      rows={2}
                    />
                  </label>
                </>
              )}
              {candidate.assumptions && (
                <div className="ai-assumption">
                  <small>{t("확인이 필요한 가정")}</small>
                  <p>{candidate.assumptions}</p>
                </div>
              )}
              <Button
                variant="outline"
                disabled={saving !== null || saved.includes(index) || stale}
                aria-describedby={stale ? staleNoteId : undefined}
                onClick={() => saveCandidate(candidate, index)}
              >
                {saved.includes(index) ? (
                  <>
                    <Icon name="check" size={15} />
                    {input.mode === "organize_meeting"
                      ? t("저장됨")
                      : t("선택됨")}
                  </>
                ) : saving === index ? (
                  t("저장 중")
                ) : input.mode === "organize_meeting" ? (
                  t("이 항목 저장")
                ) : (
                  t("이 방법 선택")
                )}
              </Button>
              {!saved.includes(index) && (
                <small className="ai-candidate-note">
                  {input.mode === "organize_meeting"
                    ? t("저장한 항목만 기록에 남아요.")
                    : t("선택한 방법만 기록에 남아요.")}
                </small>
              )}
            </section>
          ))}
        </div>
      )}
      {model && (
        <p className="meta ai-model">
          {t("응답한 AI 모델 · {model}", { model })}
        </p>
      )}
    </aside>
  );
}
