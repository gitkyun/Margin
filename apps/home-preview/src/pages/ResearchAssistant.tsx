import { useEffect, useId, useMemo, useRef, useState } from "react";
import { isImeComposing } from "@/lib/ime";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  isAIModelAvailable,
  resolveAISelection,
  useAICapabilities,
} from "@/lib/ai-capabilities";
import { AIModelSelector } from "@/components/ai/AIModelSelector";
import { ComposerModelSettings } from "@/components/ai/ComposerModelSettings";
import {
  AIComposerBanner,
  AIComposerUsage,
} from "@/components/ai/AIComposerBanner";
import {
  ComposerAttachmentCards,
  ComposerCommandMenu,
  ComposerCommandPill,
  ComposerContextMeter,
  ComposerQueue,
  filterComposerCommands,
  findComposerCommand,
  type QueuedQuestion,
} from "@/components/ai/ComposerCommands";
import { useAIUsage } from "@/lib/ai-usage";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  AINotConfiguredError,
  useAINotConfigured,
} from "@/lib/ai-availability";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useExperience, uploadPrivate } from "@/lib/experience";
import { Hint } from "@/components/ui/hint";
import { readPDFPage } from "@/lib/pdf-text";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useFileDrop, ASSISTANT_ACCEPT } from "@/lib/use-file-drop";
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
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  useDisabledReason,
} from "@/components/common";
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
import { AnswerActions, questionBefore } from "./assistant/AnswerActions";
import { MessageFileChips } from "./assistant/MessageFileChips";
import { AssistantMessageText } from "./assistant/AssistantMessageText";
import { AssistantMascot } from "@/components/brand/Brand";
import { readAgentProfile } from "@/lib/research-agent";
import {
  researchModelLabel,
  workingMascot,
} from "@/lib/assistant-presentation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { assistantSteps, type AssistantStep } from "@/lib/assistant-steps";
import { AnswerSteps, AssistantThinking } from "./assistant/AssistantThinking";
import { aiWaitKindForMode } from "@/lib/ai-wait";
import { LiveWaveform } from "@/components/recording/LiveWaveform";
import { useDictation } from "@/lib/use-dictation";
import { t } from "@/lib/i18n";
import AIPrompt, { type PromptCommand } from "@/components/kokonut/ai-prompt";
import AIVoice from "@/components/kokonut/ai-voice";
import { Mic, FolderOpen } from "lucide-react";
import { COMPOSER_COMMANDS } from "@/components/ai/ComposerCommands";

/** md(992px) 미만에서는 패널이 본문을 덮으므로 처음에는 닫아 둡니다. */
function panelStartsOpen(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia(queryDown("md")).matches;
}

