import { useEffect, useRef, useState } from "react";
import { isImeComposing } from "@/lib/ime";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAICapabilities } from "@/lib/ai-capabilities";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
import { PageHeader } from "@/components/common";
import { Choice } from "@/components/experience";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarginPanel } from "@/components/margin-panel/MarginPanel";
import { queryDown } from "@/design/responsive";
import {
  AssistantPanel,
  MAX_SOURCES,
  type AssistantPanelTab,
} from "./assistant/AssistantPanel";
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

/** md(992px) 미만에서는 패널이 본문을 덮으므로 처음에는 닫아 둡니다. */
function panelStartsOpen(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia(queryDown("md")).matches;
}
export function ResearchAssistant() {
  const { researchId = "" } = useParams(),
    w = useExperience(),
    navigate = useNavigate(),
    { data, user, save, runAI, mode, refresh } = w,
    [params] = useSearchParams(),
    // 예전 주소(?tab=overview)는 패널의 제안 탭으로 엽니다.
    wantsSuggestions = params.get("tab") === "overview";
  const [panelTab, setPanelTab] = useState<AssistantPanelTab>(
      wantsSuggestions ? "suggestions" : "sources",
    ),
    [panelOpen, setPanelOpen] = useState(
      () => wantsSuggestions || panelStartsOpen(),
    );
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
  function openPanel(next: AssistantPanelTab) {
    setPanelTab(next);
    setPanelOpen(true);
  }
  async function addContext(c: AIContext) {
    if (task === "organize_meeting") {
      setContexts([c]);
      return;
    }
    if (contexts.some((x) => x.kind === c.kind && x.id === c.id)) {
      setContexts((v) =>
        v.filter((x) => !(x.kind === c.kind && x.id === c.id)),
      );
      return;
    }
    if (contexts.length >= MAX_SOURCES) {
      toast.info(`한 번에 ${MAX_SOURCES}개까지 선택할 수 있어요.`);
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
      openPanel("sources");
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
      const saved = await w.action<{ id?: string } | null>(
        "rms_adopt_candidate",
        {
          candidateId: adopting.id,
          kind: targetKind,
          value: targetValue,
        },
      );
      setAdopting(null);
      // 만든 기록으로 바로 갈 수 있게 알림에 ‘열기’를 붙입니다(검수 H-4).
      const savedId = saved?.id ?? (targetValue.id as string | undefined);
      const href =
        targetKind === "feedback" && savedId
          ? `/r/${researchId}/feedback/${savedId}`
          : targetKind === "tasks" && savedId
            ? `/r/${researchId}/tasks/${savedId}`
            : targetKind === "plans" && feedback
              ? `/r/${researchId}/feedback/${feedback.id}`
              : meeting
                ? `/r/${researchId}/meetings/${meeting.id}?tab=questions`
                : undefined;
      toast.success(
        "선택한 내용을 나만 볼 수 있는 기록으로 저장했어요.",
        href
          ? { action: { label: "열기", onClick: () => navigate(href) } }
          : undefined,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }
  async function dismiss(c: SavedAICandidate) {
    try {
      await save("aiCandidates", { ...c, status: "dismissed" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function startNew() {
    setConversation(null);
    setContexts([]);
    setDraft("");
    setError("");
  }
  // 미리보기에서는 AI를 실행할 수 없어요. 예시 답변이나 진행률을 만들어 보여 주지 않습니다.
  const unavailable = mode === "preview";
  const models = caps.data?.models ?? [];
  return (
    <div className="assistant-experience">
      <PageHeader
        title="연구 도우미"
        description="고른 기록만 읽고 질문에 답하거나 수정 방법을 제안해요."
        status={
          <span className="rms-pill">
            <Icon name="lock" size={13} />
            나만 볼 수 있는 공간
          </span>
        }
        actions={
          <>
            <DropdownMenu value={conversation?.id}>
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  disabled={running || !conversations.length}
                >
                  <Icon name="chat" size={16} />
                  대화 기록
                  <Icon name="chevron-down" size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="assistant-history-menu"
              >
                {conversations.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      setConversation(c);
                      setContexts(c.contexts);
                      setError("");
                    }}
                  >
                    {c.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" disabled={running} onClick={startNew}>
              <Icon name="plus" size={16} />새 대화
            </Button>
          </>
        }
      />
      <section className="ai-chat-main">
        <div className="chat-scroll">
          {!messages.length ? (
            <div className="assistant-welcome">
              <AssistantMascot state="ready" size={64} eager />
              <h2>기록을 고르고 질문해 주세요</h2>
              <p>
                근거에서 미팅 메모나 문서 같은 기록을 고르거나 파일을 첨부할 수
                있어요. 고른 기록만 읽어요.
              </p>
              {!unavailable && (
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
              )}
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
                이 질문에는 아직 답변이 없어요. 고른 기록과 질문을 확인한 뒤
                다시 보낼 수 있어요.
              </span>
              <Button
                variant="outline"
                disabled={unavailable}
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
                  {workMessages[task] ?? "고른 기록을 살펴보고 있어요."}
                </strong>
                <small>답변이 나와도 연구 기록은 바뀌지 않아요.</small>
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
        {unavailable && (
          <p className="assistant-unavailable" role="status">
            <Icon name="info" size={16} />
            지금은 연구 도우미를 쓸 수 없어요. 직접 작성은 그대로 할 수 있어요.
          </p>
        )}
        <form
          className="ai-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading && !unavailable)
              void attach(e.dataTransfer.files[0]);
          }}
        >
          <textarea
            ref={composerRef}
            aria-label="연구 도우미에게 질문"
            placeholder={
              unavailable
                ? "미리보기에서는 질문을 보낼 수 없어요."
                : contexts.length
                  ? "예: 이 기록에서 먼저 고칠 부분을 찾아 줘"
                  : "먼저 근거로 쓸 기록이나 자료를 골라 주세요."
            }
            value={draft}
            disabled={unavailable}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            rows={3}
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                e.key === "Enter" &&
                !isImeComposing(e)
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-actions">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="composer-sources"
              aria-label={
                contexts.length
                  ? `근거 ${contexts.length}개, 바꾸기`
                  : "근거 고르기"
              }
              onClick={() => openPanel("sources")}
            >
              <Icon name="clip" size={16} />
              {contexts.length ? `근거 ${contexts.length}개` : "근거 고르기"}
            </Button>
            <Choice
              compact
              value={task}
              onChange={(v) => setTask(v as AIInput["mode"])}
              label="요청 종류"
              disabled={running || unavailable}
              options={Object.entries(modeLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            {/* 고를 모델이 둘 이상일 때만 보입니다. 연결 전에는 모델 이름을 보여 주지 않아요. */}
            {models.length > 1 && (
              <Choice
                compact
                value={allowedModel?.id ?? ""}
                onChange={setModel}
                disabled={running}
                label="AI 모델"
                options={models.map((m) => ({
                  value: m.id,
                  label: researchModelLabel(m),
                }))}
              />
            )}
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
                disabled={
                  unavailable || !draft.trim() || !contexts.length || uploading
                }
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
            <Button
              variant="link"
              size="sm"
              onClick={() => void caps.refetch()}
            >
              다시 불러오기
            </Button>
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
        {!unavailable && (
          <p className="composer-hint">
            {contexts.length ? `고른 근거 ${contexts.length}개만 읽어요. ` : ""}
            보내기: ⌘/Ctrl + Enter
          </p>
        )}
      </section>
      <MarginPanel
        label="근거와 제안"
        open={panelOpen}
        onOpen={() => setPanelOpen(true)}
        onClose={() => setPanelOpen(false)}
      >
        <AssistantPanel
          tab={panelTab}
          onTab={setPanelTab}
          onClose={() => setPanelOpen(false)}
          busy={running || uploading}
          single={task === "organize_meeting"}
          contexts={contexts}
          sourceOptions={sourceOptions}
          onToggleSource={(c) => void addContext(c)}
          onRemoveSource={(index) =>
            setContexts(contexts.filter((_, i) => i !== index))
          }
          onAttach={() => fileInput.current?.click()}
          versions={data.versions.filter((v) => v.researchId === researchId)}
          page={page}
          onPage={setPage}
          onAddPdf={(id) => void addPDF(id)}
          pending={pending}
          onAdopt={adopt}
          onDismiss={(c) => void dismiss(c)}
          runs={runs}
          onCancelRun={(id) => void w.cancelRun(id)}
        />
      </MarginPanel>
      <input
        hidden
        type="file"
        accept=".pdf,.txt,.md"
        ref={fileInput}
        onChange={(e) => void attach(e.target.files?.[0])}
      />
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
