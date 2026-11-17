import { DialogBody } from "@/components/ui/dialog";
import { RecordList } from "@/components/meetings/RecordList";
import { RecordListToggle } from "@/components/meetings/RecordListToggle";
import { RecordHeader } from "@/components/meetings/RecordHeader";
import { PrepareSide, RecordSide } from "@/components/meetings/RecordSide";
import { WrittenFeedbackDialog } from "@/components/meetings/WrittenFeedbackDialog";
import { recordItems, recordMode } from "@/lib/record-view";
import { readImportFile } from "@/lib/import-file";
import {
  memoPieces,
  sourceAnchors,
  type MemoPiece,
} from "@/lib/source-anchors";
import { relocateMarks } from "@/lib/memo-marks";
import {
  MARK_LIMIT,
  addMark,
  overlapsMark,
  removeMarks,
  validMarks,
} from "@/lib/recording-marks";
import { useOptionalRecorder } from "@/components/recording/RecordingProvider";
import { t } from "@/lib/i18n";
import { isImeComposing } from "@/lib/ime";
import {
  RecordingPanel,
  type TranscriptPick,
} from "@/components/RecordingPanel";
import { SortableList } from "@/components/meeting/SortableList";
import {
  SelectionToolbar,
  useTextareaSelection,
} from "@/components/recording/SelectionPopover";
import { orderedBy, reorderIds } from "@/lib/meeting-order";
import { SelectField } from "@/components/experience";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  StatusBadge,
  InlineEmpty,
  useDisabledReason,
} from "@/components/common";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { friendlyError } from "@/lib/supabase";
import {
  formatDate,
  meetingLabels,
  originLabels,
  recordBase,
  taskLabels,
  type AIInput,
  type AICandidate,
  type BaseRecord,
  type Decision,
  type Meeting,
  type Question,
  type Task,
} from "@/lib/domain";
import { AIWorkbench } from "./AIWorkbench";
import { MarginPanel, PanelFrame } from "@/components/margin-panel/MarginPanel";
import { REASON_MAX, decisionLog, replaceableDecisions } from "@/lib/decisions";
import { isAISourceStale } from "./ai-source";
import { QuickPdfUpload } from "./QuickPdfUpload";
import { hasMemoConflict, restoreMemoDraft } from "./memo-draft";
import {
  BackLink,
  ErrorNotice,
  FormDialog,
  LabeledInput,
  SaveActions,
  useSaving,
  useBackState,
} from "./shared";
import { Checkbox } from "@montage-ui/core";
import { Tabs } from "@/components/ui/tabs";
import { entryFromSelection } from "@/lib/memo-selection";
import type { AudioSource } from "@/lib/domain";

export function MeetingsPage() {
  const { researchId = "", meetingId } = useParams();
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const createBase = useRef<BaseRecord | null>(null);
  const [pageParams, setPageParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const form = useSaving();
  const [writing, setWriting] = useState(false);
  const [imported, setImported] = useState<{
    text: string;
    fileName: string;
  } | null>(null);
  /** 파일에서 가져오기(04 §7.3): 읽으면 서면 피드백 창을 채워 엽니다. */
  async function importFile(file: File) {
    const result = await readImportFile(file);
    if (result.ok) {
      setImported({ text: result.text, fileName: result.fileName });
      setWriting(true);
      return;
    }
    if (result.reason === "pdf")
      toast.info(
        t("PDF는 글·자료에 올린 뒤 연구 도우미에게 읽게 할 수 있어요."),
        {
          action: {
            label: t("자료로 올리기"),
            onClick: () => navigate(`/r/${researchId}/docs?kind=material`),
          },
        },
      );
    else
      toast.error(
        {
          type: t("TXT, MD 파일만 가져올 수 있어요."),
          unreadable: t(
            "파일을 읽지 못했어요. UTF-8로 저장한 TXT·MD 파일인지 확인해 주세요.",
          ),
          too_long: t("파일이 50,000자를 넘어요. 나눠서 넣어 주세요."),
        }[result.reason],
      );
  }
  // 서면 피드백 붙여넣기(04 §7.2): `?new=written`, 홈의 `?new=1&intent=written`
  useEffect(() => {
    const written =
      pageParams.get("new") === "written" ||
      (pageParams.get("new") === "1" && pageParams.get("intent") === "written");
    if (!written) return;
    setImported(null);
    setWriting(true);
    const nextParams = new URLSearchParams(pageParams);
    nextParams.delete("new");
    nextParams.delete("intent");
    setPageParams(nextParams, { replace: true });
  }, [pageParams]);
  useEffect(() => {
    if (meetingId || pageParams.get("new") !== "1") return;
    if (pageParams.get("intent") === "written") return;
    openCreate();
    if (pageParams.get("date")) setDate(pageParams.get("date")!);
    const nextParams = new URLSearchParams(pageParams);
    nextParams.delete("new");
    setPageParams(nextParams, { replace: true });
  }, [meetingId, researchId, pageParams]);
  const current = meetingId
    ? data.meetings.find(
        (item) => item.id === meetingId && item.researchId === researchId,
      )
    : undefined;
  function openCreate() {
    createBase.current = recordBase(researchId);
    setTitle("");
    setDate("");
    setTime("");
    form.setError(null);
    setCreating(true);
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      form.setError(t("미팅 이름을 입력해 주세요."));
      return;
    }
    await form.perform(async () => {
      createBase.current ??= recordBase(researchId);
      const meeting = await save("meetings", {
        ...createBase.current,
        title: title.trim(),
        date: date || null,
        time: date && time ? time : null,
        status: "preparing",
        goal: "",
        memo: "",
        memoRevision: 1,
        visibility: "private",
        taskIds: [],
        versionIds: [],
        questionIds: [],
      });
      setCreating(false);
      navigate(
        `/r/${researchId}/meetings/${meeting.id}?tab=${pageParams.get("intent") === "record" ? "record#meeting-recording" : "prepare"}`,
      );
      toast.success(t("미팅을 만들었어요"));
    });
  }
  return (
    <div
      className="meetings-frame"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        const file = event.dataTransfer.files[0];
        if (!file) return;
        event.preventDefault();
        void importFile(file);
      }}
    >
      <WrittenFeedbackDialog
        researchId={researchId}
        open={writing}
        onOpenChange={setWriting}
        imported={imported}
      />
      <div
        className="meetings-layout"
        data-has-record={meetingId ? "" : undefined}
      >
        <RecordList onImport={(file) => void importFile(file)} />
        <div className="meetings-record">
          {meetingId && <RecordListToggle />}
          {meetingId ? (
            current ? (
              <MeetingDetail key={current.id} meeting={current} />
            ) : (
              <>
                <BackLink to={`/r/${researchId}/meetings`}>
                  {t("미팅 목록")}
                </BackLink>
                <EmptyState
                  title={t("미팅을 열 수 없어요")}
                  description={t(
                    "이 연구에서 미팅을 찾을 수 없어요. 미팅 목록에서 다시 선택해 주세요.",
                  )}
                />
              </>
            )
          ) : (
            <p className="meetings-placeholder">
              {t("왼쪽 목록에서 기록을 고르거나 새 기록을 추가해 주세요.")}
            </p>
          )}
        </div>
      </div>
      <FormDialog
        busy={form.saving}
        open={creating}
        onOpenChange={setCreating}
        title={
          pageParams.get("intent") === "record"
            ? t("기록할 미팅 만들기")
            : t("미팅 만들기")
        }
        description={
          pageParams.get("intent") === "record"
            ? t(
                "미팅을 만들면 녹음·전사와 메모를 하는 기록 탭으로 이동해요. 날짜는 나중에 정해도 돼요.",
              )
            : t("날짜는 나중에 정해도 돼요.")
        }
      >
        <form onSubmit={create}>
          <DialogBody>
            <LabeledInput
              label={t("미팅 이름")}
              required
              value={title}
              onChange={setTitle}
              placeholder={t("예: 제6차 논문 지도")}
            />
            <div className="form-grid">
              <LabeledInput
                label={t("날짜")}
                type="date"
                value={date}
                onChange={setDate}
              />
              <LabeledInput
                label={t("시각")}
                type="time"
                value={time}
                onChange={setTime}
                disabled={!date}
              />
            </div>
            <ErrorNotice error={form.error} />
          </DialogBody>
          <SaveActions
            saving={form.saving}
            onCancel={() => setCreating(false)}
            label={t("미팅 만들기")}
          />
        </form>
      </FormDialog>
    </div>
  );
}

