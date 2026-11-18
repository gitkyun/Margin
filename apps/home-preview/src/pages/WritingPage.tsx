import { t } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MarginPanel, PanelFrame } from "@/components/margin-panel/MarginPanel";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { loadConnected, UploadConnectionError } from "@/lib/repository";
import type { Material, MaterialVersion } from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { restoreWritingDraft } from "@/lib/writing-draft";
import {
  recordBase,
  type DocumentRecord,
  type DocumentVersion,
  formatDateTime,
} from "@/lib/domain";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  EmptyState,
  InlineEmpty,
  useDisabledReason,
} from "@/components/common";
import { SectionBoundary } from "@/components/SectionBoundary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { EditorToolbar } from "./writing/EditorToolbar";
import { WordDiff } from "./writing/WordDiff";
import { AIReviewHighlight } from "./writing/ai-review";
import { useWritingReview } from "./writing/WritingReview";
import {
  AIAutocompleteGhost,
  WritingAutocomplete,
} from "./writing/WritingAutocomplete";
import { BackLink, DocumentTabs } from "./student/shared";
import { EditorHeader, Outline, type SaveState } from "./docs/EditorHeader";
import { DocInfoDialog } from "./docs/DocInfoDialog";
import { FOCUS_BODY } from "./docs/NewDocDialog";
import { editorOutline, savedTime } from "@/lib/editor-head";
import { documentFeedback, documentTasks } from "@/lib/doc-margin";
import { useOpenDetail } from "@/lib/item-detail";
import { EditorGutter, FeedbackHandled } from "./docs/EditorGutter";
import { EditorInfo } from "./docs/EditorInfo";
import type { Task } from "@/lib/domain";
import { CompareView, type CompareMode } from "./docs/CompareView";
/** 예전 이름. 낱말 비교는 writing/WordDiff에 있어요. */
export const TextComparison = WordDiff;
export function WritingPage() {
  const { researchId = "", documentId } = useParams(),
    { data, save } = useWorkspace(),
    navigate = useNavigate();
  const [params] = useSearchParams(),
    [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState<DocumentRecord["type"] | null>(
    null,
  );
  const [newTitle, setNewTitle] = useState("");
  const titleReason = useDisabledReason(
    !newTitle.trim() && t("문서 제목을 입력하면 만들 수 있어요."),
  );
  function beginCreate(type: DocumentRecord["type"] = "plan") {
    creationBase.current = null;
    setNewTitle("");
    setCreateType(type);
  }
  const creationInFlight = useRef(false);
  const creationBase = useRef<ReturnType<typeof recordBase> | null>(null);
  const docs = data.documents.filter(
    (d) => d.researchId === researchId && !d.archivedAt,
  );
  const current = docs.find((d) => d.id === documentId);
  async function create(type: DocumentRecord["type"] = "plan") {
    if (creationInFlight.current || !newTitle.trim()) return;
    creationInFlight.current = true;
    setCreating(true);
    creationBase.current ??= recordBase(researchId);
    try {
      const d = await save("documents", {
        ...creationBase.current,
        title: newTitle.trim(),
        type,
        visibility: "private",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        text: "",
        revision: 0,
      });
      setCreateType(null);
      navigate(`/r/${researchId}/writing/${d.id}`, { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      creationInFlight.current = false;
      setCreating(false);
    }
  }
  useEffect(() => {
    if (params.get("new") === "1" && !documentId) beginCreate();
  }, []);
  if (current) return <DocumentEditor key={current.id} initial={current} />;
  return (
    <div className="experience-page">
      <PageHeader
        title={t("글쓰기")}
        tabs={<DocumentTabs researchId={researchId} selected="writing" />}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger>
              {/* 문서가 없을 때는 빈 상태의 '계획서 만들기'가 주 행동이라 여기는 보조로 낮춥니다. */}
              <Button
                disabled={creating}
                variant={!docs.length ? "outline" : undefined}
              >
                <Icon name="plus" size={17} />
                {t("문서 만들기")}
                <Icon name="chevron-down" size={15} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => beginCreate()}>
                {t("계획서")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => beginCreate("manuscript")}>
                {t("원고")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Dialog
        open={createType !== null}
        onOpenChange={(open) => {
          if (!open && !creating) {
            setCreateType(null);
            navigate(`/r/${researchId}/writing`, { replace: true });
          }
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>
              {createType === "manuscript"
                ? t("원고 만들기")
                : t("연구 계획서 만들기")}
            </DialogTitle>
            <DialogDescription>
              {t("만든 문서는 처음에 나만 볼 수 있어요.")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (createType) void create(createType);
            }}
          >
            <DialogBody>
              <label className="field">
                <span>{t("문서 제목 (필수)")}</span>
                <Input
                  autoFocus
                  maxLength={160}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t("예: 연구 방법 초안")}
                />
              </label>
              {titleReason.node}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => {
                  setCreateType(null);
                  navigate(`/r/${researchId}/writing`, { replace: true });
                }}
              >
                {t("취소")}
              </Button>
              <Button
                type="submit"
                disabled={creating || !newTitle.trim()}
                aria-describedby={titleReason.describedBy}
              >
                {creating ? t("만드는 중") : t("문서 만들기")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <div className="document-grid">
        {docs.map((d) => (
          <Link
            className="document-tile"
            key={d.id}
            to={`/r/${researchId}/writing/${d.id}`}
          >
            <div className="document-tile-paper">
              <span>
                {d.type === "plan"
                  ? t("연구 계획서")
                  : d.type === "manuscript"
                    ? t("논문 원고")
                    : t("연구 노트")}
              </span>
              <h3>{d.title}</h3>
              <p>{d.text.slice(0, 180) || t("아직 내용이 없어요.")}</p>
            </div>
            <div>
              <strong title={d.title}>{d.title}</strong>
              <small>
                {t("{date} · 버전 {count}개 · {visibility}", {
                  date: formatDateTime(d.updatedAt, { time: false }),
                  count: data.documentVersions.filter(
                    (v) => v.documentId === d.id,
                  ).length,
                  visibility:
                    d.visibility === "shared" ? t("공동 문서") : t("나만 보기"),
                })}
              </small>
            </div>
          </Link>
        ))}
      </div>
      {!docs.length && !creating && (
        <EmptyState
          icon="file"
          title={t("아직 문서가 없어요")}
          points={[
            t("계획서와 원고를 쓰고 버전을 남겨요"),
            t("버전끼리 나란히 놓고 달라진 곳을 비교해요"),
            t("검토용 PDF로 만들어 자료에 등록해요"),
          ]}
          action={
            <Button onClick={() => beginCreate()}>{t("계획서 만들기")}</Button>
          }
        />
      )}
    </div>
  );
}
/** 입력을 멈추고 이만큼 지나면 자동 저장합니다. */
const AUTOSAVE_DELAY_MS = 1500;
function DocumentEditor({ initial }: { initial: DocumentRecord }) {
  const navigate = useNavigate();
  const { data, save, remove, user, upload, runAI, mode } = useWorkspace(),
    // 편집기를 만들기 전에 이 브라우저의 작성본을 읽어 초기 내용으로 쓴다.
    [restored] = useState(() => {
      try {
        return restoreWritingDraft(
          localStorage.getItem(`rms-writing-draft:${user.id}:${initial.id}`),
          initial.content,
          initial.title,
        );
      } catch {
        return null;
      }
    }),
    [base, setBase] = useState({
      ...initial,
      ...(restored?.baseUpdatedAt ? { updatedAt: restored.baseUpdatedAt } : {}),
    }),
    [title, setTitle] = useState(restored?.title ?? initial.title),
    [visibility, setVisibility] = useState(initial.visibility ?? "private"),
    [dirty, setDirty] = useState(!!restored),
    // 고칠 때마다 올라가서 자동 저장 타이머를 다시 잽니다.
    [editTick, setEditTick] = useState(0),
    [busy, setBusy] = useState(""),
    [conflict, setConflict] = useState<DocumentRecord | null>(null),
    // 여백 패널: 버전 목록과 이 문서를 넣은 목표
    [infoOpen, setInfoOpen] = useState(false),
    [infoTab, setInfoTab] = useState("versions"),
    [compareMode, setCompareMode] = useState<CompareMode>("words"),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<{
      blob: Blob;
      version: DocumentVersion;
      url: string;
    } | null>(null),
    [infoEdit, setInfoEdit] = useState(false);
  // 제목 칸 높이를 글 줄 수에 맞춥니다(폭이 바뀌어도 다시 잽니다).
  const titleField = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = titleField.current;
    if (!field) return;
    const fit = () => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(field.parentElement ?? field);
    return () => observer.disconnect();
  }, [title]);
  const pendingPDF = useRef<{
    material?: Material;
    version?: MaterialVersion;
    file?: File;
  }>({});
  const key = `rms-writing-draft:${user.id}:${initial.id}`,
    versionList = data.documentVersions
      .filter((v) => v.documentId === initial.id)
      .sort((a, b) => a.number - b.number);
  const editor = useEditor({
    extensions: [
      StarterKit,
      TableKit.configure({ table: { resizable: true } }),
      // AI 문장 점검 범위·원문 강조 및 커서 뒤 이어쓰기(꾸밈만, 문서 내용에는 남지 않아요)
      AIReviewHighlight,
      AIAutocompleteGhost,
    ],
    content: restored?.content ?? initial.content,
    // 도구 줄의 눌림 상태·글자 수·표 행 추가 버튼이 커서 이동과 입력을 따라가게 한다.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "rms-document-editor",
        "aria-label": t("문서 본문"),
      },
    },
    onUpdate: ({ editor }) => {
      if (discarded.current) return;
      setDirty(true);
      setEditTick((value) => value + 1);
      localStorage.setItem(
        key,
        JSON.stringify({
          title,
          content: editor.getJSON(),
          baseUpdatedAt: base.updatedAt,
        }),
      );
    },
  });
  useEffect(() => {
    if (dirty && editor && !discarded.current)
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            title,
            content: editor.getJSON(),
            baseUpdatedAt: base.updatedAt,
          }),
        );
      } catch {}
  }, [title, dirty, base.updatedAt]);
  const discarded = useRef(false);
  const guard = useNavigationGuard({
    dirty,
    busy: !!busy,
    label: t("문서 초안"),
    // "버리고 이동" must not leave the draft to come back on the next visit.
    onDiscard: () => {
      discarded.current = true;
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  });
  useEffect(() => {
    if (!restored) return;
    // 같은 id로 띄워 개발 모드 이중 실행에서도 안내가 한 번만 보이게 한다.
    toast.info(t("저장하지 않은 내용을 이 브라우저에서 불러왔어요."), {
      id: `writing-draft-${initial.id}`,
    });
  }, [restored, initial.id]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  function saveNow() {
    void action("save", async () => {
      await persist();
      toast.success(t("문서를 저장했어요."));
    });
  }
  // Cmd/Ctrl+S saves the document instead of opening the browser's
  // "Save page" dialog.
  const saveShortcut = useRef(saveNow);
  saveShortcut.current = () => {
    if (!busy && dirty && title.trim()) saveNow();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        saveShortcut.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // 자동 저장(결정 D3): 입력을 멈추고 잠시 뒤 저장합니다. 버전은 따로 남겨요.
  // 실패하거나 충돌이 나면 다음 입력까지 다시 시도하지 않습니다.
  const failedTick = useRef(-1);
  useEffect(() => {
    if (!dirty || busy || conflict || !title.trim()) return;
    if (failedTick.current === editTick) return;
    const tick = editTick;
    const timer = setTimeout(() => {
      void action("save", async () => {
        try {
          await persist();
        } catch (e) {
          failedTick.current = tick;
          throw e;
        }
      });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, editTick, busy, conflict, title]);
  async function persist() {
    if (!editor || !title.trim())
      throw new Error(t("문서 제목을 적어 주세요."));
    const input = {
      ...base,
      title: title.trim(),
      visibility,
      content: editor.getJSON(),
      text: editor.getText(),
    };
    let value: DocumentRecord;
    try {
      value = await save("documents", input);
    } catch (e) {
      // 오류 응답이 유실되어도 최신본과 작성본을 대조한다. 작성 중 내용은 유지한다.
      const latest = await loadConnected().catch(() => null);
      const stored = latest?.documents.find((d) => d.id === base.id);
      if (
        stored &&
        stored.title === input.title &&
        stored.visibility === input.visibility &&
        JSON.stringify(stored.content) === JSON.stringify(input.content)
      )
        value = stored;
      else {
        if (stored && stored.updatedAt !== base.updatedAt) setConflict(stored);
        throw e;
      }
    }
    setBase(value);
    // 저장하는 동안 더 쓴 내용이 있으면 '저장하지 않은 변경'으로 남겨 다음 자동 저장이 맡아요.
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(input.content)) {
      setDirty(false);
      localStorage.removeItem(key);
    }
    return value;
  }
  async function action(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  // 여백 패널의 AI 문장 점검(교차 #3). 연구 도우미 화면으로 이동하지 않아요.
  const review = useWritingReview({
    editor,
    researchId: initial.researchId,
    documentId: initial.id,
    savedTitle: base.title,
    savedRevision: base.revision,
    dirty,
    busy: !!busy,
    saveFirst: async () => {
      await persist();
    },
  });
  /**
   * 검토용 PDF를 내려받거나 다시 올리지 않고 바로 자료(PDF)로 등록해요(기존 업로드 함수 재사용).
   * stay: 글쓰기에 남고 알림에서 수정 결과로 이어 갈 수 있어요. result: 바로 수정 결과 쓰기로 가요.
   * 실패하면 이미 만든 자료·올린 파일을 기억해 두고 다시 누르면 이어서 등록해요.
   */
  function registerPDF(next: "stay" | "result") {
    return action(`register-${next}`, async () => {
      if (!preview) return;
      const pending = pendingPDF.current;
      pending.material ??= await save("materials", {
        ...recordBase(initial.researchId),
        title: t("{title} · 문서 v{number}", {
          title: preview.version.title,
          number: preview.version.number,
        }),
        type: "draft",
        visibility,
      });
      pending.file ??= new File(
        [preview.blob],
        `${title.replace(/[\\/]/g, "_")}_v${preview.version.number}.pdf`,
        { type: "application/pdf" },
      );
      try {
        if (pending.version) await save("versions", pending.version);
        else pending.version = await upload(pending.file, pending.material);
      } catch (e) {
        if (e instanceof UploadConnectionError)
          pending.version = e.uploadedVersion;
        throw e;
      }
      const versionId = pending.version?.id;
      const materialId = pending.material.id;
      pendingPDF.current = {};
      setPreview(null);
      const resultHref = `/r/${initial.researchId}/results?new=1&version=${versionId}`;
      if (next === "result" && versionId) {
        toast.success(
          t("PDF를 자료로 등록했어요. 수정 결과에 고친 내용을 적어 주세요."),
        );
        navigate(resultHref);
        return;
      }
      toast.success(t("PDF를 자료로 등록했어요."), {
        action: versionId
          ? {
              label: t("수정 결과 쓰기"),
              onClick: () => navigate(resultHref),
            }
          : {
              label: t("자료 보기"),
              onClick: () =>
                navigate(`/r/${initial.researchId}/materials/${materialId}`),
            },
      });
    });
  }
  async function keepVersion() {
    const d = await persist();
    const v = await save("documentVersions", {
      ...recordBase(d.researchId),
      documentId: d.id,
      title: d.title,
      number: 0,
      content: d.content,
      text: d.text,
    });
    return v;
  }
  const outline = editor ? editorOutline(editor.getJSON()) : [];
  // 여백(05 §3.5): 이 글을 고칠 할 일과 딸린 피드백
  const openDetail = useOpenDetail();
  const paper = useRef<HTMLDivElement>(null);
  const marginTasks = documentTasks(data.tasks, initial.id);
  const marginFeedback = documentFeedback(marginTasks, data.feedback);
  const feedbackNumbers = new Map(
    marginFeedback.map((item) => [item.feedback.id, item.number]),
  );
  function toggleTask(task: Task) {
    void save("tasks", {
      ...task,
      status: task.status === "done" ? "todo" : "done",
    }).catch((e: Error) => toast.error(e.message));
  }
  // 할 일 상세의 [글 열기]는 `?at=제목`으로 그 제목 위치를 엽니다(06 항목 상세 '고칠 글').
  const [searchParams, setSearchParams] = useSearchParams();
  const at = searchParams.get("at");
  // 새 글 창에서 만들고 오면 본문 첫 줄에 커서를 둡니다(05 §2.4).
  const location = useLocation();
  const focusBody = !!(location.state as Record<string, unknown> | null)?.[
    FOCUS_BODY
  ];
  useEffect(() => {
    if (!editor || !focusBody) return;
    // 새 글 창이 닫히며 포커스를 돌려놓는 일이 끝난 뒤에 옮깁니다.
    const timer = setTimeout(() => editor.commands.focus("start"), 150);
    return () => clearTimeout(timer);
  }, [editor, focusBody]);
  useEffect(() => {
    if (!editor || !at) return;
    const index = outline.findIndex((entry) => entry.text === at);
    if (index >= 0) requestAnimationFrame(() => scrollToHeading(index));
  }, [editor, at]);
  function scrollToHeading(index: number) {
    const el = document.querySelectorAll(
      ".rms-document-editor h1,.rms-document-editor h2,.rms-document-editor h3",
    )[index];
    el?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
  }
  const saveState: SaveState =
    busy === "save"
      ? "saving"
      : error && dirty
        ? "failed"
        : dirty
          ? "dirty"
          : "saved";
  function makePDF() {
    void action("pdf", async () => {
      const version = await keepVersion(),
        { documentPDF } = await import("@/lib/document-pdf"),
        blob = await documentPDF(version);
      pendingPDF.current = {};
      setPreview({ blob, version, url: URL.createObjectURL(blob) });
    });
  }
  /** 보관(05 §3.3 ⋯ › 보관): 쓰던 내용을 먼저 저장하고 목록으로 돌아가 6초 되돌리기를 띄웁니다. */
  function archive() {
    void action("archive", async () => {
      if (dirty) await persist();
      guard.clear();
      const listHref = `/r/${initial.researchId}/docs`;
      navigate(listHref);
      try {
        await remove("documents", initial.id);
      } catch (e) {
        // 화면을 떠났으니 오류 줄 대신 알림으로 알려요.
        toast.error((e as Error).message);
        return;
      }
      toast.success(t("보관했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => {
            const latest =
              data.documents.find((d) => d.id === initial.id) ?? base;
            void save("documents", { ...latest, archivedAt: undefined })
              .then(() => toast.success(t("복원했어요.")))
              .catch((e: Error) => toast.error(e.message));
          },
        },
      });
    });
  }
  // 정보 보기(05 §3.8): 여백 자리에 300px 정보 열(`?side=info`).
  const sideInfo = searchParams.get("side") === "info";
  function setSideInfo(on: boolean) {
    const next = new URLSearchParams(searchParams);
    if (on) next.set("side", "info");
    else next.delete("side");
    setSearchParams(next);
  }
  // 비교 보기(05 §3.7): 버전을 고르면 본문 자리가 비교 보기로 바뀝니다(`?compare=`).
  const compareVersion = versionList.find(
    (v) => v.id === searchParams.get("compare"),
  );
  function openCompare(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set("compare", id);
    setSearchParams(next);
  }
  function closeCompare() {
    const next = new URLSearchParams(searchParams);
    next.delete("compare");
    setSearchParams(next);
  }
  /** 고른 버전 내용으로 되살리고 그 내용을 새 버전으로 남깁니다. 지금 내용은 지우지 않습니다. */
  function restoreVersion(v: DocumentVersion) {
    void action("restore", async () => {
      // 지금 내용이 어느 버전에도 없으면 먼저 버전으로 남겨 사라지지 않게 합니다.
      let current = base;
      const latest = versionList.at(-1);
      if (dirty || !latest || latest.text !== (editor?.getText() ?? "")) {
        current = await persist();
        await save("documentVersions", {
          ...recordBase(current.researchId),
          documentId: current.id,
          title: current.title,
          number: 0,
          content: current.content,
          text: current.text,
        });
      }
      const saved = await save("documents", {
        ...current,
        title: v.title,
        content: v.content,
        text: v.text,
      });
      await save("documentVersions", {
        ...recordBase(saved.researchId),
        documentId: saved.id,
        title: saved.title,
        number: 0,
        content: saved.content,
        text: saved.text,
      });
      setBase(saved);
      setTitle(saved.title);
      editor?.commands.setContent(saved.content);
      setDirty(false);
      localStorage.removeItem(key);
      closeCompare();
      toast.success(
        t("v{number} 내용으로 되돌리고 새 버전으로 남겼어요.", {
          number: v.number,
        }),
      );
    });
  }
  return (
    <div className="writing-page editor-page">
      {/* 휴대폰 폭에서는 열어 둔 탭 줄이 없어 뒤로 가기로 목록에 갑니다(05 §3.1). */}
      <span className="editor-back">
        <BackLink to={`/r/${initial.researchId}/docs`}>{t("글·자료")}</BackLink>
      </span>
      <EditorHeader
        titleField={
          <>
            {/* 긴 제목은 줄을 바꿔 다 보이게 자동 높이 textarea로 둡니다.
                제목은 한 줄 값이라 Enter는 줄바꿈을 넣지 않고, 붙여넣은 줄바꿈은 공백으로 바꿔요. */}
            <textarea
              ref={titleField}
              rows={1}
              aria-label={t("문서 제목")}
              className="document-title-input"
              value={title}
              maxLength={300}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  e.preventDefault();
              }}
              onChange={(e) => {
                setTitle(e.target.value.replace(/\r\n|\r|\n/g, " "));
                setDirty(true);
                setEditTick((value) => value + 1);
              }}
            />
          </>
        }
        type={base.type}
        save={saveState}
        savedAt={savedTime(base.updatedAt)}
        onRetry={saveNow}
        visibility={visibility}
        onVisibility={(v) => {
          setVisibility(v);
          setDirty(true);
          setEditTick((value) => value + 1);
        }}
        outline={outline}
        onOutline={scrollToHeading}
        versions={versionList}
        onKeepVersion={() =>
          void action("version", async () => {
            await keepVersion();
            toast.success(t("지금 내용을 저장하고 새 버전으로 남겼어요."));
          })
        }
        onOpenVersion={openCompare}
        review={{
          disabled: dirty || !!busy || !editor?.getText().trim(),
          hint: dirty
            ? t("저장한 뒤에 AI 문장 점검을 할 수 있어요.")
            : t(
                "일부를 선택하면 그 부분만, 선택하지 않으면 저장한 문서 전체를 검토해요.",
              ),
          selection: editor?.state.selection.empty === false,
          onStart: () => {
            // 이동하지 않고 오른쪽 여백 패널에서 점검해요. 선택한 문단이 있으면 그 원문만 보내요.
            if (!review.start()) return;
            setInfoTab("review");
            setInfoOpen(true);
          },
        }}
        onEditInfo={() => setInfoEdit(true)}
        onShowInfo={() => setSideInfo(true)}
        onPdf={makePDF}
        onArchive={archive}
        busy={!!busy}
      />
      {error && (
        <div className="rms-error" role="alert">
          {error}
        </div>
      )}
      {/* 비교 보기 중에는 서식 도구가 숨은 본문을 고치지 않게 감춥니다. */}
      {!compareVersion && (
        <>
          <EditorToolbar editor={editor} />
          <FeedbackHandled
            items={marginFeedback}
            onOpen={(id) => openDetail({ kind: "feedback", id })}
          />
        </>
      )}
      <div className="editor-body">
        <nav className="editor-outline" aria-label={t("목차")}>
          <h2>{t("목차")}</h2>
          <Outline entries={outline} onPick={scrollToHeading} />
        </nav>
        {compareVersion && (
          <CompareView
            version={compareVersion}
            current={editor?.getText() ?? ""}
            mode={compareMode}
            onMode={setCompareMode}
            busy={!!busy}
            onRestore={() => restoreVersion(compareVersion)}
            onClose={closeCompare}
          />
        )}
        {/* 비교하는 동안에도 본문 편집기는 그대로 두어 쓰던 내용·되돌리기 기록이 남습니다. */}
        <div className="editor-sheet" hidden={!!compareVersion}>
          <div className="writing-paper" ref={paper}>
            {review.selectionBar}
            <SectionBoundary>
              <EditorContent editor={editor} />
            </SectionBoundary>
            <WritingAutocomplete
              editor={editor}
              researchId={initial.researchId}
              documentId={initial.id}
              title={base.title}
              revision={base.revision}
              dirty={dirty}
              saveFirst={async () => {
                // 자동 저장과 겹치지 않게 저장하는 동안 busy로 표시해요.
                setBusy("save");
                try {
                  return await persist();
                } catch (e) {
                  setError((e as Error).message);
                  throw e;
                } finally {
                  setBusy("");
                }
              }}
              disabled={
                mode === "preview" || !!busy || !editor?.getText().trim()
              }
              preview={mode === "preview"}
              runAI={runAI}
            />
          </div>
          {sideInfo ? (
            <EditorInfo
              researchId={initial.researchId}
              documentId={initial.id}
              tasks={marginTasks}
              feedback={marginFeedback}
              onToggle={toggleTask}
              onOpenTask={(id) => openDetail({ kind: "task", id })}
              onOpenFeedback={(id) => openDetail({ kind: "feedback", id })}
              onClose={() => setSideInfo(false)}
            />
          ) : (
            <EditorGutter
              paper={paper}
              tasks={marginTasks}
              headings={outline.map((entry) => entry.text).filter(Boolean)}
              numbers={feedbackNumbers}
              onToggle={toggleTask}
              onOpenTask={(id) => openDetail({ kind: "task", id })}
              onOpenFeedback={(id) => openDetail({ kind: "feedback", id })}
            />
          )}
        </div>
      </div>
      <p className="editor-status">
        {t("{count}자", {
          count: (editor?.getText().length ?? 0).toLocaleString(),
        })}
        <span aria-hidden="true">·</span>
        {t("버전 {count}개", { count: versionList.length })}
        <span aria-hidden="true">·</span>
        {t("마지막 저장 {time}", { time: savedTime(base.updatedAt) })}
      </p>
      <DocInfoDialog
        open={infoEdit}
        onOpenChange={setInfoEdit}
        document={base}
        folders={data.folders.filter(
          (f) => f.researchId === initial.researchId && !f.archivedAt,
        )}
        onSave={async ({ type, folderId }) => {
          // 제목은 머리에서 고치므로 여기서는 종류와 폴더만 저장합니다.
          const saved = await save("documents", { ...base, type, folderId });
          setBase(saved);
          toast.success(t("글 정보를 저장했어요."));
        }}
      />
      <MarginPanel
        label={t("버전·문장 점검")}
        open={infoOpen}
        onOpen={() => setInfoOpen(true)}
        onClose={() => setInfoOpen(false)}
      >
        <PanelFrame
          title={t("이 문서")}
          onClose={() => setInfoOpen(false)}
          tab={infoTab}
          onTab={setInfoTab}
          tabs={[
            { value: "versions", label: t("버전"), count: versionList.length },
            { value: "review", label: t("AI 문장 점검") },
          ]}
        >
          {/* 다른 탭을 봐도 실행 중인 점검과 제안이 사라지지 않게 숨기기만 해요. */}
          <div hidden={infoTab !== "review"}>{review.panel}</div>
          {infoTab === "versions" && (
            <div className="panel-frame-body">
              {[...versionList].reverse().map((v) => (
                <button
                  type="button"
                  className="student-simple-row writing-version-row"
                  key={v.id}
                  disabled={!!busy}
                  onClick={() => openCompare(v.id)}
                >
                  <span className="grow">
                    <strong>v{v.number}</strong>
                    <small>{formatDateTime(v.createdAt)}</small>
                  </span>
                  <Icon name="chevron-right" size={15} />
                </button>
              ))}
              {!versionList.length && (
                <InlineEmpty>
                  {t(
                    "아직 남긴 버전이 없어요. ‘버전’에서 지금 내용을 버전으로 남길 수 있어요.",
                  )}
                </InlineEmpty>
              )}
              <p className="panel-frame-note">
                {t(
                  "버전을 누르면 지금 작성 중인 내용과 비교해요. 저장만으로는 버전이 생기지 않아요.",
                )}
              </p>
            </div>
          )}
        </PanelFrame>
      </MarginPanel>
      {review.dialog}
      <Dialog
        open={!!conflict}
        onOpenChange={(v) => {
          if (!v) setConflict(null);
        }}
      >
        <DialogContent className="rms-dialog wide-dialog">
          <DialogHeader>
            <DialogTitle>
              {t("다른 창이나 공동연구자가 먼저 저장했어요")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "내가 쓴 내용은 아직 그대로 있어요. 저장된 내용으로 바꾸면 이 내용은 사라지니, 달라진 부분을 확인하고 선택해 주세요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <TextComparison
              before={conflict?.text ?? ""}
              after={editor?.getText() ?? ""}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (conflict) {
                  setBase(conflict);
                  setTitle(conflict.title);
                  editor?.commands.setContent(conflict.content);
                  setDirty(false);
                  localStorage.removeItem(key);
                  setConflict(null);
                  setError("");
                }
              }}
            >
              {t("저장된 내용으로 바꾸기")}
            </Button>
            <Button
              onClick={() => {
                if (conflict) {
                  setBase(conflict);
                  setConflict(null);
                  setError("");
                  toast.info(
                    t(
                      "내가 쓴 내용을 유지했어요. 저장하면 먼저 저장된 내용을 덮어써요.",
                    ),
                  );
                }
              }}
            >
              {t("내가 쓴 내용 유지")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!preview}
        onOpenChange={(v) => {
          if (!busy && !v) setPreview(null);
        }}
      >
        <DialogContent className="rms-dialog wide-dialog">
          <DialogHeader>
            <DialogTitle>{t("검토용 PDF 미리보기")}</DialogTitle>
            <DialogDescription>
              {t(
                "지금 내용을 새 버전으로 남기고 만든 PDF예요. 자료로 등록한 PDF는 문서를 더 고쳐도 바뀌지 않아요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {preview && (
              <iframe
                title={t("검토용 PDF 미리보기")}
                src={preview.url}
                className="pdf-export-preview"
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => setPreview(null)}
            >
              {t("닫기")}
            </Button>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => void registerPDF("stay")}
            >
              {busy === "register-stay" ? t("등록 중") : t("자료에 등록")}
            </Button>
            <Button
              disabled={!!busy}
              onClick={() => void registerPDF("result")}
            >
              {busy === "register-result"
                ? t("등록 중")
                : t("등록하고 수정 결과 쓰기")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
