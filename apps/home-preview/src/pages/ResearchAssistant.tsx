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
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { handoffState, readHandoff } from "@/lib/assistant-handoff";
import { contextKey, viewingContext } from "@/lib/viewing-context";
import {
  canInsertInto,
  canSuggestIn,
  insertIntoEditor,
  openSuggestEdits,
} from "@/lib/editor-flush";
import {
  draftQuestion,
  draftRequestMax,
  lastAsked,
  nextSteps,
  suggestedTasksOf,
  taskLink,
} from "@/lib/assistant-next";
import { assistantStarters, type Starter } from "@/lib/assistant-starters";
import { SaveDraftDialog, type DraftSource } from "./assistant/SaveDraftDialog";
import { toast } from "sonner";
import { useExperience, uploadPrivate, privateBlob } from "@/lib/experience";
import { Hint } from "@/components/ui/hint";
import { readPDFText } from "@/lib/pdf-text";
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
  type Task,
  isLegacyOrganizeCandidate,
} from "@/lib/domain";
import { useOpenDetail } from "@/lib/item-detail";
import { keepSummary, summaryProposalOf } from "@/lib/meeting-summary";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
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
import { NextSteps } from "./assistant/NextSteps";
import { AnswerTasks } from "./assistant/AnswerTasks";
import {
  messageFileContexts,
  restorePendingContexts,
} from "./assistant/conversation-contexts";
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
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { assistantSteps, type AssistantStep } from "@/lib/assistant-steps";
import { AnswerSteps, AssistantThinking } from "./assistant/AssistantThinking";
import { aiWaitKindForMode } from "@/lib/ai-wait";
import { LiveWaveform } from "@/components/recording/LiveWaveform";
import { useDictation } from "@/lib/use-dictation";
import { t } from "@/lib/i18n";
import AIPrompt, { type PromptCommand } from "@/components/kokonut/ai-prompt";
import AIInputSearch from "@/components/kokonut/ai-input-search";
import AIVoice from "@/components/kokonut/ai-voice";
import {
  Mic,
  FolderOpen,
  Globe,
  CalendarDays,
  FileText,
  Pencil,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { COMPOSER_COMMANDS } from "@/components/ai/ComposerCommands";

/** md(992px) 미만에서는 패널이 본문을 덮으므로 처음에는 닫아 둡니다. */
function panelStartsOpen(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia(queryDown("md")).matches;
}

const clockLabel = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** 지금 화면에 맞춰 권할 것이 없을 때 쓰는 예시 질문 */
const GENERIC_STARTERS = [
  t("다음 미팅 전에 끝낼 일이 뭐가 있지?"),
  t("이 피드백은 어떻게 고치면 좋을까?"),
  t("이 문단에서 더 구체적으로 쓸 곳을 찾아 줘"),
];

/** 사이드 창에서는 화면 주소 대신 쓰는 빈 값(바뀌지 않게 하나만 둡니다) */
const EMPTY_PARAMS = new URLSearchParams();

/**
 * 연구 도우미. `variant="panel"`이면 사이드 창(IA v2 06 §2.1) 안에서 같은 대화·입력창을 씁니다.
 * 창에서는 화면 주소의 값(mode·document·tab)과 넘겨받기를 읽지 않고, 제안·실행 내역은 전체 화면으로 보냅니다.
 */
export function ResearchAssistant({
  variant = "page",
  onClose,
}: {
  variant?: "page" | "panel";
  onClose?: () => void;
} = {}) {
  const inPanel = variant === "panel";
  const { researchId = "" } = useParams(),
    w = useExperience(),
    navigate = useNavigate(),
    location = useLocation(),
    { data, user, save, runAI, mode, refresh } = w,
    [pageParams, setParams] = useSearchParams(),
    // 사이드 창은 다른 화면 위에 뜨므로 그 화면의 주소 값을 연구 도우미 설정으로 읽지 않습니다.
    params = inPanel ? EMPTY_PARAMS : pageParams,
    // 예전 주소(?tab=overview)는 패널의 제안 탭으로 엽니다.
    wantsSuggestions = params.get("tab") === "overview";
  // 계정 설정에서 고른 나만의 연구 도우미 이름. 고르지 않았으면 기본 마스코트.
  const agent = readAgentProfile(user.preferences);
  const [panelTab, setPanelTab] = useState<AssistantPanelTab>("suggestions"),
    [panelOpen, setPanelOpen] = useState(
      // 확인할 AI 제안이 있을 때만 처음부터 열어 둡니다. 기록을 고르는 탭은 없어요.
      () =>
        !inPanel &&
        (wantsSuggestions ||
          (panelStartsOpen() &&
            data.aiCandidates.some(
              (c) => c.researchId === researchId && c.status === "pending",
            ))),
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
    [viewingSources, setViewingSources] = useState<{
      contexts: AIContext[];
      index?: number;
    } | null>(null),
    [error, setError] = useState(""),
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
    [webSearch, setWebSearch] = useState(false),
    [calendar, setCalendar] = useState(false),
    // 초안 쓰기(06 §2.3): 묻고 답하기에 정해 둔 지시문을 붙여 보냅니다.
    [drafting, setDrafting] = useState(false),
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
    restoreContextsRef = useRef<AIContext[] | null>(null),
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
      (c) =>
        c.researchId === researchId &&
        c.status === "pending" &&
        // 본문 안 수정 제안은 글 편집 화면에서만 다룹니다(IA v2 05 §3.6).
        c.mode !== "suggest_edits" &&
        (c.mode !== "organize_meeting" ||
          isLegacyOrganizeCandidate(c.candidate)),
    ),
    messages = conversation?.messages ?? [];
  const linkedContexts = conversation?.contexts ?? [];
  const effectiveContexts = contexts.length ? contexts : linkedContexts;
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
  const draftCommand = {
    id: "draft",
    label: t("초안 쓰기"),
    description: t("이 연구의 기록으로 글 초안을 써요"),
    icon: "edit",
  };
  const activeCommand = calendar
    ? {
        id: "calendar",
        label: t("일정 확인"),
        description: t("이 연구의 미팅·할 일·주요 목표 일정을 확인해요"),
        icon: "calendar",
      }
    : drafting
      ? draftCommand
      : findComposerCommand(task);
  const composerCommands = [
    ...COMPOSER_COMMANDS,
    draftCommand,
    {
      id: "web_search",
      label: t("웹 검색"),
      description: t("Google에서 공개 웹 근거를 찾아요"),
      icon: "globe",
    },
    {
      id: "calendar",
      label: t("일정 확인"),
      description: t("이 연구의 미팅·할 일·주요 목표 일정을 확인해요"),
      icon: "calendar",
    },
  ];
  function selectComposerCommand(id?: string) {
    setWebSearch(id === "web_search");
    setCalendar(id === "calendar");
    setDrafting(id === "draft");
    setTask(
      id === "web_search" || id === "calendar" || id === "draft" || !id
        ? "ask_research"
        : (id as AIInput["mode"]),
    );
  }

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
    // 사이드 창은 화면을 옮겨도 남아 있으므로 쓰던 질문이 사라지지 않습니다.
    dirty: !inPanel && !!draft.trim(),
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
  function openPanel(next: AssistantPanelTab) {
    setPanelTab(next);
    setPanelOpen(true);
  }
  async function prepareAttachmentContext(
    context: AIContext,
  ): Promise<AIContext> {
    if (context.kind !== "attachments") return context;
    const stored = data.attachments.find(
      (attachment) => attachment.id === context.id,
    );
    if (
      !stored ||
      !(
        stored.mimeType === "application/pdf" ||
        stored.fileName.toLowerCase().endsWith(".pdf")
      )
    )
      return context;
    if (stored.textExtractionVersion === 2)
      return { ...context, text: stored.text };
    const extracted = await readPDFText(await privateBlob(stored, mode));
    const updated = await save("attachments", {
      ...stored,
      text: extracted.text,
      textExtractionVersion: 2 as const,
    });
    return { ...context, text: updated.text };
  }
  async function addContext(c: AIContext) {
    let extracting = false;
    try {
      if (c.kind === "attachments") {
        extracting = true;
        setUploading(true);
        setError("");
        c = await prepareAttachmentContext(c);
      }
      if (task === "organize_meeting") {
        setContexts([c]);
        return;
      }
      if (contexts.length >= MAX_SOURCES) {
        toast.info(
          t("기록과 파일은 {max}개까지 붙일 수 있어요.", { max: MAX_SOURCES }),
        );
        return;
      }
      setContexts((current) =>
        current.some((item) => item.kind === c.kind && item.id === c.id)
          ? current
          : [...current, c],
      );
    } catch (error) {
      setError(
        t(
          "PDF 전체 본문을 준비하지 못했어요. 파일을 확인하거나 다시 첨부해 주세요.",
        ) +
          " " +
          (error as Error).message,
      );
    } finally {
      if (extracting) setUploading(false);
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
          text = (await readPDFText(file)).text;
        } else text = await file.text();
        if (text.length > 48000)
          throw new Error(
            t("글자 수가 너무 많아요. 4만 8천 자 이하로 나눠서 첨부해 주세요."),
          );
        if (!text.trim())
          throw new Error(
            t(
              "읽을 수 있는 글자가 없어요. 스캔한 파일은 글자를 추출한 뒤 첨부해 주세요.",
            ),
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
            ...(ext === "pdf" ? { textExtractionVersion: 2 as const } : {}),
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
    setQueue((prev) => [
      ...prev,
      {
        id: uid(),
        text,
        mode: task,
        webSearch,
        calendar,
        draft: drafting && !webSearch && !calendar,
        contexts: webSearch || calendar ? [] : [...effectiveContexts],
      },
    ]);
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
      webSearch?: boolean;
      calendar?: boolean;
      draft?: boolean;
      contexts?: AIContext[];
      onWebSource?: (source: { url: string; title: string }) => void;
    },
  ) {
    if (dictation.listening) dictation.stop();
    setVoiceReview(null);
    const useWebSearch = override?.webSearch ?? webSearch;
    const useCalendar = !useWebSearch && (override?.calendar ?? calendar);
    const useDraft =
      !useWebSearch && !useCalendar && (override?.draft ?? drafting);
    const activeMode =
      useWebSearch || useCalendar || useDraft
        ? "ask_research"
        : (override?.mode ?? task);
    const linked =
      (override?.conversation !== undefined
        ? override.conversation
        : conversation
      )?.contexts ?? [];
    let requestContexts =
      useWebSearch || useCalendar
        ? []
        : [
            ...(override?.contexts ??
              (contexts.length ? contexts : useCalendar ? [] : linked)),
          ];
    const requestSelection = resolveAISelection(
      caps.isError ? [] : caps.data?.models,
      {
        model: override?.model ?? selection.model,
        thinking: override?.thinking ?? selection.thinking,
      },
    );
    const question = retryQuestion ?? draft;
    if ((!override && working) || unavailable || !question.trim()) return;
    if (useDraft && question.trim().length > draftRequestMax()) {
      setError(
        t("초안 요청은 {count}자까지 쓸 수 있어요.", {
          count: draftRequestMax().toLocaleString(),
        }),
      );
      return;
    }
    if (!requestSelection.model) {
      setError(t("사용 가능한 모델을 확인한 뒤 다시 보내 주세요."));
      return;
    }
    // 기록을 붙이지 않아도 서버가 이 연구의 기록에서 알맞은 것을 찾아 읽어요.
    if (
      activeMode === "organize_meeting" &&
      requestContexts.length > 0 &&
      (requestContexts.length !== 1 || requestContexts[0]?.kind !== "meetings")
    ) {
      setError(
        t(
          "미팅 정리는 미팅 메모 하나로만 할 수 있어요. 다른 자료는 새 대화에서 사용해 주세요.",
        ),
      );
      return;
    }
    // 자료 요약은 붙인 파일이 없으면 이 연구에 가장 최근에 올린 파일을 읽어요.
    if (
      activeMode === "read_material" &&
      !requestContexts.length &&
      !override?.contexts
    ) {
      const latest = data.attachments
        .filter((a) => a.researchId === researchId && !a.archivedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!latest) {
        setError(t("요약할 파일이 없어요. PDF·TXT·MD 파일을 첨부해 주세요."));
        return;
      }
      requestContexts = [
        { kind: "attachments", id: latest.id, title: latest.title },
      ];
    }
    // Keep the original composer entries for removal/restoration; prepared copies must
    // never mutate the contexts preserved on earlier messages.
    const composerRequestContexts = contexts.filter((context) =>
      requestContexts.includes(context),
    );
    if (
      !useWebSearch &&
      !useCalendar &&
      requestContexts.some((context) => context.kind === "attachments")
    ) {
      setUploading(true);
      setError("");
      try {
        const prepared: AIContext[] = [];
        for (const context of requestContexts)
          prepared.push(await prepareAttachmentContext(context));
        requestContexts = prepared;
      } catch (error) {
        setError(
          t(
            "PDF 전체 본문을 준비하지 못했어요. 파일을 확인하거나 다시 첨부해 주세요.",
          ) +
            " " +
            (error as Error).message,
        );
        return false;
      } finally {
        setUploading(false);
      }
    }
    const text = question.trim();
    if (retryQuestion === undefined || override?.fromComposer) {
      setDraft("");
      lastSentRef.current = text;
      restoreDraftRef.current = text;
    } else {
      restoreDraftRef.current = null;
    }
    restoreContextsRef.current = composerRequestContexts;
    if (requestContexts.length)
      setContexts((current) =>
        current.filter((context) => !composerRequestContexts.includes(context)),
      );
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
    run.steps = useWebSearch
      ? [
          {
            doing: t("웹 검색 응답을 기다리고 있어요"),
            done: t("웹 검색 모드 답변 받음"),
          },
        ]
      : assistantSteps({
          first: run.first,
          researchName: research?.name ?? "",
          hasDirection: !!(
            research?.purpose?.trim() ||
            research?.questions?.some((q) => q.trim())
          ),
          contexts: requestContexts,
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
        contexts: requestContexts,
        visibility: "private" as const,
      };
      const last = c.messages.at(-1);
      c = await save("conversations", {
        ...c,
        contexts: useWebSearch || useCalendar ? c.contexts : requestContexts,
        messages:
          last?.role === "user" &&
          last.text === text &&
          !!last.webSearch === useWebSearch &&
          !!last.calendar === useCalendar &&
          !!last.draft === useDraft &&
          JSON.stringify(last.contexts ?? []) ===
            JSON.stringify(requestContexts)
            ? c.messages
            : [
                ...c.messages,
                {
                  role: "user",
                  text,
                  createdAt: now(),
                  webSearch: useWebSearch,
                  calendar: useCalendar,
                  // '이어서'(06 §2.4)와 다시 답하기가 같은 요청 종류를 쓰도록 남깁니다.
                  mode: activeMode,
                  ...(useDraft ? { draft: true } : {}),
                  contexts: requestContexts,
                },
              ],
      });
      setConversation(c);
      const runStartedAt = Date.now();
      const result = await runAI(
        {
          mode: activeMode,
          researchId,
          question: useDraft ? draftQuestion(text) : text,
          sourceText: "",
          contexts: requestContexts,
          ...requestSelection,
          webSearch: useWebSearch,
          calendar: useCalendar,
          history:
            useWebSearch || useCalendar
              ? []
              : c.messages
                  .slice(-10, -1)
                  .map(({ role, text }) => ({ role, text })),
          conversationId: c.id,
          clientRunId: id,
        },
        controller.signal,
      );
      if (seq !== sequence.current || controller.signal.aborted) return;
      setLastUsedCredits(result.creditsUsed);
      // 제안이 나오면 선택할 수 있게 제안 탭을 엽니다.
      if (result.candidates.length) openPanel("suggestions");
      for (const source of result.webGrounding?.sources ?? [])
        override?.onWebSource?.(source);
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
            webSearch: useWebSearch,
            calendar: useCalendar,
            webGrounding: result.webGrounding,
            contexts: result.contexts ?? requestContexts,
            ...(result.runId ? { runId: result.runId } : {}),
            // 답 아래 [할 일 추가](06 §2.4): 고르기 전까지는 대화에만 남는 제안입니다.
            ...(suggestedTasksOf(result.candidates).length
              ? { suggestedTasks: suggestedTasksOf(result.candidates) }
              : {}),
          },
        ],
      });
      savedConversation = saved;
      setConversation(saved);
      setAnswered({ at: answeredAt, steps: run.steps, elapsedMs });
      restoreDraftRef.current = null;
      restoreContextsRef.current = null;
      succeeded = true;
    } catch (e) {
      if (seq === sequence.current && !controller.signal.aborted) {
        if (restoreContextsRef.current) {
          const sentContexts = restoreContextsRef.current;
          setContexts((current) =>
            restorePendingContexts(current, sentContexts),
          );
          restoreContextsRef.current = null;
        }
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
          webSearch: nextItem.webSearch ?? false,
          calendar: nextItem.calendar ?? false,
          draft: nextItem.draft ?? false,
          contexts: nextItem.contexts ?? [],
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
    if (!skipRestoreOnCancel.current && restoreContextsRef.current) {
      const sentContexts = restoreContextsRef.current;
      setContexts((current) => restorePendingContexts(current, sentContexts));
    }
    restoreContextsRef.current = null;
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
    void send(target.text, {
      mode: target.mode,
      webSearch: target.webSearch ?? false,
      calendar: target.calendar ?? false,
      contexts: target.contexts ?? [],
    });
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
    setWebSearch(false);
    setCalendar(false);
    setDrafting(false);
    setContexts([]);
    setDraft("");
    setQueue([]);
    setError("");
  }
  const unavailable = mode === "preview" || aiNotConfigured;
  // 사이드 창의 연구 도우미에서 넘겨받은 대화·질문(lib/assistant-handoff.ts). 한 번만 씁니다.
  const handoff = useRef(inPanel ? null : readHandoff(location.state));
  // 사이드 창: '지금 보는 기록'을 근거 칩으로 저절로 놓습니다(IA v2 06 §2.2).
  // 화면을 옮기면 앞 화면의 칩을 새 대상으로 바꾸고, ×로 뺀 대상은 이 창을 연 동안 다시 놓지 않습니다.
  const viewing = inPanel
    ? viewingContext(location.pathname, location.search, data, researchId)
    : null;
  const viewingKeyNow = viewing ? contextKey(viewing) : "";
  const placedViewing = useRef("");
  const removedViewing = useRef(new Set<string>());
  useEffect(() => {
    if (!inPanel) return;
    const previous = placedViewing.current;
    const next =
      viewing && !removedViewing.current.has(viewingKeyNow) ? viewing : null;
    placedViewing.current = next ? viewingKeyNow : "";
    setContexts((current) => {
      const rest = current.filter((c) => contextKey(c) !== previous);
      if (!next) return rest.length === current.length ? current : rest;
      return rest.some((c) => contextKey(c) === viewingKeyNow)
        ? rest
        : [next, ...rest];
    });
  }, [inPanel, viewingKeyNow]);
  // 빈 대화의 첫 화면에서 권할 것(06 §2.6). 사이드 창이면 그 아래 화면 기준입니다.
  const starters = assistantStarters(location.pathname, data, researchId);
  // 답 아래 [글로 저장]·[이 글에 넣기](06 §2.4)
  const [draftSource, setDraftSource] = useState<DraftSource | null>(null);
  // 답 아래 [할 일 추가](06 §2.4): 펼친 답(createdAt)과 지금 추가하는 줄
  const [tasksOpenAt, setTasksOpenAt] = useState<string | null>(null);
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const openDetail = useOpenDetail();
  const [confirmDialog, confirm] = useConfirm();
  const [summaryBusy, setSummaryBusy] = useState(false);
  /** 답 아래 [요약 저장](06 §2.4): 기록 화면의 [요약 저장](04 §5.4 ①)과 같은 동작입니다. */
  async function saveSummary(
    found: NonNullable<ReturnType<typeof summaryProposalOf>>,
  ) {
    const { meeting, proposal } = found;
    if (summaryBusy) return;
    if (
      (meeting.summary || meeting.visibility === "shared") &&
      !(await confirm({
        title: meeting.summary
          ? t("이 기록의 요약을 바꿀까요?")
          : t("공동연구자도 이 요약을 볼 수 있어요."),
        description: [
          meeting.summary ? t("지금 저장된 요약 대신 이 요약을 저장해요.") : "",
          meeting.visibility === "shared"
            ? meeting.summary
              ? t("공동연구자도 이 요약을 볼 수 있어요.") +
                " " +
                t("전사문에만 있던 내용이 담길 수 있어요.")
              : t("전사문에만 있던 내용이 담길 수 있어요.")
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        confirmLabel: t("저장"),
      }))
    )
      return;
    setSummaryBusy(true);
    try {
      await keepSummary(save, meeting, proposal);
      toast.success(t("요약을 저장했어요."), {
        action: {
          label: t("열기"),
          onClick: () => navigate(`/r/${researchId}/meetings/${meeting.id}`),
        },
      });
    } catch {
      toast.error(t("저장하지 못했어요. 다시 선택해 주세요."));
    } finally {
      setSummaryBusy(false);
    }
  }
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  /** 고른 할 일 제안 한 줄을 할 일로 저장하고, 답에 추가했다고 남깁니다. */
  async function addSuggestedTask(answeredAt: string, title: string) {
    const start = conversationRef.current;
    if (!start || taskBusy) return;
    const index = start.messages.findIndex(
      (m) => m.role === "assistant" && m.createdAt === answeredAt,
    );
    if (index < 0) return;
    setTaskBusy(title);
    try {
      const task = await save("tasks", {
        ...recordBase(researchId),
        origin: "ai",
        title,
        description: "",
        status: "todo",
        priority: "normal",
        dueDate: null,
        visibility: "private",
        ...taskLink(lastAsked(start.messages, index)?.contexts ?? []),
      } as Task);
      const latest =
        conversationRef.current?.id === start.id
          ? conversationRef.current
          : start;
      const saved = await save("conversations", {
        ...latest,
        messages: latest.messages.map((m) =>
          m.role === "assistant" && m.createdAt === answeredAt
            ? {
                ...m,
                addedTasks: [
                  ...(m.addedTasks ?? []),
                  { title, taskId: task.id },
                ],
              }
            : m,
        ),
      });
      if (conversationRef.current?.id === saved.id) setConversation(saved);
      toast.success(t("할 일로 추가했어요."));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTaskBusy(null);
    }
  }
  const insertTarget =
    viewing?.kind === "documents" && canInsertInto(viewing.id) ? viewing : null;
  /** 사이드 창 → 전체 화면: 지금 대화와 근거 칩을 넘깁니다. */
  function expand() {
    onClose?.();
    navigate(`/r/${researchId}/assistant`, {
      state: handoffState({
        ...(conversation ? { conversationId: conversation.id } : {}),
        ...(contexts.length ? { contexts } : {}),
      }),
    });
  }
  // 사이드 창의 '지금 보는 기록' 칩은 모델 목록을 기다리지 않고 바로 이 화면의 근거 칩으로 놓습니다(IA v2 06 §2.2).
  useEffect(() => {
    const chips = handoff.current?.contexts;
    if (chips?.length) setContexts(chips);
  }, []);
  useEffect(() => {
    const received = handoff.current;
    if (!received || caps.isPending) return;
    handoff.current = null;
    // 새로고침·뒤로 가기로 같은 질문을 다시 보내지 않게 넘겨받은 값을 지웁니다.
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true },
    );
    const picked = received.conversationId
      ? conversations.find((c) => c.id === received.conversationId)
      : undefined;
    if (picked) {
      setConversation(picked);
      setCalendar(picked.messages.at(-1)?.calendar ?? false);
      setWebSearch(picked.messages.at(-1)?.webSearch ?? false);
      setDrafting(lastAsked(picked.messages)?.draft ?? false);
    }
    if (!received.ask) return;
    // 바로 보낼 수 없으면(미리보기·AI 미설정·모델 없음) 입력창에 넣어 두기만 합니다.
    if (unavailable || !selection.model) setDraft(received.ask);
    else
      void send(received.ask, {
        fromComposer: true,
        ...(received.contexts?.length ? { contexts: received.contexts } : {}),
      });
    // 넘겨받은 값은 처음 한 번만 씁니다(모델 목록을 다 받은 뒤).
  }, [caps.isPending]);
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

  return (
    <div className="assistant-experience" data-variant={variant}>
      {confirmDialog}
      {inPanel ? (
        <header className="assistant-panel-head">
          <h2>{t("연구 도우미")}</h2>
          <span className="assistant-panel-actions">
            {conversations.length > 0 && (
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
                        setContexts([]);
                        setCalendar(c.messages.at(-1)?.calendar ?? false);
                        setWebSearch(c.messages.at(-1)?.webSearch ?? false);
                        setDrafting(lastAsked(c.messages)?.draft ?? false);
                        setError("");
                      }}
                    >
                      {c.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("새 대화")}
              title={t("새 대화")}
              disabled={running}
              onClick={startNew}
            >
              <Icon name="plus" size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("전체 화면으로 열기")}
              title={t("전체 화면으로 열기")}
              onClick={expand}
            >
              <Icon name="arrow-up-right" size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("연구 도우미 창 닫기")}
              onClick={onClose}
            >
              <Icon name="close" size={18} />
            </Button>
          </span>
          {pending.length > 0 && (
            <button
              type="button"
              className="assistant-panel-pending"
              onClick={() => {
                onClose?.();
                navigate(`/r/${researchId}/assistant?tab=overview`);
              }}
            >
              {t("확인할 AI 제안 {count}개", { count: pending.length })}
              <Icon name="chevron-right" size={14} />
            </button>
          )}
        </header>
      ) : (
        <PageHeader
          title={t("연구 도우미")}
          description={t(
            "이 연구의 기록을 모두 읽고 답하거나 수정 방법을 제안해요.",
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
                        setContexts([]);
                        setCalendar(c.messages.at(-1)?.calendar ?? false);
                        setWebSearch(c.messages.at(-1)?.webSearch ?? false);
                        setDrafting(lastAsked(c.messages)?.draft ?? false);
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
      )}
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
          {running && !messages.length ? null : !messages.length ? (
            <div className="assistant-welcome">
              <AssistantMascot state="ready" size={64} eager />
              <h2>{t("아직 대화가 없어요")}</h2>
              {!unavailable && (
                <div className="assistant-prompts">
                  {/* 지금 화면과 기록에 맞춰 해 볼 만한 것(06 §2.6). 없으면 늘 쓰는 예시 질문. */}
                  {(starters.length
                    ? starters
                    : GENERIC_STARTERS.map((prompt) => ({
                        id: prompt,
                        label: prompt,
                        prompt,
                      }))
                  ).map((starter: Starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      onClick={() => {
                        if (starter.mode) selectComposerCommand(starter.mode);
                        setDraft(starter.prompt);
                        composerRef.current?.focus();
                      }}
                    >
                      {starter.label}
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
                    {(m.webSearch || m.calendar || m.draft) && (
                      <small className="assistant-question-mode">
                        {m.webSearch
                          ? t("웹 검색")
                          : m.calendar
                            ? t("일정 확인")
                            : t("초안 쓰기")}
                      </small>
                    )}
                    {messageFileContexts(
                      messages,
                      i,
                      conversation?.contexts ?? [],
                    ).length > 0 && (
                      <MessageFileChips
                        files={messageFileContexts(
                          messages,
                          i,
                          conversation?.contexts ?? [],
                        )}
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
                      webGrounding={m.webGrounding}
                      onOpenSources={(index) =>
                        setViewingSources({
                          contexts: m.contexts ?? conversation?.contexts ?? [],
                          index,
                        })
                      }
                    />
                    <AnswerActions
                      text={m.text}
                      question={questionBefore(messages, i)}
                      disabled={working || unavailable || uploading}
                      onSaveDraft={() =>
                        setDraftSource({
                          text: m.text,
                          question: questionBefore(messages, i),
                          contexts: m.contexts ?? conversation?.contexts ?? [],
                        })
                      }
                      onInsert={
                        insertTarget
                          ? () => {
                              if (insertIntoEditor(insertTarget.id, m.text))
                                toast.success(
                                  t(
                                    "'{title}'에 넣었어요. 되돌리려면 글에서 ⌘/Ctrl+Z를 눌러요.",
                                    {
                                      title: insertTarget.title,
                                    },
                                  ),
                                );
                            }
                          : undefined
                      }
                      onSaveSummary={(() => {
                        const found = summaryProposalOf(
                          m.runId,
                          data.aiCandidates,
                          data.meetings,
                        );
                        return found?.proposal.status === "pending"
                          ? () => void saveSummary(found)
                          : undefined;
                      })()}
                      summaryBusy={summaryBusy}
                      tasks={
                        m.suggestedTasks?.length
                          ? {
                              count: m.suggestedTasks.length,
                              open: tasksOpenAt === m.createdAt,
                              controls: `answer-tasks-${i}`,
                              onToggle: () =>
                                setTasksOpenAt((at) =>
                                  at === m.createdAt ? null : m.createdAt,
                                ),
                            }
                          : undefined
                      }
                      onRetry={(question) => {
                        const asked = lastAsked(messages, i);
                        void send(question, {
                          webSearch: m.webSearch ?? !!m.webGrounding,
                          calendar: m.calendar ?? false,
                          ...(asked?.mode ? { mode: asked.mode } : {}),
                          draft: asked?.draft ?? false,
                          contexts: asked?.contexts ?? [],
                        });
                      }}
                    />
                    {tasksOpenAt === m.createdAt &&
                      !!m.suggestedTasks?.length && (
                        <AnswerTasks
                          id={`answer-tasks-${i}`}
                          suggestions={m.suggestedTasks}
                          added={m.addedTasks ?? []}
                          busy={taskBusy}
                          disabled={working || unavailable}
                          onAdd={(title) =>
                            void addSuggestedTask(m.createdAt, title)
                          }
                          onOpen={(taskId) =>
                            openDetail({ kind: "task", id: taskId })
                          }
                        />
                      )}
                    {i === messages.length - 1 && !working && (
                      <NextSteps
                        steps={nextSteps(lastAsked(messages, i), {
                          hasTasks: !!m.suggestedTasks?.length,
                          canSuggestEdits:
                            insertTarget !== null &&
                            canSuggestIn(insertTarget.id) &&
                            (m.contexts ?? []).some(
                              (c) =>
                                c.kind === "documents" &&
                                c.id === insertTarget.id,
                            ),
                        })}
                        disabled={unavailable || uploading}
                        onPick={(step) => {
                          if (step.kind === "save")
                            setDraftSource({
                              text: m.text,
                              question: questionBefore(messages, i),
                              contexts:
                                m.contexts ?? conversation?.contexts ?? [],
                            });
                          else if (step.kind === "tasks")
                            setTasksOpenAt(m.createdAt);
                          else if (step.kind === "suggest_edits") {
                            if (insertTarget) openSuggestEdits(insertTarget.id);
                          } else {
                            selectComposerCommand(
                              step.draft ? "draft" : step.mode,
                            );
                            setDraft(step.prompt);
                            composerRef.current?.focus();
                          }
                        }}
                      />
                    )}
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
                  "이 질문에는 아직 답변이 없어요. 질문을 확인한 뒤 다시 보낼 수 있어요.",
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
            {webSearch ? (
              <AIInputSearch
                allowAttachments={false}
                className="max-w-none py-0"
                value={draft}
                onValueChange={setDraft}
                inputRef={composerRef}
                models={models
                  .filter(isAIModelAvailable)
                  .map(researchModelLabel)}
                selectedModel={
                  models.find((model) => model.id === selection.model)
                    ? researchModelLabel(
                        models.find((model) => model.id === selection.model)!,
                      )
                    : ""
                }
                onModelChange={(label) => {
                  const picked = models.find(
                    (model) => researchModelLabel(model) === label,
                  );
                  if (picked) setModel(picked.id);
                }}
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
                tools={composerCommands.map((command) => ({
                  id: command.id,
                  label: command.label,
                  icon:
                    command.id === "web_search"
                      ? Globe
                      : command.id === "calendar" ||
                          command.id === "organize_meeting"
                        ? CalendarDays
                        : command.id === "read_material"
                          ? FileText
                          : command.id === "review_writing"
                            ? Pencil
                            : command.id === "plan_research"
                              ? ListTodo
                              : Sparkles,
                  activity:
                    command.id === "web_search"
                      ? t("Google에서 웹 근거를 확인하고 있어요")
                      : command.description,
                  hint:
                    command.id === "web_search"
                      ? t("질문만 웹 검색에 사용해요")
                      : command.description,
                  placeholder:
                    command.id === "web_search"
                      ? t("웹에서 확인할 내용을 적어 주세요")
                      : command.description,
                  readsSources: command.id === "web_search",
                  color: "var(--brand)",
                }))}
                selectedTool="web_search"
                onToolChange={(id) => selectComposerCommand(id ?? undefined)}
                disabled={unavailable || uploading}
                busy={working}
                placeholder={t("웹에서 확인할 내용을 적어 주세요")}
                onStop={() => {
                  if (abort.current && !abort.current.signal.aborted)
                    void cancel();
                }}
                onQueue={(text) =>
                  setQueue((prev) => [
                    ...prev,
                    {
                      id: uid(),
                      text: text.trim(),
                      mode: "ask_research",
                      webSearch: true,
                      calendar: false,
                      contexts: [],
                    },
                  ])
                }
                onSearch={async (query, options) => {
                  const cancelSearch = () => {
                    if (abort.current && !abort.current.signal.aborted)
                      void cancel(true);
                  };
                  options.signal.addEventListener("abort", cancelSearch, {
                    once: true,
                  });
                  try {
                    const picked = models.find(
                      (model) => researchModelLabel(model) === options.model,
                    );
                    const ok = await send(query, {
                      mode: "ask_research",
                      model: picked?.id,
                      thinking: selection.thinking,
                      webSearch: true,
                      fromComposer: true,
                      onWebSource: (source) => {
                        try {
                          const url = new URL(source.url);
                          if (["https:", "http:"].includes(url.protocol))
                            options.onSource({
                              key: source.url,
                              domain: url.hostname,
                              title: source.title,
                            });
                        } catch {
                          /* Invalid sources are not displayed. */
                        }
                      },
                    });
                    if (!ok) {
                      setDraft((current) => current || query);
                      throw new Error(
                        t("웹 검색을 완료하지 못했어요. 질문은 그대로 있어요."),
                      );
                    }
                  } finally {
                    options.signal.removeEventListener("abort", cancelSearch);
                  }
                }}
              />
            ) : (
              <>
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
                    <>
                      {!unavailable && (
                        <button
                          type="button"
                          className="composer-chip"
                          disabled={working || uploading}
                          onClick={() => {
                            setTask("ask_research");
                            setWebSearch(true);
                          }}
                          aria-label={t("웹 검색 켜기")}
                        >
                          <Globe className="size-4" />
                          {t("웹 검색")}
                        </button>
                      )}
                      {dictation.supported && !unavailable ? (
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
                      ) : undefined}
                    </>
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
                    selectComposerCommand(command?.id)
                  }
                  commands={composerCommands.map((command) => ({
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
                        usageHref="?settings=usage"
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
                    !calendar &&
                    (contexts.length > 0 || uploading) && (
                      <ComposerAttachmentCards
                        contexts={contexts}
                        data={data}
                        uploading={uploading}
                        uploadProgress={uploadProgress}
                        disabled={working || uploading}
                        onRemove={(index) => {
                          // 사이드 창에서 '지금 보는 기록'을 ×로 빼면 이 창을 연 동안 다시 놓지 않습니다.
                          const removed = contexts[index];
                          if (
                            removed &&
                            contextKey(removed) === placedViewing.current
                          )
                            removedViewing.current.add(placedViewing.current);
                          setContexts((items) =>
                            items.filter((_, i) => i !== index),
                          );
                        }}
                      />
                    )
                  }
                  onAttach={(files) => {
                    if (!working && !unavailable)
                      void (async () => {
                        for (const file of Array.from(files))
                          await attach(file);
                      })();
                  }}
                  onStop={() => void cancel()}
                  onQueue={(text, command) =>
                    setQueue((prev) => [
                      ...prev,
                      {
                        id: uid(),
                        text: text.trim(),
                        mode: (command?.id === "calendar"
                          ? "ask_research"
                          : (command?.id ?? task)) as AIInput["mode"],
                        webSearch: false,
                        calendar: command?.id === "calendar" || calendar,
                        contexts:
                          command?.id === "calendar" || calendar
                            ? []
                            : [...effectiveContexts],
                      },
                    ])
                  }
                  onSubmit={async (text, label, options) => {
                    const picked = models.find(
                      (model) => researchModelLabel(model) === label,
                    );
                    const success = await send(text, {
                      mode: (options.command?.id === "calendar"
                        ? "ask_research"
                        : (options.command?.id ??
                          "ask_research")) as AIInput["mode"],
                      model: picked?.id,
                      thinking: options.effort ?? selection.thinking,
                      fromComposer: true,
                      webSearch: false,
                      calendar: options.command?.id === "calendar" || calendar,
                    });
                    if (!success) setDraft((current) => current || text);
                  }}
                />
              </>
            )}
          </fieldset>
          {!webSearch &&
            !calendar &&
            !contexts.length &&
            linkedContexts.length > 0 && (
              <div className="assistant-linked-sources">
                <span>
                  {t("이 대화에서 참고하는 기록 {count}개", {
                    count: linkedContexts.length,
                  })}
                </span>
                <button
                  type="button"
                  disabled={working || uploading}
                  onClick={async () => {
                    if (!conversation) return;
                    try {
                      setConversation(
                        await save("conversations", {
                          ...conversation,
                          contexts: [],
                        }),
                      );
                    } catch (error) {
                      setError((error as Error).message);
                    }
                  }}
                >
                  {t("기록 연결 해제")}
                </button>
              </div>
            )}
          {webSearch && (
            <p className="assistant-web-scope">
              {t(
                "웹 검색에는 질문만 보내요. 선택한 연구 기록과 이전 대화는 보내지 않아요.",
              )}
            </p>
          )}
          {calendar && (
            <p className="assistant-web-scope">
              {t(
                "일정 확인에는 이 연구의 일정만 사용해요. 선택한 파일은 보내지 않아요.",
              )}
            </p>
          )}
          {webSearch && (
            <p className="assistant-web-scope">
              {t("웹 검색은 실제 검색어마다 14크레딧이 추가돼요.")}
            </p>
          )}
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
      {!inPanel && (
        <MarginPanel
          label={t("제안과 실행 내역")}
          open={panelOpen}
          onOpen={() => setPanelOpen(true)}
          onClose={() => setPanelOpen(false)}
        >
          <AssistantPanel
            tab={panelTab}
            onTab={setPanelTab}
            onClose={() => setPanelOpen(false)}
            pending={pending}
            onAdopt={adopt}
            onDismiss={(c) => void dismiss(c)}
            runs={runs}
            onCancelRun={(id) => void w.cancelRun(id)}
          />
        </MarginPanel>
      )}
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
      <SaveDraftDialog
        researchId={researchId}
        source={draftSource}
        onClose={() => setDraftSource(null)}
      />
      <Dialog
        open={!!viewingSources}
        onOpenChange={(open) => {
          if (!open) setViewingSources(null);
        }}
      >
        <DialogContent className="rms-dialog assistant-source-snapshot">
          <DialogHeader>
            <DialogTitle>{t("이 답변에 보낸 근거")}</DialogTitle>
            <DialogDescription>
              {t(
                "답변을 만들 때 사용한 기록이에요. 다음 질문의 첨부는 바뀌지 않아요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="assistant-source-snapshot-list">
            {viewingSources?.contexts.map((context, index) => (
              <section
                key={`${context.kind}:${context.id}:${index}`}
                data-focused={viewingSources.index === index}
              >
                <h3>
                  {context.title}
                  {context.page
                    ? ` · ${t("{page}쪽", { page: context.page })}`
                    : ""}
                </h3>
                <p>
                  {context.text?.trim() ||
                    t("이 근거의 본문은 대화에 보존되지 않았어요.")}
                </p>
              </section>
            ))}
          </DialogBody>
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
          <DialogBody>
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
            {candidateReason.node}
          </DialogBody>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