function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const back = useBackState();
  const navigate = useNavigate();
  const { data, save, remove, savePreparation, saveResearch, refresh, mode } =
    useWorkspace();
  const [params, setParams] = useSearchParams();
  const researchId = meeting.researchId;
  const research = data.researches.find((item) => item.id === researchId);
  // 기록 화면의 모드(IA v2 08 §4.3). 주소의 mode(예전 tab=prepare|record)가 있으면 그쪽을 먼저 봅니다.
  const recorder = useOptionalRecorder();
  const recordingHere =
    recorder?.session?.meetingId === meeting.id &&
    recorder.state !== "idle" &&
    recorder.state !== "review";
  const urlMode =
    params.get("mode") ??
    (params.get("tab") === "prepare" || params.get("tab") === "record"
      ? params.get("tab")
      : null);
  const viewMode = recordMode(meeting, recordingHere, urlMode);
  const written = meeting.recordType === "written";
  const tab =
    params.get("tab") === "questions"
      ? "questions"
      : viewMode === "prepare"
        ? "prepare"
        : "record";
  const [editingMeta, setEditingMeta] = useState(false);
  // 목록 줄 메뉴의 '기록 정보 편집'(04 §2.2)은 ?edit=info로 와서 정보 창을 엽니다.
  useEffect(() => {
    if (params.get("edit") !== "info") return;
    setEditingMeta(true);
    const rest = new URLSearchParams(params);
    rest.delete("edit");
    setParams(rest, { replace: true });
  }, [params, setParams]);
  const [meta, setMeta] = useState({
    title: meeting.title,
    date: meeting.date ?? "",
    time: meeting.time ?? "",
    status: meeting.status,
  });
  const metaForm = useSaving();
  const [preparing, setPreparing] = useState(false);
  const [goal, setGoal] = useState(meeting.goal);
  const [taskIds, setTaskIds] = useState(meeting.taskIds);
  const [versionIds, setVersionIds] = useState(meeting.versionIds);
  const [questionIds, setQuestionIds] = useState(meeting.questionIds);
  const [draftQuestions, setDraftQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [draftTasks, setDraftTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const prepForm = useSaving();
  const draftKey = `rms-meeting-draft-${meeting.id}`;
  const [restoredDraft] = useState(() => {
    try {
      return restoreMemoDraft(sessionStorage.getItem(draftKey));
    } catch {
      return null;
    }
  });
  const [memo, setMemo] = useState(restoredDraft?.text ?? meeting.memo);
  const [memoState, setMemoState] = useState<
    "saved" | "dirty" | "saving" | "error"
  >(memo === meeting.memo ? "saved" : "dirty");
  // 메모를 고친 적이 없으면 '저장됨'을 띄우지 않습니다. 탭만 바꿔도 저장된 것처럼 보였어요.
  const [memoTouched, setMemoTouched] = useState(memo !== meeting.memo);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [memoConflict, setMemoConflict] = useState(false);
  const [memoTick, setMemoTick] = useState(0);
  const memoAIReason = useDisabledReason(
    !memo.trim() && t("메모를 적으면 AI로 정리할 수 있어요."),
  );
  const latest = useRef(meeting);
  latest.current = meeting;
  const metaBase = useRef(meeting);
  const prepBase = useRef(meeting);
  const draftMemo = useRef(memo);
  draftMemo.current = memo;
  const memoPending = useRef(false);
  const composingMemo = useRef(false);
  // 메모에서 고른 문장으로 피드백·결정·질문을 채우려고 메모 칸을 기억합니다.
  const memoField = useRef<HTMLTextAreaElement>(null);
  const memoHost = useRef<HTMLDivElement>(null);
  const memoBackdrop = useRef<HTMLDivElement>(null);
  const memoOverlay = useRef<HTMLDivElement>(null);
  const [pointed, setPointed] = useState<string | null>(null);
  // 항목이 딸리지 않은 형광펜을 누르면 그 자리에 [형광펜 지우기](04 §5.3)
  const [eraseAt, setEraseAt] = useState<{
    x: number;
    y: number;
    start: number;
    end: number;
  } | null>(null);
  const sourceItems = recordItems(meeting, data);
  const anchors = sourceAnchors(memo, meeting.memoRevision, [
    ...sourceItems.feedback.map((item) => ({
      kind: "feedback" as const,
      item,
    })),
    ...sourceItems.decisions.map((item) => ({
      kind: "decision" as const,
      item,
    })),
    ...sourceItems.questions.map((item) => ({
      kind: "question" as const,
      item,
    })),
    ...sourceItems.tasks.map((item) => ({ kind: "task" as const, item })),
  ]);
  const anchorNumbers = new Map(
    anchors.map((anchor) => [anchor.id, anchor.number]),
  );
  function openAnchor(kind: string, id: string) {
    const next = new URLSearchParams(window.location.search);
    next.set("detail", `${kind}:${id}`);
    navigate(
      { search: `?${next.toString()}` },
      { state: { layer: "detail", depth: 1 } },
    );
    setPointed(id);
  }
  const memoSelection = useTextareaSelection(memoField, memoHost);
  const savedMemo = useRef<string | null>(
    restoredDraft?.text === meeting.memo
      ? meeting.memo
      : restoredDraft
        ? restoredDraft.baseMemo
        : meeting.memo,
  );
  const savedRevision = useRef<number | null>(
    restoredDraft?.text === meeting.memo
      ? meeting.memoRevision
      : restoredDraft
        ? restoredDraft.baseRevision
        : meeting.memoRevision,
  );
  const entryBase = useRef<BaseRecord | null>(null);
  const [aiInput, setAiInput] = useState<AIInput | null>(null);
  // 여백 패널: 준비(목표·질문·자료)와 도우미(메모 정리)
  const [panelTab, setPanelTab] = useState<"prepared" | "assistant">(
    "prepared",
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const aiOpen = panelOpen && panelTab === "assistant";
  const aiStale =
    !!aiInput &&
    isAISourceStale(aiInput, {
      text: meeting.memo,
      revision: meeting.memoRevision,
    });
  const [entry, setEntry] = useState<
    "feedback" | "decision" | "question" | null
  >(null);
  const [entryTitle, setEntryTitle] = useState("");
  const [entryBody, setEntryBody] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [entryReplaces, setEntryReplaces] = useState("");
  // 메모·전사문에서 고른 문장으로 채워 열었는지. 대화상자 안내 문구가 달라집니다.
  const [entryFrom, setEntryFrom] = useState<"memo" | "transcript" | null>(
    null,
  );
  // 전사문에서 고른 글의 녹음 위치. 피드백으로 저장할 때 함께 남겨요.
  const [entrySource, setEntrySource] = useState<AudioSource | null>(null);
  // 고치는 중인 결정. 없으면 새로 추가하는 것입니다.
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);
  const entryForm = useSaving();
  // 결정 사항에서 바로 할 일을 만듭니다(검수 H-5). 미팅 준비 목록과는 따로 저장돼요.
  const [taskFrom, setTaskFrom] = useState<Decision | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTitleError, setTaskTitleError] = useState("");
  const taskTitleInput = useRef<HTMLInputElement>(null);
  const taskForm = useSaving();
  const [linkQuestionId, setLinkQuestionId] = useState<string | null>(null);
  const [targetMeetingId, setTargetMeetingId] = useState("");
  const questionForm = useSaving();
  const linkedTasks = orderedBy(
    data.tasks.filter((item) => meeting.taskIds.includes(item.id)),
    meeting.taskIds,
  );
  const linkedVersions = data.versions.filter((item) =>
    meeting.versionIds.includes(item.id),
  );
  const linkedQuestions = data.questions.filter(
    (item) =>
      meeting.questionIds.includes(item.id) || item.meetingId === meeting.id,
  );
  // 준비 목록은 미팅에 저장한 순서(questionIds·taskIds)대로 보여요.
  const preparedQuestions = orderedBy(
    data.questions.filter((item) => meeting.questionIds.includes(item.id)),
    meeting.questionIds,
  );
  // 연구 전체 결정의 연결(무엇을 바꿨고 무엇으로 바뀌었는지)에서 이 미팅 것만 고릅니다.
  const allDecisions = decisionLog(data.decisions, data.meetings, researchId);
  const decisions = allDecisions.filter(
    (entry) => entry.decision.meetingId === meeting.id,
  );
  const replaceable = replaceableDecisions(
    allDecisions,
    editingDecision ?? undefined,
  );
  async function commitMemo(overwrite = false): Promise<Meeting | null> {
    if (memoPending.current || composingMemo.current) return null;
    if (draftMemo.current === savedMemo.current) return latest.current;
    const current = latest.current;
    if (!overwrite && hasMemoConflict(savedMemo.current, current.memo)) {
      setMemoConflict(true);
      setMemoState("error");
      setMemoError(
        t(
          "다른 창이나 공동연구자가 메모를 먼저 저장했을 수 있어요. 작성한 내용은 그대로 있어요. 저장본과 비교한 뒤 저장 방법을 골라 주세요.",
        ),
      );
      return null;
    }
    memoPending.current = true;
    setMemoConflict(false);
    setMemoState("saving");
    setMemoError(null);
    const text = draftMemo.current;
    try {
      const stored = await save("meetings", {
        ...current,
        memo: text,
        memoRevision: current.memoRevision + 1,
        // 형광펜은 같은 글자를 새 메모에서 찾아 자리를 옮겨 함께 저장합니다(08 §3.1).
        ...(current.memoMarks?.length
          ? {
              memoMarks: relocateMarks(current.memoMarks, current.memo, text),
            }
          : {}),
      });
      savedMemo.current = text;
      savedRevision.current = stored.memoRevision;
      latest.current = stored;
      if (draftMemo.current === text) {
        setMemoState("saved");
        try {
          sessionStorage.removeItem(draftKey);
        } catch {}
      } else {
        setMemoState("dirty");
        setMemoTick((value) => value + 1);
      }
      return stored;
    } catch (e) {
      setMemoState("error");
      setMemoError(`${friendlyError(e)} ${t("입력한 메모는 그대로 있어요.")}`);
      return null;
    } finally {
      memoPending.current = false;
    }
  }
  function loadSavedMemo() {
    const current = latest.current;
    savedMemo.current = current.memo;
    savedRevision.current = current.memoRevision;
    draftMemo.current = current.memo;
    setMemo(current.memo);
    setMemoConflict(false);
    setMemoState("saved");
    setMemoError(null);
    try {
      sessionStorage.removeItem(draftKey);
    } catch {}
  }
  useEffect(() => {
    if (memoPending.current) return;
    if (draftMemo.current === savedMemo.current) {
      savedMemo.current = meeting.memo;
      savedRevision.current = meeting.memoRevision;
      draftMemo.current = meeting.memo;
      setMemo(meeting.memo);
      setMemoState("saved");
    } else if (hasMemoConflict(savedMemo.current, meeting.memo)) {
      setMemoConflict(true);
      setMemoState("error");
      setMemoError(
        t(
          "저장된 메모가 바뀌었어요. 작성한 내용은 그대로 있어요. 저장본과 비교한 뒤 저장 방법을 골라 주세요.",
        ),
      );
    }
  }, [meeting.memo, meeting.memoRevision]);
  useEffect(() => {
    if (memo === savedMemo.current) {
      // 고쳤다가 저장본과 같게 되돌리면 저장할 것이 없어요. '작성 중'에 머물거나
      // 되돌리기 전 임시본이 새로고침 뒤 살아나지 않게 정리합니다.
      if (!memoConflict && !memoPending.current) {
        setMemoState((state) => (state === "dirty" ? "saved" : state));
        try {
          sessionStorage.removeItem(draftKey);
        } catch {}
      }
      return;
    }
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          text: memo,
          baseMemo: savedMemo.current,
          baseRevision: savedRevision.current,
        }),
      );
    } catch {}
    if (memoConflict) return;
    setMemoTouched(true);
    setMemoState("dirty");
    const timer = setTimeout(() => {
      void commitMemo();
    }, 800);
    return () => clearTimeout(timer);
  }, [memo, memoTick, memoConflict]);
  useNavigationGuard({
    dirty: memo !== savedMemo.current,
    busy: memoState === "saving",
    label: t("미팅 메모"),
    onDiscard: loadSavedMemo,
  });
  /** 고른 메모 글에 형광펜을 칠하거나(겹치면) 지웁니다(04 §5.2). 누르는 즉시 저장합니다. */
  async function toggleMemoMark() {
    const field = memoField.current;
    if (!field) return;
    const start = field.selectionStart,
      end = field.selectionEnd;
    if (start === end) return;
    let base = latest.current;
    if (draftMemo.current !== savedMemo.current) {
      const saved = await commitMemo();
      if (!saved) return;
      base = saved;
    }
    if (base.memo !== draftMemo.current) return;
    const marked = overlapsMark(base.memoMarks, base.memo, start, end);
    const marks = marked
      ? removeMarks(base.memoMarks, base.memo, start, end)
      : addMark(base.memoMarks, base.memo, start, end);
    if (
      !marked &&
      marks.length >= MARK_LIMIT &&
      validMarks(base.memoMarks, base.memo).length >= MARK_LIMIT
    ) {
      toast.error(
        t("형광펜은 {count}개까지 칠할 수 있어요.", { count: MARK_LIMIT }),
      );
      return;
    }
    try {
      const stored = await save("meetings", { ...base, memoMarks: marks });
      latest.current = stored;
      memoSelection.clear();
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  /** 누른 형광펜 하나를 지웁니다(04 §5.3). */
  async function eraseMark(start: number, end: number) {
    setEraseAt(null);
    let base = latest.current;
    if (draftMemo.current !== savedMemo.current) {
      const saved = await commitMemo();
      if (!saved) return;
      base = saved;
    }
    if (base.memo !== draftMemo.current) return;
    try {
      const stored = await save("meetings", {
        ...base,
        memoMarks: removeMarks(base.memoMarks, base.memo, start, end),
      });
      latest.current = stored;
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  /** 커서만 놓은 자리가 항목 없는 형광펜 안이면 지우기 메뉴를 띄웁니다. */
  function pickMarkAt(event: React.MouseEvent<HTMLTextAreaElement>) {
    const field = event.currentTarget;
    const host = memoHost.current;
    if (!host || field.selectionStart !== field.selectionEnd) {
      setEraseAt(null);
      return;
    }
    const at = field.selectionStart;
    const mark = validMarks(
      relocateMarks(meeting.memoMarks, meeting.memo, memo),
      memo,
    ).find(
      (item) =>
        item.start < at &&
        at < item.end &&
        !anchors.some(
          (anchor) => anchor.start < item.end && anchor.end > item.start,
        ),
    );
    if (!mark) {
      setEraseAt(null);
      return;
    }
    const rect = host.getBoundingClientRect();
    setEraseAt({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      start: mark.start,
      end: mark.end,
    });
  }
  /**
   * 고른 메모 글로 피드백·결정·질문·할 일을 창 없이 바로 만듭니다(04 §5.2).
   * 메모에서 만든 것은 이 기록의 공개 범위를 따르고, 6초 안에 되돌리면 보관합니다.
   */
  async function quickCreate(
    kind: "feedback" | "decision" | "question" | "task",
  ) {
    const field = memoField.current;
    if (!field) return;
    const selected = field.value.slice(
      field.selectionStart,
      field.selectionEnd,
    );
    const text = selected.trim();
    const textStart =
      field.selectionStart + (selected.length - selected.trimStart().length);
    if (text.length < 2 || text.length > 2000) {
      toast.error(t("2자 이상 2,000자 이하로 골라 주세요."));
      return;
    }
    let base = latest.current;
    if (draftMemo.current !== savedMemo.current) {
      const saved = await commitMemo();
      if (!saved) return;
      base = saved;
    }
    const draft = entryFromSelection(text);
    const visibility = base.visibility ?? "private";
    const record = recordBase(researchId);
    const at =
      base.memo.slice(textStart, textStart + text.length) === text
        ? textStart
        : base.memo.indexOf(text);
    const quoted =
      at === -1
        ? {}
        : {
            sourceQuote: text,
            sourceMemoRevision: base.memoRevision,
            sourceStart: at,
            sourceEnd: at + text.length,
          };
    memoSelection.clear();
    try {
      let created: {
        kind: "feedback" | "decision" | "question" | "task";
        id: string;
      };
      if (kind === "feedback") {
        const stored = await save("feedback", {
          ...record,
          origin: "manual",
          meetingId: meeting.id,
          title: draft?.title ?? text.slice(0, 40),
          body: text,
          notes: "",
          status: "unprocessed",
          visibility,
          ...quoted,
        });
        created = { kind, id: stored.id };
      } else if (kind === "decision") {
        const stored = await save("decisions", {
          ...record,
          origin: "manual",
          meetingId: meeting.id,
          text,
          visibility,
          ...quoted,
        });
        created = { kind, id: stored.id };
      } else if (kind === "question") {
        const stored = await save("questions", {
          ...record,
          origin: "manual",
          meetingId: meeting.id,
          text,
          status: "open",
          visibility,
          ...quoted,
        } as Question);
        created = { kind, id: stored.id };
      } else {
        const stored = await save("tasks", {
          ...record,
          origin: "manual",
          title: text.split(/\r?\n/)[0]!.slice(0, 80),
          description: text.length > 80 ? text : "",
          status: "todo",
          dueDate: null,
          priority: "normal",
          visibility,
          feedbackIds: [],
          sourceRecordId: meeting.id,
          ...quoted,
        } as Task);
        created = { kind, id: stored.id };
      }
      const collection = {
        feedback: "feedback",
        decision: "decisions",
        question: "questions",
        task: "tasks",
      } as const;
      toast.success(
        {
          feedback: t("피드백을 만들었어요."),
          decision: t("결정을 만들었어요."),
          question: t("질문을 만들었어요."),
          task: t("할 일을 만들었어요."),
        }[kind],
        {
          duration: 6000,
          action: {
            label: t("보기"),
            onClick: () => {
              const next = new URLSearchParams(window.location.search);
              next.set("detail", `${created.kind}:${created.id}`);
              navigate(
                { search: `?${next.toString()}` },
                { state: { layer: "detail", depth: 1 } },
              );
            },
          },
          cancel: {
            label: t("되돌리기"),
            onClick: () =>
              void remove(collection[created.kind], created.id).catch((error) =>
                toast.error(friendlyError(error)),
              ),
          },
        },
      );
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function changeTab(next: string) {
    if (tab === "record" && draftMemo.current !== savedMemo.current) {
      const result = await commitMemo();
      if (!result) return;
    }
    // 준비·기록은 mode, 결정·질문은 tab으로 남깁니다(04 §3 예전 주소 옮기기).
    setParams(next === "questions" ? { tab: next } : { mode: next });
  }
  function beginPreparation() {
    prepBase.current = meeting;
    setGoal(meeting.goal);
    setTaskIds([...meeting.taskIds]);
    setVersionIds([...meeting.versionIds]);
    setQuestionIds([...meeting.questionIds]);
    setDraftQuestions([]);
    setNewQuestion("");
    setDraftTasks([]);
    setNewTask("");
    prepForm.setError(null);
    setPreparing(true);
  }
  function addDraftQuestion() {
    if (!newQuestion.trim()) return;
    const question: Question = {
      ...recordBase(researchId),
      origin: "manual",
      meetingId: meeting.id,
      text: newQuestion.trim(),
      status: "open",
    };
    setDraftQuestions((items) => [...items, question]);
    setQuestionIds((ids) => [...ids, question.id]);
    setNewQuestion("");
  }
  function draftTask(title: string, description = ""): Task {
    return {
      ...recordBase(researchId),
      origin: "manual",
      title,
      description,
      status: "todo",
      dueDate: null,
      priority: "normal",
      visibility: "private",
      feedbackIds: [],
    };
  }
  function addDraftTask() {
    if (!newTask.trim()) return;
    const task = draftTask(newTask.trim());
    setDraftTasks((items) => [...items, task]);
    setTaskIds((ids) => [...ids, task.id]);
    setNewTask("");
  }
  function openTaskFrom(decision: Decision) {
    setTaskFrom(decision);
    setTaskTitle(decision.text.split("\n")[0].slice(0, 80));
    setTaskTitleError("");
    taskForm.setError(null);
  }
  async function storeTaskFrom(event: React.FormEvent) {
    event.preventDefault();
    if (!taskFrom) return;
    if (!taskTitle.trim()) {
      // 브라우저 기본 말풍선 대신 칸 아래에 알려 줍니다(QA F-005).
      setTaskTitleError(t("할 일 이름을 적어 주세요."));
      taskTitleInput.current?.focus();
      return;
    }
    const task = draftTask(
      taskTitle.trim(),
      t("{meeting} 결정 사항: {text}", {
        meeting: meeting.title,
        text: taskFrom.text,
      }),
    );
    await taskForm.perform(async () => {
      await save("tasks", task);
      setTaskFrom(null);
      toast.success(t("할 일을 추가했어요"), {
        action: {
          label: t("열기"),
          onClick: () => navigate(`/r/${researchId}/tasks/${task.id}`),
        },
      });
    });
  }
  async function storePreparation(event: React.FormEvent) {
    event.preventDefault();
    if (!goal.trim()) {
      prepForm.setError(t("이번 미팅에서 보여줄 결과를 적어 주세요."));
      return;
    }
    let questions = draftQuestions;
    let selectedIds = questionIds;
    if (newQuestion.trim()) {
      const question: Question = {
        ...recordBase(researchId),
        origin: "manual",
        meetingId: meeting.id,
        text: newQuestion.trim(),
        status: "open",
      };
      questions = [...draftQuestions, question];
      selectedIds = [...questionIds, question.id];
      setDraftQuestions(questions);
      setQuestionIds(selectedIds);
      setNewQuestion("");
    }
    let tasks = draftTasks;
    let selectedTaskIds = taskIds;
    if (newTask.trim()) {
      const task = draftTask(newTask.trim());
      tasks = [...draftTasks, task];
      selectedTaskIds = [...taskIds, task.id];
      setDraftTasks(tasks);
      setTaskIds(selectedTaskIds);
      setNewTask("");
    }
    await prepForm.perform(async () => {
      // 준비에서 새로 적은 할 일은 고른 것만 먼저 만들고, 그다음 준비를 저장합니다.
      for (const task of tasks.filter((item) =>
        selectedTaskIds.includes(item.id),
      ))
        await save("tasks", task);
      setDraftTasks([]);
      await savePreparation(
        {
          ...prepBase.current,
          goal: goal.trim(),
          taskIds: selectedTaskIds,
          versionIds,
          questionIds: selectedIds,
        },
        questions.filter((item) => selectedIds.includes(item.id)),
      );
      setPreparing(false);
      toast.success(t("미팅 준비를 저장했어요"));
    });
  }
  async function openAI() {
    const stored = await commitMemo();
    if (!stored) return;
    if (!stored.memo.trim()) {
      toast.error(t("AI로 정리할 메모가 없어요. 메모를 먼저 작성해 주세요."));
      return;
    }
    const source = { text: stored.memo, revision: stored.memoRevision };
    if (!aiInput || isAISourceStale(aiInput, source))
      setAiInput({
        mode: "organize_meeting",
        researchId,
        meetingId: meeting.id,
        sourceText: source.text,
        sourceRevision: source.revision,
      });
    setPanelTab("assistant");
    setPanelOpen(true);
  }
  async function saveCandidate(candidate: AICandidate, base: BaseRecord) {
    const body = (candidate.body ?? candidate.title).trim();
    if (candidate.category === "decision") {
      await save("decisions", {
        ...base,
        origin: "ai",
        meetingId: meeting.id,
        text: body,
      });
    } else if (candidate.category === "question") {
      const q: Question = {
        ...base,
        origin: "ai",
        meetingId: meeting.id,
        text: body,
        status: "open",
      };
      await savePreparation(
        {
          ...latest.current,
          questionIds: [...new Set([...latest.current.questionIds, q.id])],
        },
        [q],
      );
    } else {
      const source = aiInput?.sourceText ?? "";
      const quote =
        candidate.sourceQuote && source.includes(candidate.sourceQuote)
          ? candidate.sourceQuote
          : undefined;
      await save("feedback", {
        ...base,
        origin: "ai",
        meetingId: meeting.id,
        title: candidate.title.trim(),
        body,
        notes: "",
        status: "unprocessed",
        sourceQuote: quote,
        sourceMemoRevision: aiInput?.sourceRevision,
        ...(quote
          ? {
              sourceStart: source.indexOf(quote),
              sourceEnd: source.indexOf(quote) + quote.length,
            }
          : {}),
      });
    }
    toast.success(t("선택한 AI 제안을 저장했어요"));
  }
  // 준비 목록 순서 바꾸기. 다른 내용은 건드리지 않고 순서만 저장해요.
  async function reorderPrepared(
    field: "questionIds" | "taskIds",
    visibleIds: string[],
  ) {
    const current = latest.current;
    await savePreparation(
      { ...current, [field]: reorderIds(current[field], visibleIds) },
      [],
    );
  }
  function openEntry(
    kind: "feedback" | "decision" | "question",
    existing?: Decision,
    preset?: { text: string; source?: AudioSource },
  ) {
    entryBase.current = existing ?? recordBase(researchId);
    setEditingDecision(existing ?? null);
    const field = memoField.current;
    const draft = preset
      ? entryFromSelection(preset.text)
      : !existing && field
        ? entryFromSelection(
            field.value.slice(field.selectionStart, field.selectionEnd),
          )
        : null;
    setEntryFrom(draft ? (preset ? "transcript" : "memo") : null);
    setEntrySource(preset?.source ?? null);
    setEntry(kind);
    setEntryTitle(kind === "feedback" ? (draft?.title ?? "") : "");
    setEntryBody(existing?.text ?? draft?.body ?? "");
    setEntryReason(existing?.reason ?? "");
    setEntryReplaces(existing?.replacesId ?? "");
    entryForm.setError(null);
  }
  async function storeEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!entryBody.trim() || (entry === "feedback" && !entryTitle.trim())) {
      entryForm.setError(
        entry === "feedback"
          ? t("제목과 피드백 내용을 입력해 주세요.")
          : t("내용을 입력해 주세요."),
      );
      return;
    }
    await entryForm.perform(async () => {
      entryBase.current ??= recordBase(researchId);
      // 원문에서 만든 항목은 공개 범위를 직접 정합니다(04 §5.2): 전사는 늘 나만 보기,
      // 메모는 그 기록을 따름. 고친 결정은 원래 값을 그대로 둡니다.
      const visibility: { visibility?: "private" | "shared" } = editingDecision
        ? {}
        : entryFrom === "transcript"
          ? { visibility: "private" }
          : entryFrom === "memo"
            ? { visibility: latest.current.visibility ?? "private" }
            : {};
      const base = { ...entryBase.current, ...visibility };
      if (entry === "feedback")
        await save("feedback", {
          ...base,
          origin: "manual",
          meetingId: meeting.id,
          title: entryTitle.trim(),
          body: entryBody.trim(),
          notes: "",
          status: "unprocessed",
          ...(entrySource ? { audioSource: entrySource } : {}),
        });
      else if (entry === "decision")
        await save("decisions", {
          ...base,
          origin: editingDecision?.origin ?? "manual",
          meetingId: meeting.id,
          text: entryBody.trim(),
          reason: entryReason.trim() || undefined,
          replacesId: entryReplaces || undefined,
        });
      else {
        const q: Question = {
          ...base,
          origin: "manual",
          meetingId: meeting.id,
          text: entryBody.trim(),
          status: "open",
        };
        await savePreparation(
          {
            ...latest.current,
            questionIds: [...new Set([...latest.current.questionIds, q.id])],
          },
          [q],
        );
      }
      setEntry(null);
      toast.success(t("저장했어요"));
    });
  }
  async function toggleQuestion(question: Question) {
    try {
      await save("questions", {
        ...question,
        status: question.status === "resolved" ? "open" : "resolved",
      });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("질문 상태를 바꾸지 못했어요. 다시 시도해 주세요."),
      );
    }
  }
  const allQuestions = [
    ...data.questions.filter((item) => item.researchId === researchId),
    ...draftQuestions,
  ];
  return (
    <div className="student-page">
      <RecordHeader
        meeting={meeting}
        mode={viewMode}
        view={tab === "prepare" ? "prepare" : "record"}
        onView={(next) => void changeTab(next)}
        onEditInfo={() => {
          metaBase.current = meeting;
          setMeta({
            title: meeting.title,
            date: meeting.date ?? "",
            time: meeting.time ?? "",
            status: meeting.status,
          });
          metaForm.setError(null);
          setEditingMeta(true);
        }}
        onStartRecording={() => {
          void changeTab("record").then(() =>
            window.setTimeout(
              () =>
                document
                  .getElementById("meeting-recording")
                  ?.scrollIntoView({ block: "start" }),
              50,
            ),
          );
        }}
      />
      <Tabs
        className="tabs-line"
        label={t("미팅 내용")}
        value={tab}
        onChange={(value) => void changeTab(value)}
        options={[
          ...(written ? [] : [{ value: "prepare", label: t("준비") }]),
          { value: "record", label: t("기록") },
          {
            value: "questions",
            label: t("결정·질문"),
            count: linkedQuestions.filter((q) => q.status === "open").length,
          },
        ]}
      />
      {tab === "prepare" && (
        <div className="record-columns">
          <div className="record-with-side">
            <div className="meeting-preparation">
              <section className="surface preparation-goal">
                <div className="section-heading">
                  <span className="section-kicker">
                    {t("이번 미팅에서 보여줄 결과")}
                  </span>
                  <Button variant="ghost" onClick={beginPreparation}>
                    <Icon name="edit" size={16} />
                    {t("준비 편집")}
                  </Button>
                </div>
                <h2>{meeting.goal || t("아직 정하지 않았어요")}</h2>
                <div className="preparation-summary">
                  <span>
                    <Icon name="check" size={15} />
                    {t("할 일 {count}개", { count: linkedTasks.length })}
                  </span>
                  <span>
                    <Icon name="file" size={15} />
                    {t("자료 {count}개", { count: linkedVersions.length })}
                  </span>
                  <span>
                    <Icon name="message" size={15} />
                    {t("질문 {count}개", {
                      count: preparedQuestions.filter(
                        (q) => q.status === "open",
                      ).length,
                    })}
                  </span>
                </div>
                {research &&
                  research.nextMeetingId !== meeting.id &&
                  meeting.status !== "cancelled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void saveResearch({
                          ...research,
                          nextMeetingId: meeting.id,
                        })
                          .then(() =>
                            toast.success(t("홈의 다음 미팅으로 지정했어요")),
                          )
                          .catch((e) => toast.error(e.message));
                      }}
                    >
                      {t("홈의 다음 미팅으로 지정")}
                    </Button>
                  )}
              </section>
              <div className="preparation-columns">
                <section className="surface">
                  <div className="section-heading">
                    <h2>{t("할 일")}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={beginPreparation}
                    >
                      {t("할 일 고르기")}
                    </Button>
                  </div>
                  {linkedTasks.length ? (
                    <SortableList
                      items={linkedTasks}
                      getKey={(task) => task.id}
                      label={t("이번 미팅 할 일 순서")}
                      itemName={(task) => task.title}
                      onCommit={(ids) => reorderPrepared("taskIds", ids)}
                      renderItem={(task) => (
                        <Link
                          className="student-simple-row"
                          to={`/r/${researchId}/tasks/${task.id}`}
                          state={back(meeting.title)}
                        >
                          <span
                            className={`student-check-indicator ${task.status === "done" ? "checked" : ""}`}
                          >
                            {task.status === "done" && (
                              <Icon name="check" size={13} />
                            )}
                          </span>
                          <span className="grow">
                            <strong>{task.title}</strong>
                            <small>
                              {task.dueDate
                                ? t("기한 {date}", {
                                    date: formatDate(task.dueDate),
                                  })
                                : t("기한 미정")}
                            </small>
                          </span>
                          <StatusBadge
                            tone={
                              task.status === "done"
                                ? "green"
                                : task.status === "doing"
                                  ? "blue"
                                  : "neutral"
                            }
                          >
                            {taskLabels[task.status]}
                          </StatusBadge>
                        </Link>
                      )}
                    />
                  ) : (
                    <EmptyState
                      title={t("이번 미팅에 고른 할 일이 없어요")}
                      action={
                        <Button variant="outline" onClick={beginPreparation}>
                          {t("할 일 고르기")}
                        </Button>
                      }
                    />
                  )}
                </section>
                <section className="surface">
                  <div className="section-heading">
                    <h2>{t("보여줄 자료")}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={beginPreparation}
                    >
                      {t("자료 고르기")}
                    </Button>
                  </div>
                  {linkedVersions.length ? (
                    linkedVersions.map((version) => (
                      <Link
                        className="student-simple-row"
                        key={version.id}
                        to={`/r/${researchId}/materials/${version.materialId}?version=${version.id}`}
                        state={back(meeting.title)}
                      >
                        <span className="student-file-symbol">
                          <Icon name="file" size={18} />
                        </span>
                        <span className="grow">
                          <strong>{version.fileName}</strong>
                          <small>
                            {t("파일 v{number}", { number: version.number })}
                          </small>
                        </span>
                        <Icon name="arrow-up-right" size={15} />
                      </Link>
                    ))
                  ) : (
                    <InlineEmpty>
                      {t(
                        "고른 자료가 없어요. 자료를 고르면 그 버전 그대로 준비에 추가돼요.",
                      )}
                    </InlineEmpty>
                  )}
                  <div className="student-subsection">
                    <div className="section-heading">
                      <h3>{t("물어볼 질문")}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEntry("question")}
                        aria-label={t("질문 추가")}
                      >
                        <Icon name="plus" size={16} />
                      </Button>
                    </div>
                    {preparedQuestions.filter((q) => q.status === "open")
                      .length ? (
                      <SortableList
                        items={preparedQuestions.filter(
                          (q) => q.status === "open",
                        )}
                        getKey={(question) => question.id}
                        label={t("물어볼 질문 순서")}
                        itemName={(question) => question.text.slice(0, 40)}
                        onCommit={(ids) => reorderPrepared("questionIds", ids)}
                        renderItem={(question) => (
                          <div className="student-question-row">
                            <Icon name="message" size={16} />
                            <p>{question.text}</p>
                          </div>
                        )}
                      />
                    ) : (
                      <InlineEmpty>{t("물어볼 질문이 없어요.")}</InlineEmpty>
                    )}
                  </div>
                </section>
              </div>
            </div>
            <PrepareSide meeting={meeting} />
          </div>
        </div>
      )}
      {
        <div hidden={tab !== "record"} className="record-columns">
          <div className="record-layout record-with-side">
            <section id="meeting-recording" className="surface memo-surface">
              {/* 서면 피드백 기록에는 녹음·전사가 없습니다(04 §5.5). */}
              {!written && (
                <RecordingPanel
                  researchId={meeting.researchId}
                  meetingId={meeting.id}
                  onAppend={(text) => {
                    if ((draftMemo.current + text).length > 50000)
                      throw new Error(
                        t(
                          "미팅 메모가 50,000자를 넘게 돼서 전사문을 추가하지 않았어요. 필요한 부분만 복사해 붙여 넣어 주세요.",
                        ),
                      );
                    setMemo(draftMemo.current + text);
                  }}
                  onPick={(pick: TranscriptPick) =>
                    openEntry(pick.kind, undefined, {
                      text: pick.text,
                      source: pick.source,
                    })
                  }
                />
              )}
              <div className="section-heading">
                <h2>{written ? t("받은 서면 피드백") : t("미팅 원문 메모")}</h2>
                <span role="status" className={`save-state ${memoState}`}>
                  {(memoTouched || memoState === "error") && (
                    <>
                      <span />
                      {memoState === "saved"
                        ? mode === "preview"
                          ? t("이 브라우저에 저장됨")
                          : t("저장됨")
                        : memoState === "saving"
                          ? t("저장 중")
                          : memoState === "error"
                            ? t("저장 실패")
                            : t("작성 중")}
                    </>
                  )}
                </span>
              </div>
              <p className="student-footnote">
                {t(
                  "들은 내용을 그대로 적거나 기존 메모를 붙여 넣어 주세요. 정리한 피드백, 결정 사항, 질문은 이 메모와 따로 저장돼요.",
                )}{" "}
                {t(
                  "메모에서 문장을 고르면 위에 뜨는 버튼이나 ‘직접 추가’로 그 문장을 채울 수 있어요.",
                )}
              </p>
              <div className="selection-host memo-marked" ref={memoHost}>
                {/* 형광펜은 글 칸 뒤에 같은 글을 그려 칠합니다(글 칸 안에는 표시를 넣을 수 없음). */}
                <div
                  className="memo-backdrop"
                  aria-hidden="true"
                  ref={memoBackdrop}
                >
                  {memoPieces(
                    memo,
                    relocateMarks(meeting.memoMarks, meeting.memo, memo),
                    anchors,
                  ).map((piece) => (
                    <MemoPieceView
                      key={piece.start}
                      piece={piece}
                      pointed={pointed}
                    />
                  ))}
                  {"\n"}
                </div>
                {/* 번호만 글 칸 위에 올려 누를 수 있게 합니다(04 §5.3). */}
                {anchors.length > 0 && (
                  <div className="memo-backdrop memo-overlay" ref={memoOverlay}>
                    {memoPieces(memo, undefined, anchors).map((piece) => (
                      <MemoPieceView
                        key={piece.start}
                        piece={piece}
                        onOpen={(number) => {
                          const anchor = anchors.find(
                            (item) => item.number === number,
                          );
                          if (anchor) openAnchor(anchor.kind, anchor.id);
                        }}
                      />
                    ))}
                    {"\n"}
                  </div>
                )}
                <textarea
                  ref={memoField}
                  onScroll={(event) => {
                    if (memoBackdrop.current)
                      memoBackdrop.current.scrollTop =
                        event.currentTarget.scrollTop;
                    if (memoOverlay.current)
                      memoOverlay.current.scrollTop =
                        event.currentTarget.scrollTop;
                  }}
                  className="meeting-memo"
                  aria-label={t("미팅 원문 메모")}
                  value={memo}
                  onCompositionStart={() => {
                    composingMemo.current = true;
                  }}
                  onCompositionEnd={(e) => {
                    composingMemo.current = false;
                    draftMemo.current = e.currentTarget.value;
                    setMemo(e.currentTarget.value);
                    setMemoTick((v) => v + 1);
                  }}
                  onChange={(e) => {
                    draftMemo.current = e.target.value;
                    setMemo(e.target.value);
                  }}
                  onBlur={() => {
                    void commitMemo();
                  }}
                  onMouseUp={pickMarkAt}
                  onKeyDown={() => setEraseAt(null)}
                  placeholder={t(
                    "예: 교수님 피드백, 결정한 내용, 다시 확인할 질문",
                  )}
                />
                <SelectionToolbar
                  anchor={eraseAt}
                  onDismiss={() => setEraseAt(null)}
                  label={t("형광펜")}
                  actions={
                    eraseAt
                      ? [
                          {
                            key: "erase",
                            icon: "close",
                            label: t("형광펜 지우기"),
                            onSelect: () =>
                              void eraseMark(eraseAt.start, eraseAt.end),
                          },
                        ]
                      : []
                  }
                />
                <SelectionToolbar
                  anchor={memoSelection.anchor}
                  onDismiss={memoSelection.clear}
                  label={t("고른 메모로 만들기")}
                  actions={[
                    {
                      key: "mark",
                      icon: "edit",
                      label: t("형광펜"),
                      onSelect: () => void toggleMemoMark(),
                    },
                    {
                      key: "feedback",
                      icon: "plus",
                      label: t("피드백"),
                      onSelect: () => void quickCreate("feedback"),
                    },
                    {
                      key: "task",
                      icon: "plus",
                      label: t("할 일"),
                      onSelect: () => void quickCreate("task"),
                    },
                    {
                      key: "decision",
                      icon: "plus",
                      label: t("결정"),
                      onSelect: () => void quickCreate("decision"),
                    },
                    {
                      key: "question",
                      icon: "plus",
                      label: t("질문"),
                      onSelect: () => void quickCreate("question"),
                    },
                  ]}
                />
              </div>
              <ErrorNotice error={memoError} />
              {memoConflict ? (
                <div className="stack">
                  <Disclosure
                    className="student-details"
                    summary={t("저장본과 비교하기 · 원문 v{revision}", {
                      revision: meeting.memoRevision,
                    })}
                  >
                    <p className="student-body-text">
                      {meeting.memo || t("저장된 메모가 없어요.")}
                    </p>
                  </Disclosure>
                  <div className="button-row">
                    <Button variant="outline" onClick={loadSavedMemo}>
                      {t("저장본으로 바꾸기")}
                    </Button>
                    <Button
                      disabled={memoState === "saving"}
                      onClick={() => void commitMemo(true)}
                    >
                      {t("내 작성 내용으로 저장")}
                    </Button>
                  </div>
                </div>
              ) : (
                memoState === "error" && (
                  <div className="button-row">
                    <Button variant="outline" onClick={() => void commitMemo()}>
                      {t("다시 저장")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void refresh().catch((e) =>
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : t(
                                  "저장본을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.",
                                ),
                          ),
                        )
                      }
                    >
                      {t("최신 저장본 확인")}
                    </Button>
                  </div>
                )
              )}
              <div className="memo-actions">
                <span className="meta">
                  {t("원문 v{revision} · {count}자", {
                    revision: meeting.memoRevision,
                    count: memo.length.toLocaleString(),
                  })}
                </span>
                <Button
                  variant="outline"
                  disabled={memoState === "saving" || !memo.trim()}
                  aria-describedby={memoAIReason.describedBy}
                  onClick={() => void openAI()}
                >
                  <Icon name="sparkles" size={16} />
                  {aiInput && !aiOpen
                    ? t("AI 정리 다시 열기")
                    : t("AI로 메모 정리")}
                </Button>
              </div>
              {memoAIReason.node}
            </section>
            <RecordSide
              meeting={meeting}
              numbers={anchorNumbers}
              onPoint={setPointed}
              prepareOrganize={() => commitMemo()}
              memoText={memo}
              onAddFeedback={() => openEntry("feedback")}
              onAddDecision={() => openEntry("decision")}
              onAddQuestion={() => openEntry("question")}
              onShowPreparation={() => void changeTab("prepare")}
            />
            <MarginPanel
              label={t("준비한 내용과 연구 도우미")}
              open={panelOpen}
              onOpen={() => setPanelOpen(true)}
              onClose={() => setPanelOpen(false)}
            >
              <PanelFrame
                title={t("이 미팅")}
                onClose={() => setPanelOpen(false)}
                tab={panelTab}
                onTab={(value) =>
                  value === "assistant"
                    ? void openAI()
                    : setPanelTab("prepared")
                }
                tabs={[
                  // 서면 피드백에는 '준비한 것'이 없습니다(04 §5.5).
                  ...(written
                    ? []
                    : [
                        {
                          value: "prepared",
                          label: t("준비"),
                          count:
                            preparedQuestions.length + linkedVersions.length,
                        },
                      ]),
                  { value: "assistant", label: t("연구 도우미") },
                ]}
              >
                {panelTab === "prepared" && !written && (
                  <div className="panel-frame-body">
                    <h3>{t("이번 미팅에서 보여줄 결과")}</h3>
                    <p className="meeting-panel-goal">
                      {meeting.goal || t("아직 정하지 않았어요.")}
                    </p>
                    <h3>
                      {t("준비한 질문")}
                      <span className="count-chip">
                        {preparedQuestions.length}
                      </span>
                    </h3>
                    {preparedQuestions.map((question) => (
                      <div className="student-simple-row" key={question.id}>
                        <span className="grow">
                          <strong>{question.text}</strong>
                        </span>
                        <StatusBadge
                          tone={
                            question.status === "resolved" ? "green" : "neutral"
                          }
                        >
                          {question.status === "resolved"
                            ? t("해결")
                            : t("열림")}
                        </StatusBadge>
                      </div>
                    ))}
                    {!preparedQuestions.length && (
                      <InlineEmpty>{t("준비한 질문이 없어요.")}</InlineEmpty>
                    )}
                    <h3>
                      {t("보여줄 자료")}
                      <span className="count-chip">
                        {linkedVersions.length}
                      </span>
                    </h3>
                    {linkedVersions.map((version) => (
                      <Link
                        className="student-simple-row"
                        key={version.id}
                        to={`/r/${researchId}/materials/${version.materialId}?version=${version.id}`}
                        state={back(meeting.title)}
                      >
                        <span className="grow">
                          <strong>{version.fileName}</strong>
                          <small>v{version.number}</small>
                        </span>
                        <Icon name="arrow-up-right" size={15} />
                      </Link>
                    ))}
                    {!linkedVersions.length && (
                      <InlineEmpty>
                        {t("보여줄 자료를 고르지 않았어요.")}
                      </InlineEmpty>
                    )}
                    <p className="panel-frame-note">
                      {t("준비 탭에서 바꾼 내용이 여기에 보여요.")}
                    </p>
                  </div>
                )}
                {panelTab === "assistant" && aiInput && (
                  <AIWorkbench
                    key={aiInput.sourceRevision}
                    embedded
                    title={t("메모 정리")}
                    input={aiInput}
                    stale={aiStale}
                    onClose={() => setPanelOpen(false)}
                    onRefresh={() => void openAI()}
                    onSave={saveCandidate}
                  />
                )}
              </PanelFrame>
            </MarginPanel>
          </div>
        </div>
      }
      {tab === "questions" && (
        <div className="student-two-column">
          <section className="surface">
            <div className="section-heading">
              <h2>{t("결정 사항")}</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEntry("decision")}
              >
                <Icon name="plus" size={15} />
                {t("결정 추가")}
              </Button>
            </div>
            {decisions.length ? (
              decisions.map(({ decision, replaces, replacedBy }) => (
                <div
                  className={`student-decision ${replacedBy ? "is-replaced" : ""}`}
                  key={decision.id}
                >
                  <span className="student-dot" />
                  <div className="student-decision-copy">
                    <p>
                      {decision.text}
                      {decision.origin && (
                        <span className="meta">
                          {" "}
                          · {originLabels[decision.origin]}
                        </span>
                      )}
                    </p>
                    {decision.reason && (
                      <small>
                        {t("이유: {reason}", { reason: decision.reason })}
                      </small>
                    )}
                    {replaces && (
                      <small>
                        {t("이전 결정: {text}", { text: replaces.text })}
                      </small>
                    )}
                    {replacedBy && (
                      <small>
                        {t("이후 바뀜: {text}", { text: replacedBy.text })}
                      </small>
                    )}
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => openEntry("decision", decision)}
                  >
                    {t("편집")}
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => openTaskFrom(decision)}
                  >
                    {t("할 일에 추가")}
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState
                title={t("기록한 결정 사항이 없어요")}
                description={t("미팅에서 정한 방향과 이유를 남겨 두세요.")}
              />
            )}
          </section>
          <section className="surface">
            <div className="section-heading">
              <h2>{t("질문")}</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEntry("question")}
              >
                <Icon name="plus" size={15} />
                {t("질문 추가")}
              </Button>
            </div>
            {linkedQuestions.length ? (
              linkedQuestions.map((question) => (
                <div
                  className={`question-detail-row ${question.status === "resolved" ? "resolved" : ""}`}
                  key={question.id}
                >
                  <button
                    className="question-status-button"
                    aria-label={
                      question.status === "resolved"
                        ? t("질문 다시 열기")
                        : t("질문 해결로 표시")
                    }
                    onClick={() => void toggleQuestion(question)}
                  >
                    <Icon
                      name={
                        question.status === "resolved" ? "check" : "message"
                      }
                      size={17}
                    />
                  </button>
                  <div>
                    <p>{question.text}</p>
                    <span className="meta">
                      {question.status === "resolved"
                        ? t("해결됨")
                        : t("미해결")}
                      {question.origin && (
                        <> · {originLabels[question.origin]}</>
                      )}
                    </span>
                    {question.status === "open" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLinkQuestionId(question.id);
                          setTargetMeetingId("");
                          questionForm.setError(null);
                        }}
                      >
                        {t("다른 미팅 준비에 추가")}
                        <Icon name="arrow-right" size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={t("아직 질문이 없어요")}
                description={t("다음에 확인할 질문을 남겨 두세요.")}
              />
            )}
          </section>
        </div>
      )}
      <FormDialog
        busy={prepForm.saving}
        open={preparing}
        onOpenChange={(open) => {
          if (!prepForm.saving) setPreparing(open);
        }}
        title={t("미팅 준비 편집")}
        description={t(
          "여기서 고르거나 빼도 기존 할 일과 자료는 바뀌지 않아요. 새로 적은 할 일은 저장할 때 만들어져요.",
        )}
      >
        <form onSubmit={storePreparation}>
          <DialogBody>
            <label className="field">
              <span className="field-name">
                {t("보여줄 결과")} <span className="required-mark">*</span>
              </span>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t("예: 비교 기준 3가지를 정리한 선행연구 표")}
                required
              />
            </label>
            <div className="student-picker">
              <h3>{t("할 일")}</h3>
              {data.tasks
                .filter((item) => item.researchId === researchId)
                .map((task) => (
                  <label className="student-choice-row" key={task.id}>
                    <Checkbox
                      checked={taskIds.includes(task.id)}
                      onCheckedChange={(next) =>
                        setTaskIds((ids) =>
                          next
                            ? [...ids, task.id]
                            : ids.filter((id) => id !== task.id),
                        )
                      }
                    />
                    <span>
                      {task.title}
                      <small>
                        {taskLabels[task.status]} ·{" "}
                        {task.dueDate
                          ? formatDate(task.dueDate)
                          : t("기한 미정")}
                      </small>
                    </span>
                  </label>
                ))}
              {draftTasks.map((task) => (
                <label className="student-choice-row" key={task.id}>
                  <Checkbox
                    checked={taskIds.includes(task.id)}
                    onCheckedChange={(next) =>
                      setTaskIds((ids) =>
                        next
                          ? [...ids, task.id]
                          : ids.filter((id) => id !== task.id),
                      )
                    }
                  />
                  <span>
                    {task.title}
                    <small>{t("새 할 일 · 저장하면 만들어져요")}</small>
                  </span>
                </label>
              ))}
              <div className="inline-form">
                <Input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder={t("예: 비교 기준 표에 근거 문헌 추가")}
                  aria-label={t("준비에 추가할 새 할 일")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!isImeComposing(e)) addDraftTask();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("새 할 일 추가")}
                  onClick={addDraftTask}
                >
                  <Icon name="plus" size={16} />
                </Button>
              </div>
            </div>
            <div className="student-picker">
              <h3>{t("보여줄 자료")}</h3>
              {data.versions
                .filter((v) => v.researchId === researchId)
                .map((version) => (
                  <label className="student-choice-row" key={version.id}>
                    <Checkbox
                      checked={versionIds.includes(version.id)}
                      onCheckedChange={(next) =>
                        setVersionIds((ids) =>
                          next
                            ? [...ids, version.id]
                            : ids.filter((id) => id !== version.id),
                        )
                      }
                    />
                    <span>
                      {version.fileName}
                      <small>
                        {t("파일 v{number}", { number: version.number })}
                      </small>
                    </span>
                  </label>
                ))}
              {!data.versions.some((v) => v.researchId === researchId) && (
                <InlineEmpty>
                  {t(
                    "아직 올린 파일이 없어요. 여기서 바로 PDF를 올릴 수 있어요.",
                  )}
                </InlineEmpty>
              )}
              <QuickPdfUpload
                researchId={researchId}
                onUploaded={(version) =>
                  setVersionIds((ids) => [...new Set([...ids, version.id])])
                }
              />
            </div>
            <div className="student-picker">
              <h3>{t("물어볼 질문")}</h3>
              {allQuestions
                .filter(
                  (q) => q.status === "open" || questionIds.includes(q.id),
                )
                .map((question) => (
                  <label className="student-choice-row" key={question.id}>
                    <Checkbox
                      checked={questionIds.includes(question.id)}
                      onCheckedChange={(next) =>
                        setQuestionIds((ids) =>
                          next
                            ? [...ids, question.id]
                            : ids.filter((id) => id !== question.id),
                        )
                      }
                    />
                    <span>{question.text}</span>
                  </label>
                ))}
              <div className="inline-form">
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder={t("예: 설문 문항 수를 줄여도 될까요?")}
                  aria-label={t("준비에 추가할 질문")}
                  onKeyDown={(e) => {
                    // 한글 조합을 끝내는 Enter로 질문이 덜 쓴 채 추가되지 않게 한다.
                    if (e.key === "Enter") {
                      // Enter here adds a question; it must never submit the
                      // surrounding form, and the Enter that finishes Korean
                      // composition must not add a half-typed question.
                      e.preventDefault();
                      if (!isImeComposing(e)) addDraftQuestion();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("질문 추가")}
                  onClick={addDraftQuestion}
                  disabled={!newQuestion.trim()}
                >
                  <Icon name="plus" size={17} />
                </Button>
              </div>
            </div>
            <ErrorNotice error={prepForm.error} />
          </DialogBody>
          <SaveActions
            saving={prepForm.saving}
            onCancel={() => setPreparing(false)}
            label={t("준비 저장")}
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={metaForm.saving}
        open={editingMeta}
        onOpenChange={setEditingMeta}
        title={t("미팅 정보 편집")}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void metaForm.perform(async () => {
              if (!meta.title.trim())
                throw new Error(t("미팅 이름을 입력해 주세요."));
              await save("meetings", {
                ...metaBase.current,
                title: meta.title.trim(),
                date: meta.date || null,
                time: meta.date && meta.time ? meta.time : null,
                status: meta.status,
              });
              setEditingMeta(false);
              toast.success(t("미팅 정보를 저장했어요"));
            });
          }}
        >
          <DialogBody>
            <LabeledInput
              label={t("미팅 이름")}
              required
              value={meta.title}
              onChange={(title) => setMeta((v) => ({ ...v, title }))}
            />
            <div className="form-grid">
              <LabeledInput
                label={t("날짜")}
                type="date"
                value={meta.date}
                onChange={(date) => setMeta((v) => ({ ...v, date }))}
              />
              <LabeledInput
                label={t("시각")}
                type="time"
                value={meta.time}
                onChange={(time) => setMeta((v) => ({ ...v, time }))}
                disabled={!meta.date}
              />
            </div>
            <label className="field">
              <span className="field-name">{t("미팅 상태")}</span>
              <SelectField
                className="native-select"
                value={meta.status}
                onChange={(e) =>
                  setMeta((v) => ({
                    ...v,
                    status: e.target.value as Meeting["status"],
                  }))
                }
              >
                {Object.entries(meetingLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </label>
            <p className="student-inline-note">
              {t("날짜나 상태를 바꿔도 고른 할 일의 기한은 바뀌지 않아요.")}
            </p>
            <ErrorNotice error={metaForm.error} />
          </DialogBody>
          <SaveActions
            saving={metaForm.saving}
            onCancel={() => setEditingMeta(false)}
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={entryForm.saving}
        open={entry !== null}
        onOpenChange={(open) => {
          if (!open) setEntry(null);
        }}
        description={
          entryFrom === "memo"
            ? t("메모에서 고른 문장을 채워 뒀어요. 확인하고 저장하세요.")
            : entryFrom === "transcript"
              ? t("전사문에서 고른 문장을 채워 뒀어요. 확인하고 저장하세요.")
              : editingDecision
                ? undefined
                : t("내용을 적고 저장하세요.")
        }
        title={
          entry === "feedback"
            ? t("피드백 직접 추가")
            : entry === "decision"
              ? editingDecision
                ? t("결정 사항 편집")
                : t("결정 사항 추가")
              : t("질문 추가")
        }
      >
        <form noValidate onSubmit={storeEntry}>
          <DialogBody>
            {entry === "feedback" && (
              <LabeledInput
                label={t("제목")}
                required
                value={entryTitle}
                onChange={setEntryTitle}
              />
            )}
            <label className="field">
              <span className="field-name">
                {t("내용")} <span className="required-mark">*</span>
              </span>
              <Textarea
                value={entryBody}
                onChange={(e) => setEntryBody(e.target.value)}
                required
                rows={5}
              />
            </label>
            {entry === "decision" && (
              <>
                <label className="field">
                  <span className="field-name">{t("이유")}</span>
                  <Textarea
                    value={entryReason}
                    maxLength={REASON_MAX}
                    onChange={(e) => setEntryReason(e.target.value)}
                    rows={2}
                    placeholder={t("왜 이렇게 정했는지 한두 문장으로 적어요.")}
                  />
                </label>
                {replaceable.length > 0 && (
                  <label className="field">
                    <span className="field-name">{t("바꾸는 이전 결정")}</span>
                    <SelectField
                      className="native-select"
                      value={entryReplaces}
                      onChange={(e) => setEntryReplaces(e.target.value)}
                    >
                      <option value="">{t("없음")}</option>
                      {replaceable.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.text.slice(0, 60)}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                )}
              </>
            )}
            {entryFrom === "transcript" && (
              <p className="transcript-notice">
                {t(
                  "전사문은 나만 보는 기록이라 여기서 만든 항목도 나만 보기로 저장돼요.",
                )}
                {entry === "feedback" &&
                  (entrySource
                    ? ` ${t("고른 문장의 녹음 위치도 함께 저장해서 피드백에서 그 구간을 들을 수 있어요.")}`
                    : ` ${t("이 문장의 녹음 위치를 찾지 못해 녹음 구간 없이 저장돼요.")}`)}
              </p>
            )}
            {!editingDecision && (
              <p className="student-footnote">
                {t("직접 작성한 항목으로 저장돼요.")}
              </p>
            )}
            <ErrorNotice error={entryForm.error} />
          </DialogBody>
          <SaveActions
            saving={entryForm.saving}
            onCancel={() => setEntry(null)}
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={taskForm.saving}
        open={taskFrom !== null}
        onOpenChange={(open) => {
          if (!open) setTaskFrom(null);
        }}
        title={t("할 일에 추가")}
        description={t(
          "결정 사항은 그대로 두고, 할 일 목록에 새 할 일을 만들어요. 기한과 우선순위는 할 일 화면에서 정할 수 있어요.",
        )}
      >
        <form noValidate onSubmit={storeTaskFrom}>
          <DialogBody>
            <LabeledInput
              label={t("할 일 이름")}
              required
              value={taskTitle}
              onChange={(value) => {
                setTaskTitle(value);
                setTaskTitleError("");
              }}
              error={taskTitleError || undefined}
              inputRef={taskTitleInput}
            />
            <p className="student-footnote">
              {t("설명에 이 미팅과 결정 사항이 함께 적혀요.")}
            </p>
            <ErrorNotice error={taskForm.error} />
          </DialogBody>
          <SaveActions
            saving={taskForm.saving}
            onCancel={() => setTaskFrom(null)}
            label={t("할 일 추가")}
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={questionForm.saving}
        open={linkQuestionId !== null}
        onOpenChange={(open) => {
          if (!open) setLinkQuestionId(null);
        }}
        title={t("다른 미팅 준비에 추가")}
        description={t(
          "질문을 복사하지 않고 같은 질문을 추가해요. 해결 여부도 함께 바뀌어요.",
        )}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void questionForm.perform(async () => {
              const target = data.meetings.find(
                (m) => m.id === targetMeetingId,
              );
              if (!target || !linkQuestionId)
                throw new Error(t("미팅을 선택해 주세요."));
              await save("meetings", {
                ...target,
                questionIds: [
                  ...new Set([...target.questionIds, linkQuestionId]),
                ],
              });
              setLinkQuestionId(null);
              toast.success(t("선택한 미팅 준비에 질문을 추가했어요"));
            });
          }}
        >
          <DialogBody>
            <label className="field">
              <span className="field-name">{t("추가할 미팅")}</span>
              <SelectField
                className="native-select"
                value={targetMeetingId}
                onChange={(e) => setTargetMeetingId(e.target.value)}
                required
              >
                <option value="">{t("미팅 선택")}</option>
                {data.meetings
                  .filter(
                    (m) =>
                      m.researchId === researchId &&
                      m.id !== meeting.id &&
                      m.status !== "cancelled",
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} · {formatDate(m.date)}
                    </option>
                  ))}
              </SelectField>
            </label>
            <ErrorNotice error={questionForm.error} />
          </DialogBody>
          <SaveActions
            saving={questionForm.saving}
            onCancel={() => setLinkQuestionId(null)}
            label={t("추가")}
          />
        </form>
      </FormDialog>
    </div>
  );
}

/** 원문 조각 하나: 형광펜·밑줄·짚기 바탕, 끝나는 항목의 번호(04 §5.3) */
function MemoPieceView({
  piece,
  pointed,
  onOpen,
}: {
  piece: MemoPiece;
  pointed?: string | null;
  onOpen?(number: number): void;
}) {
  const className = [
    piece.anchors.length ? "memo-anchor" : "",
    pointed && piece.anchors.includes(pointed) ? "is-pointed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const body = piece.marked ? (
    <mark className={className || undefined}>{piece.text}</mark>
  ) : (
    <span className={className || undefined}>{piece.text}</span>
  );
  return (
    <>
      {body}
      {piece.numbers.map((number) => (
        <span key={number} className="memo-anchor-num">
          {onOpen ? (
            <button
              type="button"
              aria-label={t("원문 {number}번 항목 열기", { number })}
              onClick={() => onOpen(number)}
            >
              {number}
            </button>
          ) : null}
        </span>
      ))}
    </>
  );
}
