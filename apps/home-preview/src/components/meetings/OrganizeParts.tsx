import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ConfirmDialog";
import { WorkbenchLoading } from "@/pages/assistant/AssistantThinking";
import { useWorkspace } from "@/lib/workspace";
import { useExperience } from "@/lib/experience";
import { useAICapabilities, resolveAISelection } from "@/lib/ai-capabilities";
import {
  AINotConfiguredError,
  useAINotConfigured,
} from "@/lib/ai-availability";
import { useAIUsage } from "@/lib/ai-usage";
import {
  formatDate,
  uid,
  type Meeting,
  type SavedAICandidate,
} from "@/lib/domain";

/** 이 기록에서 나온, 아직 고르지 않은 정리 제안(본인 것만 서버가 내려줌) */
export function organizeCandidates(
  meeting: Pick<Meeting, "id">,
  candidates: readonly SavedAICandidate[],
  recordingIds: ReadonlySet<string>,
): SavedAICandidate[] {
  return candidates
    .filter(
      (c) =>
        c.status === "pending" &&
        c.mode === "organize_meeting" &&
        (c.contexts?.some(
          (x) =>
            (x.kind === "meetings" && x.id === meeting.id) ||
            (x.kind === "recordings" && recordingIds.has(x.id)),
        ) ??
          false),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * 기록됨 모드 오른쪽 열의 [정리하기](IA v2 04 §5.4 ①, 08 §5.2).
 * 고르는 단계 없이 이 기록의 메모와 내 전사문을 보냅니다(서버가 내 전사문만 읽음).
 */
export function useOrganize(
  meeting: Meeting,
  prepare: () => Promise<Meeting | null>,
) {
  const { data, runAI, mode, user } = useWorkspace();
  const caps = useAICapabilities();
  const usage = useAIUsage();
  const notConfigured = useAINotConfigured();
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dropped, setDropped] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const recordingIds = new Set(
    data.recordings.filter((r) => r.meetingId === meeting.id).map((r) => r.id),
  );
  const mine = data.recordings.some(
    (r) => r.meetingId === meeting.id && r.createdBy === user.id,
  );
  const pending = organizeCandidates(meeting, data.aiCandidates, recordingIds);
  const summary = [...pending]
    .reverse()
    .find((c) => c.candidate.category === "summary");
  const suggestions = pending.filter((c) => c.candidate.category !== "summary");
  const blocked =
    mode === "preview"
      ? t("미리보기에서는 연구 도우미를 실행할 수 없어요.")
      : notConfigured
        ? t(
            "지금은 연구 도우미를 쓸 수 없어요. 직접 정리하고 저장할 수 있어요.",
          )
        : null;

  async function run() {
    if (running || blocked) return;
    const selection = resolveAISelection(
      caps.isError ? [] : caps.data?.models,
      {
        model: user.preferences?.model,
        thinking: user.preferences?.thinking,
      },
    );
    if (!selection.model) {
      setError(t("사용 가능한 모델을 확인한 뒤 다시 보내 주세요."));
      return;
    }
    const stored = await prepare();
    if (!stored) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setStartedAt(Date.now());
    setError(null);
    setDropped(0);
    try {
      const result = await runAI(
        {
          mode: "organize_meeting",
          researchId: stored.researchId,
          meetingId: stored.id,
          sourceText: stored.memo,
          sourceRevision: stored.memoRevision,
          clientRunId: uid(),
          ...selection,
        },
        abort.signal,
      );
      setDropped(result.droppedQuotes ?? 0);
    } catch (e) {
      if (abort.signal.aborted) setError(t("멈췄어요."));
      else if (!(e instanceof AINotConfiguredError))
        setError(
          e instanceof Error
            ? e.message
            : t(
                "연구 도우미에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
              ),
        );
    } finally {
      if (controller.current === abort) controller.current = null;
      setRunning(false);
      void usage.refetch();
    }
  }
  function stop() {
    controller.current?.abort();
  }
  return {
    run,
    stop,
    running,
    startedAt,
    error,
    dropped,
    blocked,
    summary,
    suggestions,
    /** 이 기록에 내 녹음이 있는지(정리하기 안내 문구) */
    hasMyRecording: mine,
  };
}

export type Organize = ReturnType<typeof useOrganize>;

/** ① 요약 구획 본문 */
export function SummaryBody({
  meeting,
  organize,
  canRun,
}: {
  meeting: Meeting;
  organize: Organize;
  /** 메모나 내 녹음이 있는지 */
  canRun: boolean;
}) {
  const { save } = useWorkspace();
  const [confirmDialog, confirm] = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const saved = meeting.summary;
  const proposal = organize.summary;

  async function keep() {
    if (!proposal) return;
    if (
      meeting.visibility === "shared" &&
      !(await confirm({
        title: t("공동연구자도 이 요약을 볼 수 있어요."),
        description: t("전사문에만 있던 내용이 담길 수 있어요."),
        confirmLabel: t("저장"),
      }))
    )
      return;
    try {
      await save("meetings", {
        ...meeting,
        summary: {
          text: proposal.candidate.body ?? "",
          createdAt: new Date().toISOString(),
          memoRevision: meeting.memoRevision,
          runId: proposal.runId,
        },
      });
      await save("aiCandidates", { ...proposal, status: "adopted" });
      toast.success(t("요약을 저장했어요."));
    } catch {
      toast.error(t("저장하지 못했어요. 다시 선택해 주세요."));
    }
  }
  async function dismiss() {
    if (!proposal) return;
    try {
      await save("aiCandidates", { ...proposal, status: "dismissed" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function saveEdit() {
    if (!saved || !draft.trim()) return;
    try {
      await save("meetings", {
        ...meeting,
        summary: {
          ...saved,
          text: draft.trim(),
          editedAt: new Date().toISOString(),
        },
      });
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const runButton = (label: string, outline = false) => (
    <Button
      size="sm"
      variant="outline"
      className={outline ? undefined : "organize-run"}
      disabled={!!organize.blocked || !canRun || organize.running}
      onClick={() => void organize.run()}
    >
      <Icon name="sparkles" size={15} />
      {label}
    </Button>
  );
  const sendNote = organize.hasMyRecording
    ? t("이 기록의 메모와 내 전사문으로 정리해요.")
    : t("이 기록의 메모로 정리해요.");

  return (
    <>
      {confirmDialog}
      {organize.running ? (
        <div className="organize-running">
          <WorkbenchLoading
            label={t("정리하고 있어요")}
            startedAt={organize.startedAt}
            kind="organize"
          />
          <Button size="sm" variant="ghost" onClick={organize.stop}>
            {t("멈추기")}
          </Button>
        </div>
      ) : proposal ? (
        <div className="organize-proposal">
          <span className="organize-tag">{t("AI 제안")}</span>
          <p className="organize-text">{proposal.candidate.body}</p>
          <div className="record-side-actions">
            <Button size="sm" onClick={() => void keep()}>
              {t("요약 저장")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void dismiss()}>
              {t("제안 닫기")}
            </Button>
          </div>
        </div>
      ) : saved ? (
        editing ? (
          <div className="organize-edit">
            <Textarea
              aria-label={t("요약")}
              rows={6}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="record-side-actions">
              <Button size="sm" onClick={() => void saveEdit()}>
                {t("저장")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                {t("취소")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="organize-saved">
            <p
              className="organize-text"
              data-clamped={expanded ? undefined : ""}
            >
              {saved.text}
            </p>
            {saved.text.split("\n").length > 6 || saved.text.length > 240 ? (
              <button
                type="button"
                className="organize-more"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? t("접기") : t("더 보기")}
              </button>
            ) : null}
            <p className="record-side-note">
              {t("연구 도우미가 쓴 요약 · {date}", {
                date: formatDate(saved.createdAt.slice(0, 10)),
              })}
              {saved.editedAt ? ` · ${t("고침")}` : ""}
            </p>
            {saved.memoRevision !== meeting.memoRevision && (
              <p className="record-side-note">
                {t("원문이 바뀌었어요. 요약은 바뀌기 전 내용 기준이에요.")}
              </p>
            )}
            <div className="record-side-actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(saved.text);
                  setEditing(true);
                }}
              >
                {t("편집")}
              </Button>
              {runButton(t("다시 정리하기"), true)}
            </div>
          </div>
        )
      ) : (
        <>
          <p className="record-side-empty">{t("요약이 아직 없어요.")}</p>
          {runButton(t("정리하기"))}
          <p className="record-side-note">
            {canRun ? sendNote : t("메모를 적거나 녹음하면 정리할 수 있어요.")}
          </p>
        </>
      )}
      {organize.blocked && (
        <p className="record-side-note" role="status">
          {organize.blocked}
        </p>
      )}
      {organize.error && !organize.running && (
        <p className="record-side-note organize-error" role="alert">
          {organize.error}
        </p>
      )}
      {organize.dropped > 0 && !organize.running && (
        <p className="record-side-note" role="status">
          {t("원문에서 확인하지 못한 제안 {count}개는 뺐어요.", {
            count: organize.dropped,
          })}
        </p>
      )}
    </>
  );
}

const KIND_LABEL = {
  feedback: () => t("피드백"),
  decision: () => t("결정"),
  question: () => t("질문"),
  task: () => t("할 일"),
} as const;

/** ② AI 제안 줄: 점선 · 'AI 제안' · 종류 · 제목 · 근거 · [선택] [제안 닫기] */
export function SuggestionRows({
  meeting,
  organize,
}: {
  meeting: Meeting;
  organize: Organize;
}) {
  const w = useExperience();
  const [busy, setBusy] = useState<string | null>(null);
  const items = organize.suggestions;
  if (!items.length) return null;

  async function adopt(c: SavedAICandidate) {
    const value = c.candidate;
    const category = value.category ?? "feedback";
    const body = (value.body ?? value.title).trim();
    // 메모에서 나온 것만 메모 인용·위치를 남깁니다(전사 글은 메모 검사를 통과하지 못하고, 전사는 비공개).
    const fromMemo =
      value.sourceKind !== "transcript" &&
      !!value.sourceQuote &&
      meeting.memo.includes(value.sourceQuote);
    const quote = fromMemo
      ? {
          sourceQuote: value.sourceQuote,
          sourceMemoRevision: meeting.memoRevision,
          ...(meeting.memo.slice(value.sourceStart, value.sourceEnd) ===
          value.sourceQuote
            ? { sourceStart: value.sourceStart, sourceEnd: value.sourceEnd }
            : {}),
        }
      : {};
    const base = { id: uid(), researchId: meeting.researchId };
    const target =
      category === "decision"
        ? {
            kind: "decisions",
            value: { ...base, meetingId: meeting.id, text: body, ...quote },
          }
        : category === "question"
          ? {
              kind: "questions",
              value: {
                ...base,
                meetingId: meeting.id,
                text: body,
                status: "open",
                ...quote,
              },
            }
          : category === "task"
            ? {
                kind: "tasks",
                value: {
                  ...base,
                  title: value.title.slice(0, 200),
                  description: body === value.title ? "" : body,
                  status: "todo",
                  priority: "normal",
                  dueDate: null,
                  feedbackIds: [],
                  sourceRecordId: meeting.id,
                  ...quote,
                },
              }
            : {
                kind: "feedback",
                value: {
                  ...base,
                  meetingId: meeting.id,
                  title: value.title.slice(0, 200),
                  body,
                  notes: "",
                  status: "unprocessed",
                  ...quote,
                },
              };
    setBusy(c.id);
    try {
      await w.action("rms_adopt_candidate", {
        candidateId: c.id,
        kind: target.kind,
        value: target.value,
      });
    } catch {
      toast.error(t("저장하지 못했어요. 다시 선택해 주세요."));
    } finally {
      setBusy(null);
    }
  }
  async function dismiss(c: SavedAICandidate) {
    try {
      await w.save("aiCandidates", { ...c, status: "dismissed" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function adoptAll() {
    for (const c of items) await adopt(c);
  }

  return (
    <div className="organize-suggestions" aria-label={t("AI 제안")}>
      <div className="record-side-row-head">
        <h4>{t("AI 제안 {count}개", { count: items.length })}</h4>
        {items.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={!!busy}
            onClick={() => void adoptAll()}
          >
            {t("모두 선택")}
          </Button>
        )}
      </div>
      {items.map((c) => {
        const category = (c.candidate.category ??
          "feedback") as keyof typeof KIND_LABEL;
        return (
          <div key={c.id} className="organize-suggestion">
            <span className="organize-tag">
              {t("AI 제안")} · {KIND_LABEL[category]?.() ?? t("피드백")}
            </span>
            <strong>{c.candidate.title}</strong>
            {c.candidate.sourceQuote && (
              <small className="organize-quote">
                {c.candidate.sourceKind === "transcript"
                  ? t("내 전사문")
                  : t("메모")}
                {": "}“{c.candidate.sourceQuote}”
              </small>
            )}
            <div className="record-side-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={busy === c.id}
                onClick={() => void adopt(c)}
              >
                {t("선택")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === c.id}
                onClick={() => void dismiss(c)}
              >
                {t("제안 닫기")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
