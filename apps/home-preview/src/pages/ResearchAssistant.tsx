import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAICapabilities } from "@/lib/ai-capabilities";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useExperience, uploadPrivate, modeLabels } from "@/lib/experience";
import { assertConnected } from "@/lib/supabase";
import { readPDFPage } from "@/lib/pdf-text";
import { useNavigationGuard } from "@/lib/navigation-guard";
import {
  recordBase,
  now,
  uid,
  type AIInput,
  type AIContext,
  type AIConversation,
  type Attachment,
  type SavedAICandidate,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import {
  Choice,
  Segments,
  MagicCard,
  AnimatedList,
} from "@/components/experience";
import { AssistantMascot } from "@/components/brand/Brand";
import {
  workingMascot,
  workMessages,
  reviewDepthOptions,
  resolveReviewDepth,
  reviewDepthHints,
  researchModelLabel,
} from "@/lib/assistant-presentation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { UsageDetails } from "./SettingsPage";
const stateLabel: Record<string, string> = {
  running: "실행 중",
  complete: "성공",
  failed: "실패",
  cancelled: "중단",
};
export function ResearchAssistant() {
  const { researchId = "" } = useParams(),
    w = useExperience(),
    { data, user, save, runAI, mode, refresh } = w,
    [params, setParams] = useSearchParams(),
    tab = params.get("tab") ?? "chat";
  const [conversation, setConversation] = useState<AIConversation | null>(null),
    [draft, setDraft] = useState(""),
    [contexts, setContexts] = useState<AIContext[]>([]),
    [task, setTask] = useState<AIInput["mode"]>(
      (params.get("mode") as AIInput["mode"]) || "ask_research",
    ),
    [model, setModel] = useState(String(user.preferences?.model ?? "")),
    [thinking, setThinking] = useState(
      String(user.preferences?.thinking || "minimal"),
    ),
    [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [picker, setPicker] = useState(false),
    [page, setPage] = useState(1),
    [uploading, setUploading] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [adopting, setAdopting] = useState<SavedAICandidate | null>(null),
    [candidateTitle, setCandidateTitle] = useState(""),
    [candidateBody, setCandidateBody] = useState(""),
    [saveBusy, setSaveBusy] = useState(false);
  const caps = useAICapabilities(),
    allowedModel =
      caps.data?.models.find((m) => m.id === model) ?? caps.data?.models[0],
    abort = useRef<AbortController | null>(null),
    runId = useRef(""),
    sequence = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    end = useRef<HTMLDivElement>(null),
    composerRef = useRef<HTMLTextAreaElement>(null),
    pendingFile = useRef<{
      file: File;
      record: Attachment;
      uploaded: boolean;
    } | null>(null);
  const conversations = data.conversations
      .filter((c) => c.researchId === researchId && !c.archivedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    runs = data.aiRuns.filter((r) => r.researchId === researchId),
    pending = data.aiCandidates.filter(
      (c) => c.researchId === researchId && c.status === "pending",
    ),
    messages = conversation?.messages ?? [];
  const activeRun = runs.find((r) => r.status === "running");
  const working = running || !!activeRun;
  const currentTask = running ? task : (activeRun?.mode ?? task);
  useNavigationGuard({
    dirty: !!draft.trim(),
    busy: uploading,
    label: "AI 질문",
  });
  useEffect(
    () => () => {
      sequence.current++;
      abort.current?.abort();
      if (runId.current) void w.cancelRun(runId.current).catch(() => {});
    },
    [],
  );
  useEffect(() => {
    // 첫 안내 화면에서는 아래로 끌어내리지 않아 캐릭터·제목이 잘리지 않게 합니다.
    if (!messages.length && !running) return;
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, running]);
  useEffect(() => {
    const id = params.get("document");
    const doc = data.documents.find(
      (d) => d.id === id && d.researchId === researchId,
    );
    let selectedText: string | undefined;
    if (doc && params.get("selection") === "1") {
      try {
        const selected = JSON.parse(
          sessionStorage.getItem(`rms-ai-selection:${user.id}:${doc.id}`) ??
            "null",
        );
        if (
          !selected ||
          selected.revision !== doc.revision ||
          typeof selected.text !== "string" ||
          !selected.text.trim() ||
          !doc.text.includes(selected.text)
        )
          throw new Error();
        selectedText = selected.text;
      } catch {
        setContexts([]);
        setError(
          "선택한 문단을 불러오지 못했어요. 문서가 바뀌었을 수 있으니 글쓰기에서 문단을 다시 선택해 주세요.",
        );
        return;
      }
    }
    if (doc)
      setContexts([
        {
          kind: "documents",
          id: doc.id,
          title: doc.title + (selectedText ? " · 선택 문단" : ""),
          revision: doc.revision,
          ...(selectedText ? { text: selectedText } : {}),
        },
      ]);
  }, [params.get("document")]);
  useEffect(() => {
    if (allowedModel && !allowedModel.thinking.includes(thinking))
      setThinking(resolveReviewDepth(allowedModel.thinking, thinking));
  }, [allowedModel?.id, allowedModel?.thinking.join(","), thinking]);
  const sourceOptions: AIContext[] = [
    ...data.meetings
      .filter(
        (m) => m.researchId === researchId && m.memo.trim() && !m.archivedAt,
      )
      .map((m) => ({
        kind: "meetings" as const,
        id: m.id,
        title: m.title,
        revision: m.memoRevision,
      })),
    ...data.feedback
      .filter((f) => f.researchId === researchId && !f.archivedAt)
      .map((f) => ({ kind: "feedback" as const, id: f.id, title: f.title })),
    ...data.documents
      .filter((d) => d.researchId === researchId && !d.archivedAt)
      .map((d) => ({
        kind: "documents" as const,
        id: d.id,
        title: d.title,
        revision: d.revision,
      })),
    ...data.tasks
      .filter((d) => d.researchId === researchId && !d.archivedAt)
      .map((d) => ({ kind: "tasks" as const, id: d.id, title: d.title })),
    ...data.phases
      .filter((d) => d.researchId === researchId && !d.archivedAt)
      .map((d) => ({ kind: "phases" as const, id: d.id, title: d.title })),
    ...data.attachments
      .filter((a) => a.researchId === researchId && !a.archivedAt)
      .map((a) => ({ kind: "attachments" as const, id: a.id, title: a.title })),
  ];
  async function addContext(c: AIContext) {
    if (task === "organize_meeting") {
      setContexts([c]);
      setPicker(false);
      return;
    }
    if (contexts.some((x) => x.kind === c.kind && x.id === c.id)) {
      setContexts((v) =>
        v.filter((x) => !(x.kind === c.kind && x.id === c.id)),
      );
      return;
    }
    if (contexts.length >= 8) {
      toast.info("한 번에 8개까지 선택할 수 있어요.");
      return;
    }
    setContexts((v) =>
      v.some((x) => x.kind === c.kind && x.id === c.id) ? v : [...v, c],
    );
  }
  async function addPDF(id: string) {
    try {
      setUploading(true);
      const v = data.versions.find((v) => v.id === id);
      if (!v) return;
      const b = await w.openFile(v),
        result = await readPDFPage(b, page);
      await addContext({
        kind: "versions",
        id: v.id,
        title: v.fileName,
        page,
        text: result.text,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function attach(file?: File) {
    if (!file && !pendingFile.current) return;
    setUploading(true);
    setError("");
    setUploadProgress(null);
    try {
      let p = pendingFile.current;
      if (file) {
        const ext = file.name.split(".").at(-1)?.toLowerCase();
        if (!["pdf", "txt", "md"].includes(ext ?? ""))
          throw new Error("PDF, TXT, MD 파일만 첨부할 수 있어요.");
        let text = "",
          type =
            ext === "pdf"
              ? "application/pdf"
              : ext === "md"
                ? "text/markdown"
                : "text/plain";
        const cleanFile = new File([file], file.name, { type });
        if (ext === "pdf") {
          if ((await file.slice(0, 5).text()) !== "%PDF-")
            throw new Error(
              "PDF 파일을 읽지 못했어요. 올바른 PDF 파일인지 확인해 주세요.",
            );
          text = (await readPDFPage(file, page)).text;
        } else text = await file.text();
        if (text.length > 80000)
          throw new Error(
            "글자 수가 너무 많아요. 8만 자 이하로 나눠서 첨부해 주세요.",
          );
        const base = recordBase(researchId);
        p = {
          file: cleanFile,
          record: {
            ...base,
            title: file.name,
            fileName: file.name,
            storagePath: `${user.id}/${researchId}/${base.id}.${ext}`,
            size: file.size,
            mimeType: type,
            text,
            visibility: "private",
          },
          uploaded: false,
        };
        pendingFile.current = p;
      }
      if (!p) return;
      if (!p.uploaded) {
        await uploadPrivate(
          p.file,
          p.record.storagePath,
          mode,
          setUploadProgress,
        );
        p.uploaded = true;
      }
      const saved = await save("attachments", p.record);
      await addContext({
        kind: "attachments",
        id: saved.id,
        title: saved.title,
      });
      pendingFile.current = null;
      toast.success("자료를 첨부했어요. 나만 볼 수 있어요.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function send() {
    if (running || !contexts.length || !draft.trim()) return;
    if (
      task === "organize_meeting" &&
      (contexts.length !== 1 || contexts[0]?.kind !== "meetings")
    ) {
      setError(
        "미팅 정리는 미팅 메모 하나로만 할 수 있어요. 다른 자료는 새 대화에서 사용해 주세요.",
      );
      setPicker(true);
      return;
    }
    const seq = ++sequence.current,
      id = uid(),
      controller = new AbortController();
    runId.current = id;
    abort.current = controller;
    setRunning(true);
    setError("");
    try {
      let c = conversation ?? {
        ...recordBase(researchId),
        title: draft.slice(0, 100),
        messages: [],
        contexts,
        visibility: "private" as const,
      };
      const text = draft.trim(),
        last = c.messages.at(-1);
      c = await save("conversations", {
        ...c,
        contexts,
        messages:
          last?.role === "user" && last.text === text
            ? c.messages
            : [...c.messages, { role: "user", text, createdAt: now() }],
      });
      setConversation(c);
      const result = await runAI(
        {
          mode: task,
          researchId,
          question: text,
          sourceText: "",
          contexts,
          model: allowedModel?.id,
          thinking: allowedModel?.thinking.includes(thinking)
            ? (thinking as AIInput["thinking"])
            : undefined,
          history: c.messages
            .slice(-10, -1)
            .map(({ role, text }) => ({ role, text })),
          conversationId: c.id,
          clientRunId: id,
        },
        controller.signal,
      );
      if (seq !== sequence.current || controller.signal.aborted) return;
      const answer =
        result.answer ??
        result.candidates
          .map(
            (x) =>
              `${x.title}\n${x.body ?? x.method ?? ""}\n${x.assumptions ? "확인할 가정: " + x.assumptions : ""}`,
          )
          .join("\n\n");
      const saved = await save("conversations", {
        ...c,
        messages: [
          ...c.messages,
          { role: "assistant", text: answer, createdAt: now() },
        ],
      });
      setConversation(saved);
      setDraft("");
    } catch (e) {
      if (seq === sequence.current && !controller.signal.aborted)
        setError((e as Error).message);
    } finally {
      if (seq === sequence.current) {
        setRunning(false);
        runId.current = "";
      }
      await refresh();
    }
  }
  async function cancel() {
    sequence.current++;
    abort.current?.abort();
    setRunning(false);
    const id = runId.current;
    runId.current = "";
    if (id) {
      try {
        await w.cancelRun(id);
      } catch {
        setError(
          "이 화면에서는 멈췄지만 중단 요청을 저장하지 못했어요. 결과가 나와도 이 대화에는 넣지 않아요.",
        );
      }
    }
    toast.info("실행을 중단했어요. 질문은 그대로 있어요.");
  }
  function adopt(c: SavedAICandidate) {
    setAdopting(c);
    setCandidateTitle(c.title);
    setCandidateBody(c.candidate.body ?? c.candidate.method ?? "");
  }
  async function saveCandidate() {
    if (!adopting) return;
    setSaveBusy(true);
    try {
      const c = adopting.candidate,
        meeting = adopting.contexts?.find((x) => x.kind === "meetings"),
        feedback = adopting.contexts?.find((x) => x.kind === "feedback");
      let targetKind = "tasks";
      let targetValue: Record<string, unknown> = {};
      if (adopting.mode === "organize_meeting" && meeting) {
        if (c.category === "decision") {
          targetKind = "decisions";
          targetValue = {
            ...recordBase(researchId),
            meetingId: meeting.id,
            text: candidateBody,
            origin: "ai",
            visibility: "private",
          };
        } else if (c.category === "question") {
          targetKind = "questions";
          targetValue = {
            ...recordBase(researchId),
            meetingId: meeting.id,
            text: candidateBody,
            status: "open",
            origin: "ai",
            visibility: "private",
          };
        } else {
          targetKind = "feedback";
          targetValue = {
            ...recordBase(researchId),
            title: candidateTitle,
            body: candidateBody,
            meetingId: meeting.id,
            sourceQuote: c.sourceQuote,
            sourceMemoRevision: meeting.revision,
            status: "unprocessed",
            notes: "",
            origin: "ai",
            visibility: "private",
          };
        }
      } else if (adopting.mode === "suggest_revisions" && feedback) {
        targetKind = "plans";
        targetValue = {
          ...recordBase(researchId),
          feedbackId: feedback.id,
          title: candidateTitle,
          method: candidateBody,
          expectedResult: c.expectedResult ?? "",
          assumptions: c.assumptions ?? "",
          requiredMaterials: c.requiredMaterials ?? "",
          suggestedTasks: c.suggestedTasks ?? [],
          status: "saved",
          origin: "ai",
          visibility: "private",
        };
      } else {
        targetKind = "tasks";
        targetValue = {
          ...recordBase(researchId),
          title: candidateTitle,
          description: candidateBody,
          status: "todo",
          priority: "normal",
          dueDate: null,
          feedbackIds: feedback ? [feedback.id] : [],
          origin: "ai",
          visibility: "private",
        };
      }
      await w.action("rms_adopt_candidate", {
        candidateId: adopting.id,
        kind: targetKind,
        value: targetValue,
      });
      setAdopting(null);
      toast.success("선택한 내용을 나만 볼 수 있는 기록으로 저장했어요.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }
  return (
    <div className="assistant-experience">
      <PageHeader
        title="연구 도우미"
        description="선택한 기록만 읽고 질문에 답하거나 수정 방법을 제안해요."
        actions={
          <span className="rms-pill">
            <Icon name="lock" size={13} />
            나만 볼 수 있는 공간
          </span>
        }
      />
      <div className="experience-toolbar">
        <Segments
          value={tab}
          onChange={(v) => setParams({ tab: v })}
          options={[
            { value: "chat", label: "대화" },
            { value: "overview", label: "AI 제안", count: pending.length },
            { value: "usage", label: "사용량" },
          ]}
        />
      </div>
      {tab === "usage" ? (
        <>
          <UsageDetails />
          <div className="ai-usage-breakdown">
            {Object.entries(modeLabels).map(([key, label]) => {
              const items = runs.filter((r) => r.mode === key),
                duration = items
                  .filter((r) => r.completedAt)
                  .reduce(
                    (n, r) =>
                      n +
                      (new Date(r.completedAt!).getTime() -
                        new Date(r.createdAt).getTime()) /
                        1000,
                    0,
                  );
              return (
                <div key={key}>
                  <strong>{label}</strong>
                  <span>{items.length}회</span>
                  <small>
                    성공 {items.filter((r) => r.status === "complete").length}회
                    · 총 {Math.round(duration)}초
                  </small>
                </div>
              );
            })}
          </div>
        </>
      ) : tab === "overview" ? (
        <div className="agent-overview">
          <MagicCard className="agent-overview-hero">
            <AssistantMascot
              state={
                working
                  ? workingMascot(currentTask)
                  : pending.length
                    ? "idea"
                    : "idle"
              }
              active={working}
              size={80}
            />
            <div>
              <div className="card-label">
                <h2>연구 도우미</h2>
                <StatusBadge
                  tone={working ? "blue" : pending.length ? "amber" : "neutral"}
                >
                  {working
                    ? "실행 중"
                    : pending.length
                      ? "확인할 제안 있음"
                      : "대기 중"}
                </StatusBadge>
              </div>
              <h3>
                {working
                  ? modeLabels[currentTask]
                  : pending.length
                    ? `확인할 AI 제안이 ${pending.length}개 있어요`
                    : "확인할 AI 제안이 없어요"}
              </h3>
              <p>
                제안을 기록으로 남길지는 직접 선택해요. 선택하지 않은 제안은
                나만 볼 수 있어요.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setParams({ tab: "chat" })}
            >
              대화 열기
            </Button>
          </MagicCard>
          <section className="experience-panel">
            <div className="section-heading">
              <h2>확인할 AI 제안</h2>
              <span className="count-chip">{pending.length}</span>
            </div>
            <AnimatedList>
              {pending.map((c) => (
                <article key={c.id} className="candidate-overview-row">
                  <div>
                    <span className="rms-pill">
                      {modeLabels[c.mode ?? ""] ?? "AI 제안"}
                    </span>
                    <h3>{c.title}</h3>
                    <p>{c.candidate.body ?? c.candidate.method}</p>
                    {c.candidate.sourceQuote && (
                      <blockquote>
                        <small>원문 인용</small>
                        {c.candidate.sourceQuote}
                      </blockquote>
                    )}
                    {c.candidate.assumptions && (
                      <p className="candidate-assumption">
                        확인할 가정: {c.candidate.assumptions}
                      </p>
                    )}
                  </div>
                  <div className="button-row">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await save("aiCandidates", {
                            ...c,
                            status: "dismissed",
                          });
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      사용하지 않기
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adopt(c)}
                    >
                      선택하기
                    </Button>
                  </div>
                </article>
              ))}
            </AnimatedList>
            {!pending.length && <p>AI 제안이 나오면 여기에 표시돼요.</p>}
          </section>
          <section className="experience-panel">
            <h2>실행 기록</h2>
            {runs.map((r) => (
              <div className="run-row" key={r.id}>
                <Icon
                  name={
                    r.status === "complete"
                      ? "check"
                      : r.status === "failed"
                        ? "warning"
                        : "sparkles"
                  }
                  size={18}
                />
                <div>
                  <strong>{modeLabels[r.mode] ?? "연구 대화"}</strong>
                  <small>
                    {new Date(r.createdAt).toLocaleString("ko-KR")}
                    {r.model && ` · ${r.model}`}
                  </small>
                  {r.error && <p>{r.error}</p>}
                </div>
                <StatusBadge
                  tone={
                    r.status === "complete"
                      ? "green"
                      : r.status === "failed"
                        ? "red"
                        : "neutral"
                  }
                >
                  {stateLabel[r.status]}
                </StatusBadge>
                {r.status === "running" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void w.cancelRun(r.id)}
                  >
                    중단
                  </Button>
                )}
              </div>
            ))}
            {!runs.length && (
              <p className="quiet-placeholder">아직 실행 기록이 없어요.</p>
            )}
          </section>
        </div>
      ) : (
        <div className="ai-workspace">
          <aside className="conversation-list">
            <Button
              variant="outline"
              fullWidth="desktop"
              disabled={running}
              onClick={() => {
                setConversation(null);
                setContexts([]);
                setDraft("");
                setError("");
              }}
            >
              <Icon name="plus" size={16} />새 대화
            </Button>
            {conversations.map((c) => (
              <button
                key={c.id}
                className={c.id === conversation?.id ? "active" : ""}
                disabled={running}
                onClick={() => {
                  setConversation(c);
                  setContexts(c.contexts);
                  setError("");
                }}
              >
                <Icon name="chat" size={16} />
                <span>{c.title}</span>
              </button>
            ))}
          </aside>
          <section className="ai-chat-main">
            <div className="chat-scroll">
              {!messages.length ? (
                <div className="assistant-welcome">
                  <AssistantMascot state="ready" size={64} eager />
                  <h2>기록을 고르고 질문해 주세요</h2>
                  <p>
                    클립 버튼으로 미팅 메모나 문서 같은 기록을 고르거나 파일을
                    첨부할 수 있어요.
                  </p>
                  <div className="assistant-prompts">
                    {(
                      [
                        ["tasks", "다음 미팅까지 할 일을 정리해 줘"],
                        ["layers", "이 피드백의 수정 방법을 비교해 줘"],
                        ["search", "이 문단에서 더 구체화할 부분을 찾아 줘"],
                      ] as const
                    ).map(([icon, t]) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setDraft(t);
                          composerRef.current?.focus();
                        }}
                      >
                        <Icon name={icon} size={18} />
                        <span>{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <article className={`ai-message ${m.role}`} key={i}>
                    <span className="message-role">
                      {m.role === "assistant" && (
                        <AssistantMascot state="chatting" size={28} />
                      )}
                      {m.role === "user" ? "나" : "연구 도우미"}
                    </span>
                    <div>{m.text}</div>
                  </article>
                ))
              )}
              {!running && messages.at(-1)?.role === "user" && (
                <div className="ai-unanswered" role="status">
                  <Icon name="info" size={17} />
                  <span>
                    이 질문에는 아직 답변이 없어요. 선택한 기록과 질문을 확인한
                    뒤 다시 보낼 수 있어요.
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraft(messages.at(-1)?.text ?? "");
                    }}
                  >
                    질문 불러오기
                  </Button>
                </div>
              )}
              {running && (
                <div className="ai-processing" role="status">
                  <AssistantMascot
                    state={workingMascot(task)}
                    active
                    size={48}
                    eager
                  />
                  <div>
                    <strong>
                      {workMessages[task] ?? "선택한 기록을 살펴보고 있어요."}
                    </strong>
                    <small>답변이 나와도 연구 기록은 바뀌지 않아요.</small>
                  </div>
                </div>
              )}
              <div ref={end} />
            </div>
            <form
              className="ai-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!uploading) void attach(e.dataTransfer.files[0]);
              }}
            >
              <div className="context-chips">
                {contexts.map((c, i) => (
                  <span className="context-chip" key={`${c.kind}-${c.id}`}>
                    <Icon name="file" size={14} />
                    {c.title}
                    {c.page && ` · ${c.page}쪽`}
                    <button
                      type="button"
                      disabled={running}
                      aria-label={`${c.title} 선택 해제`}
                      onClick={() =>
                        setContexts(contexts.filter((_, j) => j !== i))
                      }
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <textarea
                ref={composerRef}
                aria-label="연구 도우미에게 질문"
                placeholder={
                  contexts.length
                    ? "예: 이 기록에서 먼저 고칠 부분을 찾아 줘"
                    : "먼저 사용할 기록이나 자료를 선택해 주세요."
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                rows={3}
                onKeyDown={(e) => {
                  if (
                    (e.metaKey || e.ctrlKey) &&
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="composer-actions">
                <button
                  className="icon-button"
                  type="button"
                  title="자료 선택·첨부"
                  aria-label="자료 선택·첨부"
                  disabled={running || uploading}
                  onClick={() => setPicker(true)}
                >
                  <Icon name="clip" size={20} />
                </button>
                <Choice
                  compact
                  value={task}
                  onChange={(v) => setTask(v as AIInput["mode"])}
                  label="요청 종류"
                  disabled={running}
                  options={Object.entries(modeLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
                <Choice
                  compact
                  value={allowedModel?.id ?? ""}
                  onChange={setModel}
                  disabled={running || !caps.data}
                  label="AI 모델"
                  options={
                    caps.data?.models.map((m) => ({
                      value: m.id,
                      label: researchModelLabel(m),
                    })) ?? [
                      {
                        value: "",
                        label: caps.isError
                          ? "모델 정보 없음"
                          : "모델 불러오는 중",
                      },
                    ]
                  }
                />
                {!!allowedModel?.thinking.length && (
                  <Choice
                    compact
                    label="답변 깊이"
                    value={thinking}
                    onChange={setThinking}
                    disabled={running}
                    options={reviewDepthOptions(allowedModel.thinking).map(
                      (option) => ({
                        ...option,
                        search: option.label,
                        label: (
                          <span
                            className="margin-depth-option"
                            title={reviewDepthHints[option.value]}
                          >
                            <Icon name="layers" size={15} />
                            {option.label}
                          </span>
                        ),
                      }),
                    )}
                  />
                )}{" "}
                {running ? (
                  <Button
                    type="button"
                    size="icon"
                    aria-label="실행 중단"
                    onClick={() => void cancel()}
                  >
                    <Icon name="stop" size={17} />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="질문 보내기"
                    disabled={!draft.trim() || !contexts.length || uploading}
                  >
                    <Icon name="arrow-up" size={19} />
                  </Button>
                )}
              </div>
              {uploading && (
                <p role="status">
                  자료 준비 중
                  {uploadProgress !== null ? ` · ${uploadProgress}%` : ""}
                </p>
              )}
            </form>
            {caps.isError && (
              <p className="rms-error" role="alert">
                AI 모델 정보를 불러오지 못했어요.{" "}
                <button type="button" onClick={() => void caps.refetch()}>
                  다시 불러오기
                </button>
              </p>
            )}
            {error && (
              <div className="rms-error" role="alert">
                <span className="margin-error-content">
                  <AssistantMascot state="attention" size={36} />
                  <span>{error}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    pendingFile.current ? void attach() : void send()
                  }
                >
                  {pendingFile.current ? "등록 다시 시도" : "질문 다시 보내기"}
                </Button>
              </div>
            )}
            {!!allowedModel?.thinking.length && reviewDepthHints[thinking] && (
              <p className="margin-depth-help">{reviewDepthHints[thinking]}</p>
            )}
            <p className="composer-hint">
              {contexts.length
                ? `선택한 기록 ${contexts.length}개만 사용해요. `
                : ""}
              보내기: ⌘/Ctrl + Enter
            </p>
          </section>
        </div>
      )}
      <input
        hidden
        type="file"
        accept=".pdf,.txt,.md"
        ref={fileInput}
        onChange={(e) => void attach(e.target.files?.[0])}
      />
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>사용할 자료 선택</DialogTitle>
            <DialogDescription>
              {task === "organize_meeting"
                ? "정리할 미팅 메모를 하나 선택해 주세요."
                : "선택한 기록과 페이지만 사용해요. 첨부한 파일은 나만 볼 수 있어요."}
            </DialogDescription>
          </DialogHeader>
          <div className="source-picker">
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="upload" size={18} />
              PDF·TXT·MD 첨부
            </Button>
            <h3>연구 기록</h3>
            {sourceOptions.map((c) => (
              <button
                type="button"
                key={`${c.kind}-${c.id}`}
                onClick={() => void addContext(c)}
                aria-pressed={contexts.some(
                  (x) => x.kind === c.kind && x.id === c.id,
                )}
              >
                <Icon name="file" size={17} />
                <span>
                  {c.title}
                  <small>
                    {
                      (
                        {
                          meetings: "미팅 메모",
                          feedback: "피드백",
                          documents: "문서",
                          tasks: "할 일",
                          phases: "연구 단계",
                          attachments: "내 첨부 파일",
                        } as Record<string, string>
                      )[c.kind]
                    }
                  </small>
                </span>
                <Icon
                  name={
                    contexts.some((x) => x.kind === c.kind && x.id === c.id)
                      ? "check"
                      : "plus"
                  }
                  size={16}
                />
              </button>
            ))}
            <h3>PDF 파일</h3>
            <label className="field">
              읽을 페이지
              <Input
                type="number"
                min={1}
                max={1000}
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              />
            </label>
            {data.versions
              .filter((v) => v.researchId === researchId)
              .map((v) => (
                <button
                  type="button"
                  key={v.id}
                  disabled={uploading}
                  onClick={() => void addPDF(v.id)}
                >
                  <Icon name="file" size={17} />
                  <span>
                    {v.fileName}
                    <small>
                      v{v.number} · {page}쪽
                    </small>
                  </span>
                  <Icon name="plus" size={16} />
                </button>
              ))}
          </div>
          {task !== "organize_meeting" && (
            // Outside the scrolling list so the confirm action stays visible.
            <div className="bottom-actions">
              <Button onClick={() => setPicker(false)}>
                선택 마치기 · {contexts.length}개
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!adopting}
        onOpenChange={(v) => {
          if (!v && !saveBusy) setAdopting(null);
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>AI 제안 선택</DialogTitle>
            <DialogDescription>
              {adopting?.mode === "organize_meeting"
                ? "정리한 항목을 나만 볼 수 있는 기록으로 저장해요."
                : adopting?.mode === "suggest_revisions"
                  ? "수정 방법으로 저장해요. 나만 볼 수 있어요."
                  : "나만 볼 수 있는 할 일로 저장해요. 문서는 바뀌지 않고, 교수 응답도 그대로예요."}
            </DialogDescription>
          </DialogHeader>
          <label className="field">
            제목
            <Input
              value={candidateTitle}
              onChange={(e) => setCandidateTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="field">
            기록할 내용
            <Textarea
              rows={7}
              value={candidateBody}
              onChange={(e) => setCandidateBody(e.target.value)}
            />
          </label>
          <div className="bottom-actions">
            <Button
              variant="outline"
              disabled={saveBusy}
              onClick={() => setAdopting(null)}
            >
              취소
            </Button>
            <Button
              disabled={
                saveBusy || !candidateTitle.trim() || !candidateBody.trim()
              }
              onClick={() => void saveCandidate()}
            >
              선택하고 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
