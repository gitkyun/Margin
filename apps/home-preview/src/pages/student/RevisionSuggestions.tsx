import { AssistantMascot } from "@/components/brand/Brand";
import {
  researchModelLabel,
  resolveReviewDepth,
  reviewDepthHints,
  reviewDepthOptions,
  workingMascot,
  workMessages,
} from "@/lib/assistant-presentation";
import { useAICapabilities } from "@/lib/ai-capabilities";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  AINotConfiguredError,
  useAINotConfigured,
} from "@/lib/ai-availability";
import { Choice } from "@/components/experience";
import { useEffect, useId, useRef, useState } from "react";
import { useDisabledReason } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
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
import { SmartSuggestionCard } from "./SmartSuggestionCard";

interface RevisionSuggestionsProps {
  input: AIInput;
  stale: boolean;
  /** AI 제안의 원문 인용이 실제 피드백에 있는지 확인할 때 씁니다. */
  isQuoteInSource(quote: string): boolean;
  onRefresh(): void;
  onAdopt(candidate: AICandidate, base: BaseRecord): Promise<void>;
  /** 고쳐서 쓰기: 수정 방법 작성 창을 이 제안으로 채워 열어요. 저장해야 기록에 남아요. */
  onEdit(candidate: AICandidate, base: BaseRecord): void;
}

/**
 * 피드백 상세 여백 패널의 ‘수정 방법 제안’. 제안을 스마트 제안 카드로 보여 줘요.
 * AI 결과는 자동으로 저장하지 않고, 학생이 [이 방법 선택]을 누르거나 [고쳐서 쓰기]로 저장할 때만 남아요.
 * 패널을 닫아도 실행과 제안은 남고, 원문이 바뀌면 고를 수 없어요.
 * (미팅 정리는 AIWorkbench가 계속 맡아요.)
 */
export function RevisionSuggestions({
  input,
  stale,
  isQuoteInSource,
  onRefresh,
  onAdopt,
  onEdit,
}: RevisionSuggestionsProps) {
  const { runAI, mode, user, data } = useWorkspace();
  const caps = useAICapabilities();
  const aiNotConfigured = useAINotConfigured();
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
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const bases = useRef<BaseRecord[]>([]);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const [confirmDialog, confirm] = useConfirm();
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  // 선택(바로 저장)이든 고쳐서 쓰기(창에서 저장)든, 그 제안의 기록이 생기면 선택한 것으로 봐요.
  const adopted = (index: number) =>
    data.plans.some((plan) => plan.id === bases.current[index]?.id);
  const visible = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ index }) => !dismissed.includes(index));
  const openCount = visible.filter(({ index }) => !adopted(index)).length;

  async function generate() {
    if (running || saving !== null) return;
    if (
      openCount > 0 &&
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
      bases.current = result.candidates.map(() => recordBase(input.researchId));
      setCandidates(result.candidates);
      setDismissed([]);
      setModel(result.model);
    } catch (e) {
      if (current === sequence.current && !abort.signal.aborted)
        setError(
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
  async function adopt(index: number) {
    if (saving !== null || adopted(index) || stale) return;
    setSaving(index);
    setError(null);
    try {
      await onAdopt(candidates[index], bases.current[index]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "저장하지 못했어요. 입력한 내용은 그대로 있으니 다시 시도해 주세요.",
            ),
      );
    } finally {
      setSaving(null);
    }
  }
  const quoteOf = (candidate: AICandidate) =>
    candidate.sourceQuote && isQuoteInSource(candidate.sourceQuote)
      ? candidate.sourceQuote
      : null;

  return (
    <aside className="ai-workbench" aria-label={t("수정 방법 제안")}>
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
                      ? openCount === 0
                        ? "completed"
                        : "idea"
                      : "ready"
            }
            active={running}
            size={40}
          />
          <h3>{t("수정 방법 제안")}</h3>
        </div>
      </div>
      <div className="ai-scope">
        <span>{t("근거")}</span>
        <strong>{t("이 피드백의 내용")}</strong>
        <small>
          {t("{count}자", { count: input.sourceText.length.toLocaleString() })}
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
        {t("원문과 AI 제안을 구분해 확인하고, 필요한 것만 선택하세요.")}
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
          {t(
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
            disabled={aiBlocked || saving !== null || !input.sourceText.trim()}
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
        <div className="smart-suggestion-list" aria-live="polite">
          <p className="smart-suggestion-summary">
            {openCount === 0
              ? t("남은 AI 제안이 없어요. 선택한 방법만 기록에 남았어요.")
              : t("AI 제안 {count}개를 확인해 주세요.", { count: openCount })}
          </p>
          {visible.map(({ candidate, index }) => (
            <SmartSuggestionCard
              key={bases.current[index]?.id ?? index}
              number={index + 1}
              candidate={candidate}
              sourceQuote={quoteOf(candidate)}
              adopted={adopted(index)}
              saving={saving === index}
              blocked={stale || (saving !== null && saving !== index)}
              blockedReasonId={stale ? staleNoteId : undefined}
              onAdopt={() => void adopt(index)}
              onEdit={() => onEdit(candidate, bases.current[index])}
              onDismiss={() => setDismissed((ids) => [...ids, index])}
            />
          ))}
          <small className="ai-candidate-note">
            {t("선택하거나 고쳐서 저장한 방법만 기록에 남아요.")}
          </small>
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