const clockLabel = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export function ResearchAssistant() {
  const { researchId = "" } = useParams(),
    w = useExperience(),
    navigate = useNavigate(),
    { data, user, save, runAI, mode, refresh } = w,
    [params, setParams] = useSearchParams(),
    // 예전 주소(?tab=overview)는 패널의 제안 탭으로 엽니다.
    wantsSuggestions = params.get("tab") === "overview";
  // 계정 설정에서 고른 나만의 연구 도우미 이름. 고르지 않았으면 기본 마스코트.
  const agent = readAgentProfile(user.preferences);
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
      String(user.preferences?.thinking || "high"),
    ),
    [lastRunId, setLastRunId] = useState(""),
    [lastUsedCredits, setLastUsedCredits] = useState<number | undefined>(),
    [running, setRunning] = useState(false),
    [waiting, setActiveRun] = useState<{
      first: boolean;
      steps: AssistantStep[];
      startedAt: number;
      mode: AIInput["mode"];
    } | null>(null),
    [answered, setAnswered] = useState<{
      at: string;
      steps: AssistantStep[];
      elapsedMs: number;
    } | null>(null),
    [focusedSourceIndex, setFocusedSourceIndex] = useState<number | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [uploading, setUploading] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [adopting, setAdopting] = useState<SavedAICandidate | null>(null),
    [candidateTitle, setCandidateTitle] = useState(""),
    [candidateBody, setCandidateBody] = useState(""),
    [saveBusy, setSaveBusy] = useState(false),
    [commandDismissed, setCommandDismissed] = useState(false),
    [commandIndex, setCommandIndex] = useState(0),
    [queue, setQueue] = useState<QueuedQuestion[]>([]),
    [voiceOpen, setVoiceOpen] = useState(false),
    [voiceSeconds, setVoiceSeconds] = useState(0),
    [voiceReview, setVoiceReview] = useState<{
      before: string;
      spoken: string;
    } | null>(null);
  const candidateReason = useDisabledReason(
      !saveBusy &&
        (!candidateTitle.trim()
          ? t("제목을 입력하면 저장할 수 있어요.")
          : !candidateBody.trim() &&
            t("기록할 내용을 입력하면 저장할 수 있어요.")),
    ),
    unavailableId = useId();
  const aiNotConfigured = useAINotConfigured();
  const dictation = useDictation(() => draft, setDraft);
  const usage = useAIUsage();
  const caps = useAICapabilities(),
    selection = resolveAISelection(caps.isError ? [] : caps.data?.models, {
      model,
      thinking,
    }),
    abort = useRef<AbortController | null>(null),
    runId = useRef(""),
    sequence = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    scrollRef = useRef<HTMLDivElement>(null),
    stickToBottom = useRef(true),
    end = useRef<HTMLDivElement>(null),
    composerRef = useRef<HTMLTextAreaElement>(null),
    lastSentRef = useRef(""),
    restoreDraftRef = useRef<string | null>(null),
    skipRestoreOnCancel = useRef(false),
    queueRef = useRef<QueuedQuestion[]>([]),
    voiceBeforeRef = useRef(""),
    voiceAnalyserRef = useRef<AnalyserNode | null>(null),
    pendingFile = useRef<{
      file: File;
      record: Attachment;
      uploaded: boolean;
    } | null>(null);
  queueRef.current = queue;
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

  // `/` 명령 메뉴: 입력 맨 앞이 `/`이고 줄바꿈이 없을 때만 열어요.
  const slashQuery =
    draft.startsWith("/") && !draft.includes("\n") ? draft.slice(1) : null;
  const commandMenuOpen = slashQuery !== null && !commandDismissed;
  const filteredCommands = useMemo(
    () => (slashQuery === null ? [] : filterComposerCommands(slashQuery)),
    [slashQuery],
  );
  const activeCommand = findComposerCommand(task);

  useEffect(() => {
    setCommandIndex(0);
  }, [slashQuery]);

  // 받아쓰기 중 실제 시계(초)와 마이크 파형 분석기를 연결해요.
  useEffect(() => {
    if (!dictation.listening) {
      setVoiceSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setVoiceSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [dictation.listening]);

  useEffect(() => {
    if (!dictation.listening || !dictation.stream) {
      voiceAnalyserRef.current = null;
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(dictation.stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    if (ctx.state === "suspended") void ctx.resume();
    voiceAnalyserRef.current = analyser;
    return () => {
      voiceAnalyserRef.current = null;
      source.disconnect();
      void ctx.close().catch(() => {});
    };
  }, [dictation.listening, dictation.stream]);

  useNavigationGuard({
    dirty: !!draft.trim(),
    busy: uploading,
    label: t("AI 질문"),
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
    if ((!messages.length && !running) || !stickToBottom.current) return;
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, running]);
  useEffect(() => {
    const id = params.get("document");
    const doc = data.documents.find(
      (d) => d.id === id && d.researchId === researchId,
    );
    if (!id || !doc) return;
    const consumed = new URLSearchParams(params);
    consumed.delete("document");
    consumed.delete("selection");
    consumed.delete("tab");
    setParams(consumed, { replace: true });
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
          t(
            "선택한 문단을 불러오지 못했어요. 문서가 바뀌었을 수 있으니 글쓰기에서 문단을 다시 선택해 주세요.",
          ),
        );
        return;
      }
    }
    setContexts([
      {
        kind: "documents",
        id: doc.id,
        title: doc.title + (selectedText ? ` · ${t("선택 문단")}` : ""),
        revision: doc.revision,
        ...(selectedText ? { text: selectedText } : {}),
      },
    ]);
  }, [params, data.documents, researchId, user.id, setParams]);
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
  function openPanel(next: AssistantPanelTab, sourceIndex?: number) {
    setPanelTab(next);
    setPanelOpen(true);
    if (sourceIndex !== undefined) setFocusedSourceIndex(sourceIndex);
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
      toast.info(
        t("한 번에 {max}개까지 선택할 수 있어요.", { max: MAX_SOURCES }),
      );
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
          throw new Error(t("PDF, TXT, MD 파일만 첨부할 수 있어요."));
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
              t("PDF 파일을 읽지 못했어요. 올바른 PDF 파일인지 확인해 주세요."),
            );
          text = (await readPDFPage(file, page)).text;
        } else text = await file.text();
        if (text.length > 80000)
          throw new Error(
            t("글자 수가 너무 많아요. 8만 자 이하로 나눠서 첨부해 주세요."),
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
      toast.success(t("자료를 첨부했어요. 나만 볼 수 있어요."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function startVoiceInput() {
    voiceBeforeRef.current = draft;
    setVoiceReview(null);
    dictation.start();
  }
  function stopVoiceInput() {
    const spoken = draft;
    dictation.stop();
    if (spoken.trim()) {
      setVoiceReview({ before: voiceBeforeRef.current, spoken });
    }
  }
  function selectCommand(id: AIInput["mode"]) {
    setTask(id);
    setCommandDismissed(false);
    setDraft("");
    composerRef.current?.focus();
  }
  function enqueueCurrentDraft() {
    const text = draft.trim();
    if (!text) return;
    setQueue((prev) => [...prev, { id: uid(), text, mode: task }]);
    setDraft("");
  }

  /**
   * `retryQuestion`을 주면 입력창 대신 그 질문을 다시 보내요(답변 아래 ‘다시 답하기’).
   * 이때는 입력창을 건드리지 않고, 일반 전송은 보내는 즉시 입력창을 비워요.
   */
  async function send(
    retryQuestion?: string,
    override?: {
      mode?: AIInput["mode"];
      conversation?: AIConversation | null;
      model?: string;
      thinking?: string;
      fromComposer?: boolean;
    },
  ) {
    if (dictation.listening) dictation.stop();
    setVoiceReview(null);
    const activeMode = override?.mode ?? task;
    const requestSelection = resolveAISelection(
      caps.isError ? [] : caps.data?.models,
      {
        model: override?.model ?? selection.model,
        thinking: override?.thinking ?? selection.thinking,
      },
    );
    const question = retryQuestion ?? draft;
    if ((!override && working) || unavailable || !question.trim()) return;
    if (!requestSelection.model) {
      setError(t("사용 가능한 모델을 확인한 뒤 다시 보내 주세요."));
      return;
    }
    if (!contexts.length && activeMode !== "ask_research") {
      setError(
        t("이 요청은 읽을 기록이 필요해요. 기록이나 파일을 첨부해 주세요."),
      );
      openPanel("sources");
      return;
    }
    if (
      activeMode === "organize_meeting" &&
      (contexts.length !== 1 || contexts[0]?.kind !== "meetings")
    ) {
      setError(
        t(
          "미팅 정리는 미팅 메모 하나로만 할 수 있어요. 다른 자료는 새 대화에서 사용해 주세요.",
        ),
      );
      openPanel("sources");
      return;
    }
    const text = question.trim();
    if (retryQuestion === undefined || override?.fromComposer) {
      setDraft("");
      lastSentRef.current = text;
      restoreDraftRef.current = text;
    } else {
      restoreDraftRef.current = null;
    }
    const seq = ++sequence.current,
      id = uid(),
      controller = new AbortController();
    runId.current = id;
    setLastRunId(id);
    setLastUsedCredits(undefined);
    abort.current = controller;
    const research = data.researches.find((r) => r.id === researchId);
    const baseConv =
      override?.conversation !== undefined
        ? override.conversation
        : conversation;
    const run = {
      first: !baseConv?.messages.some((m) => m.role === "assistant"),
      steps: [] as AssistantStep[],
      startedAt: Date.now(),
      mode: activeMode,
    };
    run.steps = assistantSteps({
      first: run.first,
      researchName: research?.name ?? "",
      hasDirection: !!(
        research?.purpose?.trim() || research?.questions?.some((q) => q.trim())
      ),
      contexts,
    });
    setActiveRun(run);
    stickToBottom.current = true;
    setRunning(true);
    setError("");
    let succeeded = false;
    let savedConversation: AIConversation | null = null;
    try {
      let c = baseConv ?? {
        ...recordBase(researchId),
        title: text.slice(0, 100),
        messages: [],
        contexts,
        visibility: "private" as const,
      };
      const last = c.messages.at(-1);
      c = await save("conversations", {
        ...c,
        contexts,
        messages:
          last?.role === "user" && last.text === text
            ? c.messages
            : [...c.messages, { role: "user", text, createdAt: now() }],
      });
      setConversation(c);
      const runStartedAt = Date.now();
      const result = await runAI(
        {
          mode: activeMode,
          researchId,
          question: text,
          sourceText: "",
          contexts,
          ...requestSelection,
          history: c.messages
            .slice(-10, -1)
            .map(({ role, text }) => ({ role, text })),
          conversationId: c.id,
          clientRunId: id,
        },
        controller.signal,
      );
      if (seq !== sequence.current || controller.signal.aborted) return;
      setLastUsedCredits(result.creditsUsed);
      const answer =
        result.answer ??
        result.candidates
          .map(
            (x) =>
              `${x.title}\n${x.body ?? x.method ?? ""}\n${x.assumptions ? t("확인할 가정: {assumptions}", { assumptions: x.assumptions }) : ""}`,
          )
          .join("\n\n");
      const answeredAt = now();
      const elapsedMs = Date.now() - runStartedAt;
      const saved = await save("conversations", {
        ...c,
        messages: [
          ...c.messages,
          {
            role: "assistant",
            text: answer,
            createdAt: answeredAt,
            steps: run.steps.map((s) => s.done),
            elapsedMs,
            contexts,
          },
        ],
      });
      savedConversation = saved;
      setConversation(saved);
      setAnswered({ at: answeredAt, steps: run.steps, elapsedMs });
      restoreDraftRef.current = null;
      succeeded = true;
    } catch (e) {
      if (seq === sequence.current && !controller.signal.aborted) {
        if (restoreDraftRef.current !== null) {
          const toRestore = restoreDraftRef.current;
          setDraft((cur) => cur || toRestore);
          restoreDraftRef.current = null;
        }
        setError(e instanceof AINotConfiguredError ? "" : (e as Error).message);
      }
    } finally {
      if (seq === sequence.current) {
        setRunning(false);
        runId.current = "";
      }
      await Promise.allSettled([refresh(), usage.refetch()]);
      if (succeeded && seq === sequence.current && queueRef.current.length) {
        const [nextItem, ...rest] = queueRef.current;
        setQueue(rest);
        void send(nextItem.text, {
          mode: nextItem.mode,
          conversation: savedConversation,
        });
      }
    }
    return succeeded;
  }
  async function cancel(silent = false) {
    sequence.current++;
    abort.current?.abort();
    setRunning(false);
    const id = runId.current;
    runId.current = "";
    if (!skipRestoreOnCancel.current && restoreDraftRef.current !== null) {
      const toRestore = restoreDraftRef.current;
      setDraft((cur) => cur || toRestore);
    }
    restoreDraftRef.current = null;
    skipRestoreOnCancel.current = false;
    if (id) {
      try {
        await w.cancelRun(id);
      } catch {
        setError(
          t(
            "이 화면에서는 멈췄지만 중단 요청을 저장하지 못했어요. 결과가 나와도 이 대화에는 넣지 않아요.",
          ),
        );
      }
    }
    if (!silent) toast.info(t("실행을 중단했어요. 질문은 그대로 있어요."));
  }
  async function sendQueuedNow(itemId: string) {
    const target = queueRef.current.find((item) => item.id === itemId);
    if (!target) return;
    setQueue((prev) => prev.filter((item) => item.id !== itemId));
    skipRestoreOnCancel.current = true;
    await cancel(true);
    void send(target.text, { mode: target.mode });
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
        t("선택한 내용을 나만 볼 수 있는 기록으로 저장했어요."),
        href
          ? { action: { label: t("열기"), onClick: () => navigate(href) } }
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
    setQueue([]);
    setError("");
  }
  const unavailable = mode === "preview" || aiNotConfigured;
  const {
    getRootProps: getComposerDropProps,
    getInputProps: getComposerInputProps,
    isDragActive: isComposerDragActive,
    open: openComposerFileDialog,
  } = useFileDrop({
    accept: ASSISTANT_ACCEPT,
    kind: "assistant",
    maxFiles: MAX_SOURCES,
    // 답을 기다리는 중을 여기 넣으면 폼 전체에 aria-disabled가 붙어 입력창·중단 버튼까지 꺼진 것으로 읽혀요.
    disabled: uploading || unavailable,
    noClick: true,
    noKeyboard: true,
    onSelect: (file) => {
      if (working) return;
      void attach(file);
    },
    onSelectMultiple: (files) => {
      if (working) return;
      void (async () => {
        for (const file of files) {
          await attach(file);
        }
      })();
    },
    onError: (err) => setError(err),
  });
  const models = caps.data?.models ?? [];
  const recommendedModel = models.find(
    (item) => item.recommended && isAIModelAvailable(item),
  );
  const offerRecommended =
    !!recommendedModel && recommendedModel.id !== selection.model;
  function pickRecommended() {
    if (!recommendedModel) return;
    const next = resolveAISelection(models, {
      model: recommendedModel.id,
      thinking,
    });
    setModel(next.model ?? "");
    setThinking(next.thinking ?? "");
  }
  const messageFiles = (conversation?.contexts ?? contexts).filter(
    (c) => c.kind === "attachments" || c.kind === "versions",
  );
  // 대화 전체에 붙은 파일이라 첫 질문 위에만 한 번 보여 줘요.
  const firstUserIndex = messages.findIndex((m) => m.role === "user");

  return (
    <div className="assistant-experience">
      <PageHeader
        title={t("연구 도우미")}
        description={t(
          "고른 기록과 연구 이름·목적·질문을 읽고 답하거나 수정 방법을 제안해요.",
        )}
        status={
          <StatusBadge icon={<Icon name="lock" size={13} />}>
            {t("나만 볼 수 있는 공간")}
          </StatusBadge>
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
                  {t("대화 기록")}
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
              <Icon name="plus" size={16} />
              {t("새 대화")}
            </Button>
          </>
        }
      />
      <section className="ai-chat-main">
        <div
          ref={scrollRef}
          className="chat-scroll"
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            stickToBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 64;
          }}
        >
          {running && !messages.length ? null : !messages.length &&
            !contexts.length ? (
            <div className="assistant-welcome">
              <EmptyState
                icon="sparkles"
                title={t("아직 대화와 고른 기록이 없어요")}
                description={t(
                  "연구 도우미는 고른 기록만 읽고 답해요. 답은 AI 제안이라 선택해야 기록에 남아요.",
                )}
                points={[
                  t("미팅 메모·피드백·문서에서 읽을 기록을 골라요"),
                  t("질문하면 고른 기록을 근거로 답해요"),
                ]}
                action={
                  unavailable ? undefined : (
                    <Button
                      variant="secondary"
                      onClick={() => openPanel("sources")}
                    >
                      {t("기록 고르기")}
                    </Button>
                  )
                }
              />
            </div>
          ) : !messages.length ? (
            <div className="assistant-welcome">
              <AssistantMascot state="ready" size={64} eager />
              <h2>{t("아직 대화가 없어요")}</h2>
              {!unavailable && (
                <div className="assistant-prompts">
                  {[
                    t("다음 미팅 전에 끝낼 일이 뭐가 있지?"),
                    t("이 피드백은 어떻게 고치면 좋을까?"),
                    t("이 문단에서 더 구체적으로 쓸 곳을 찾아 줘"),
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setDraft(prompt);
                        composerRef.current?.focus();
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((m, i) => (
              <article className={`ai-message ${m.role}`} key={i}>
                {m.role === "user" ? (
                  <>
                    <span className="sr-only">{t("나")}</span>
                    {i === firstUserIndex && messageFiles.length > 0 && (
                      <MessageFileChips
                        files={messageFiles}
                        attachments={data.attachments}
                      />
                    )}
                    {/* Kokonut AI Tool Calls 질문 말풍선 원본 클래스 */}
                    <p className="m-0 max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--surface-muted)] px-3.5 py-2 text-[14px] text-[var(--text)] leading-snug [overflow-wrap:anywhere]">
                      {m.text}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="sr-only">
                      {t("연구 도우미")}
                      {agent.name ? ` · ${agent.name}` : ""}
                    </span>
                    {(m.steps?.length ||
                      (answered?.at === m.createdAt &&
                        i === messages.length - 1)) && (
                      <AnswerSteps
                        steps={
                          m.steps?.length ? m.steps : (answered?.steps ?? [])
                        }
                      />
                    )}
                    <AssistantMessageText
                      text={m.text}
                      contexts={
                        m.contexts ?? conversation?.contexts ?? contexts
                      }
                      onOpenSources={(index) => openPanel("sources", index)}
                    />
                    <AnswerActions
                      text={m.text}
                      question={questionBefore(messages, i)}
                      disabled={working || unavailable || uploading}
                      onRetry={(question) => void send(question)}
                    />
                  </>
                )}
              </article>
            ))
          )}
          {!running && messages.at(-1)?.role === "user" && (
            <div className="ai-unanswered" role="status">
              <Icon name="info" size={17} />
              <span>
                {t(
                  "이 질문에는 아직 답변이 없어요. 고른 기록과 질문을 확인한 뒤 다시 보낼 수 있어요.",
                )}
              </span>
              <Button
                variant="outline"
                disabled={unavailable}
                onClick={() => {
                  setDraft(messages.at(-1)?.text ?? "");
                }}
              >
                {t("질문 불러오기")}
              </Button>
            </div>
          )}
          {running && waiting && (
            <AssistantThinking
              first={waiting.first}
              steps={waiting.steps}
              mascot={workingMascot(task)}
              question={messages.at(-1)?.text}
              startedAt={waiting.startedAt}
              kind={aiWaitKindForMode(waiting.mode)}
            />
          )}
          <div ref={end} />
        </div>
        {unavailable && (
          <p id={unavailableId} className="assistant-unavailable" role="status">
            <Icon name="info" size={16} />
            {aiNotConfigured
              ? AI_NOT_CONFIGURED_MESSAGE
              : t(
                  "지금은 연구 도우미를 쓸 수 없어요. 직접 작성은 그대로 할 수 있어요.",
                )}
          </p>
        )}
        <div className="assistant-composer-wrap" data-kokonut-composer>
          <ComposerQueue
            items={queue}
            onMove={(idx, delta) =>
              setQueue((prev) => {
                const next = [...prev];
                const [item] = next.splice(idx, 1);
                next.splice(idx + delta, 0, item);
                return next;
              })
            }
            onReorder={(next) => setQueue(next)}
            onEdit={(itemId, text) => {
              if (text !== undefined) {
                setQueue((prev) =>
                  prev.map((item) =>
                    item.id === itemId ? { ...item, text } : item,
                  ),
                );
                return;
              }
              const target = queue.find((item) => item.id === itemId);
              if (target) {
                setDraft(target.text);
                setTask(target.mode);
                setQueue((prev) => prev.filter((item) => item.id !== itemId));
                composerRef.current?.focus();
              }
            }}
            onSendNow={(itemId) => void sendQueuedNow(itemId)}
            onRemove={(itemId) =>
              setQueue((prev) => prev.filter((item) => item.id !== itemId))
            }
            onClear={() => setQueue([])}
          />
          <fieldset
            disabled={unavailable || uploading}
            className="m-0 min-w-0 border-0 p-0"
          >
            <AIPrompt
              className="max-w-none py-0"
              modelControls={
                <ComposerModelSettings
                  models={models}
                  model={selection.model}
                  thinking={selection.thinking}
                  loading={caps.isPending}
                  failed={caps.isError}
                  disabled={unavailable || uploading || working}
                  onChange={(next) => {
                    setModel(next.model);
                    setThinking(next.thinking);
                  }}
                />
              }
              leadingControl={
                dictation.supported && !unavailable ? (
                  <button
                    type="button"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--hover-fill)]"
                    disabled={working || uploading}
                    aria-label={t("음성으로 질문 입력")}
                    aria-pressed={voiceOpen}
                    onClick={() => {
                      if (voiceOpen) dictation.stop();
                      setVoiceOpen((open) => !open);
                    }}
                  >
                    <Mic className="size-4" />
                  </button>
                ) : undefined
              }
              value={draft}
              onValueChange={setDraft}
              inputRef={composerRef}
              selectedCommand={
                activeCommand
                  ? {
                      ...activeCommand,
                      icon: <Icon name={activeCommand.icon} size={16} />,
                    }
                  : null
              }
              onCommandChange={(command) =>
                setTask((command?.id ?? "ask_research") as AIInput["mode"])
              }
              commands={COMPOSER_COMMANDS.map((command) => ({
                ...command,
                icon: <Icon name={command.icon} size={16} />,
              }))}
              disabled={unavailable || uploading}
              busy={working}
              placeholder={t(
                "질문을 적어 주세요 · / 를 치면 요청 종류를 고를 수 있어요",
              )}
              models={models.filter(isAIModelAvailable).map((model) => ({
                name: researchModelLabel(model),
                description: model.description
                  ? t(model.description)
                  : undefined,
                efforts: model.thinking,
                defaultEffort: selection.thinking,
              }))}
              selectedModel={
                models.find((model) => model.id === selection.model)
                  ? researchModelLabel(
                      models.find((model) => model.id === selection.model)!,
                    )
                  : ""
              }
              selectedEffort={selection.thinking}
              onModelChange={(label) => {
                const picked = models.find(
                  (model) => researchModelLabel(model) === label,
                );
                if (picked) setModel(picked.id);
              }}
              onEffortChange={setThinking}
              headerText=""
              header={
                !unavailable && recommendedModel ? (
                  <AIComposerBanner
                    usageHref="/account?tab=usage"
                    promo={{
                      label: researchModelLabel(recommendedModel),
                      note: recommendedModel.description
                        ? t(recommendedModel.description)
                        : undefined,
                      provider: recommendedModel.provider,
                    }}
                    onTryPromo={pickRecommended}
                  />
                ) : null
              }
              tray={
                (contexts.length > 0 || uploading) && (
                  <ComposerAttachmentCards
                    contexts={contexts}
                    data={data}
                    uploading={uploading}
                    uploadProgress={uploadProgress}
                    disabled={working || uploading}
                    onRemove={(index) =>
                      setContexts((items) =>
                        items.filter((_, i) => i !== index),
                      )
                    }
                  />
                )
              }
              onAttach={(files) => {
                if (!working && !unavailable)
                  void (async () => {
                    for (const file of Array.from(files)) await attach(file);
                  })();
              }}
              onStop={() => void cancel()}
              onQueue={(text, command) =>
                setQueue((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    text: text.trim(),
                    mode: (command?.id ?? task) as AIInput["mode"],
                  },
                ])
              }
              onSubmit={async (text, label, options) => {
                const picked = models.find(
                  (model) => researchModelLabel(model) === label,
                );
                const success = await send(text, {
                  mode: (options.command?.id ??
                    "ask_research") as AIInput["mode"],
                  model: picked?.id,
                  thinking: options.effort ?? selection.thinking,
                  fromComposer: true,
                });
                if (!success) setDraft((current) => current || text);
              }}
            />
          </fieldset>
          {!unavailable && (
            <AIComposerUsage
              runId={lastRunId || undefined}
              usedCredits={lastUsedCredits}
            />
          )}
          {voiceOpen && (
            <AIVoice
              demo={false}
              stream={dictation.stream}
              error={dictation.message}
              listening={dictation.listening}
              onListeningChange={(listening) =>
                listening ? startVoiceInput() : stopVoiceInput()
              }
              onDiscard={() => {
                setDraft(voiceBeforeRef.current);
                setVoiceReview(null);
              }}
              onSend={() => {
                if (draft.trim()) void send(draft, { fromComposer: true });
              }}
            />
          )}
          {dictation.message && (
            <p className="rms-error" role="alert">
              {dictation.message}
            </p>
          )}
        </div>
        {caps.isError && (
          <p className="rms-error" role="alert">
            {t("AI 모델 정보를 불러오지 못했어요.")}{" "}
            <Button
              variant="link"
              size="sm"
              onClick={() => void caps.refetch()}
            >
              {t("다시 불러오기")}
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
              {pendingFile.current
                ? t("등록 다시 시도")
                : t("질문 다시 보내기")}
            </Button>
          </div>
        )}
      </section>
      <MarginPanel
        label={t("근거와 제안")}
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
          onAttach={() => openComposerFileDialog()}
          versions={data.versions.filter((v) => v.researchId === researchId)}
          page={page}
          onPage={setPage}
          onAddPdf={(id) => void addPDF(id)}
          pending={pending}
          onAdopt={adopt}
          onDismiss={(c) => void dismiss(c)}
          runs={runs}
          onCancelRun={(id) => void w.cancelRun(id)}
          focusedSourceIndex={focusedSourceIndex}
        />
      </MarginPanel>
      <input
        {...getComposerInputProps({
          hidden: true,
          disabled: uploading || unavailable || working,
        })}
        ref={(node) => {
          const dropzoneRef = (getComposerInputProps() as any).ref;
          if (typeof dropzoneRef === "function") dropzoneRef(node);
          else if (dropzoneRef && typeof dropzoneRef === "object")
            dropzoneRef.current = node;
          fileInput.current = node;
        }}
      />
      <Dialog
        open={!!adopting}
        onOpenChange={(v) => {
          if (!v && !saveBusy) setAdopting(null);
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>{t("AI 제안 선택")}</DialogTitle>
            <DialogDescription>
              {adopting?.mode === "organize_meeting"
                ? t("정리한 항목을 나만 볼 수 있는 기록으로 저장해요.")
                : adopting?.mode === "suggest_revisions"
                  ? t("수정 방법으로 저장해요. 나만 볼 수 있어요.")
                  : t(
                      "나만 볼 수 있는 할 일로 저장해요. 문서는 바뀌지 않고, 교수 응답도 그대로예요.",
                    )}
            </DialogDescription>
          </DialogHeader>
          <label className="field">
            {t("제목")}
            <Input
              value={candidateTitle}
              onChange={(e) => setCandidateTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="field">
            {t("기록할 내용")}
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
              {t("취소")}
            </Button>
            <Button
              disabled={
                saveBusy || !candidateTitle.trim() || !candidateBody.trim()
              }
              aria-describedby={candidateReason.describedBy}
              onClick={() => void saveCandidate()}
            >
              {t("선택하고 저장")}
            </Button>
          </div>
          {candidateReason.node}
        </DialogContent>
      </Dialog>
    </div>
  );
}
