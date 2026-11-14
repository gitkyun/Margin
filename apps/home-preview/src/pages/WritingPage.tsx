import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { MarginPanel, PanelFrame } from "@/components/margin-panel/MarginPanel";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { diffWords, diffChars } from "diff";
import {
  Link,
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
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Choice, VisibilityField, Segments } from "@/components/experience";
import { EditorToolbar } from "./writing/EditorToolbar";
import {
  VersionCompareSlider,
  VersionSheet,
} from "@/components/VersionCompareSlider";
export function TextComparison({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const changes = diffWords(before, after, {
    intlSegmenter: new Intl.Segmenter("ko", { granularity: "word" }),
  });
  return (
    <div className="text-comparison">
      <div className="diff-legend">
        <span>
          <i className="removed" />
          {t("삭제")}
        </span>
        <span>
          <i className="added" />
          {t("추가")}
        </span>
      </div>
      <div className="diff-content">
        {changes.map((c, i) =>
          c.added ? (
            <ins key={i}>{c.value}</ins>
          ) : c.removed ? (
            <del key={i}>{c.value}</del>
          ) : (
            <span key={i}>{c.value}</span>
          ),
        )}
      </div>
    </div>
  );
}
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
            <div className="form-actions">
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
              <Button type="submit" disabled={creating || !newTitle.trim()}>
                {creating ? t("만드는 중") : t("문서 만들기")}
              </Button>
            </div>
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
              <strong>{d.title}</strong>
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
function DocumentEditor({ initial }: { initial: DocumentRecord }) {
  const navigate = useNavigate();
  const { data, save, user, upload } = useWorkspace(),
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
    [busy, setBusy] = useState(""),
    [conflict, setConflict] = useState<DocumentRecord | null>(null),
    [versionsOpen, setVersionsOpen] = useState(false),
    // 여백 패널: 버전 목록과 이 문서를 넣은 목표
    [infoOpen, setInfoOpen] = useState(false),
    [infoTab, setInfoTab] = useState("versions"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("draft"),
    [compareView, setCompareView] = useState<"changes" | "slide">("changes"),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<{
      blob: Blob;
      version: DocumentVersion;
      url: string;
    } | null>(null),
    [outline, setOutline] = useState(false);
  const pendingPDF = useRef<{
    material?: Material;
    version?: MaterialVersion;
    file?: File;
  }>({});
  const key = `rms-writing-draft:${user.id}:${initial.id}`,
    versionList = data.documentVersions
      .filter((v) => v.documentId === initial.id)
      .sort((a, b) => a.number - b.number),
    current = data.documents.find((d) => d.id === initial.id) ?? initial;
  const editor = useEditor({
    extensions: [
      StarterKit,
      TableKit.configure({ table: { resizable: true } }),
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
  useNavigationGuard({
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
    setDirty(false);
    localStorage.removeItem(key);
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
  const headings =
    editor
      ?.getJSON()
      .content?.filter((n) => n.type === "heading")
      .map(
        (n) =>
          n.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "",
      ) ?? [];
  const milestones = data.milestones.filter(
    (milestone) =>
      milestone.researchId === initial.researchId &&
      !milestone.archivedAt &&
      milestone.documentIds.includes(initial.id),
  );
  const fromVersion = versionList.find((v) => v.id === from),
    toVersion = versionList.find((v) => v.id === to),
    beforeLabel = fromVersion ? `v${fromVersion.number}` : t("이전 버전"),
    afterLabel =
      to === "draft"
        ? t("지금 쓰는 내용")
        : toVersion
          ? `v${toVersion.number}`
          : t("이후 버전");
  const before = versionList.find((v) => v.id === from)?.text ?? "",
    after =
      to === "draft"
        ? (editor?.getText() ?? "")
        : (versionList.find((v) => v.id === to)?.text ?? "");
  return (
    <div className="writing-page">
      <header className="writing-heading">
        <div>
          <Button variant="link" size="sm" asChild>
            <Link to={`/r/${initial.researchId}/writing`}>
              <Icon name="arrow-left" size={15} />
              {t("글쓰기")}
            </Link>
          </Button>
          <input
            aria-label={t("문서 제목")}
            className="document-title-input"
            value={title}
            maxLength={300}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
          <div className="writing-meta">
            <span className="writing-save-status" role="status">
              <Icon name={busy || dirty ? "clock" : "check"} size={15} />
              {busy
                ? t("저장 중")
                : dirty
                  ? t("저장하지 않은 변경")
                  : t("저장됨")}
            </span>
            <span>
              {t("{count}자", { count: editor?.getText().length ?? 0 })}
            </span>
            <span>{t("저장 {count}회", { count: base.revision })}</span>
          </div>
        </div>
        <div className="button-row">
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => {
              setFrom(versionList.at(-1)?.id ?? "");
              setVersionsOpen(true);
            }}
          >
            <Icon name="history" size={16} />
            {t("버전")}
          </Button>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              void action("pdf", async () => {
                const version = await keepVersion(),
                  { documentPDF } = await import("@/lib/document-pdf"),
                  blob = await documentPDF(version);
                pendingPDF.current = {};
                setPreview({ blob, version, url: URL.createObjectURL(blob) });
              })
            }
          >
            {t("검토용 PDF")}
          </Button>
          {/* 바뀐 것이 없으면 '저장됨' 상태와 맞게 저장 버튼을 끕니다. */}
          <Button
            disabled={!!busy || !dirty || !title.trim()}
            onClick={saveNow}
          >
            {busy === "save" ? t("저장 중") : t("저장")}
          </Button>
        </div>
      </header>
      {error && (
        <div className="rms-error" role="alert">
          {error}
        </div>
      )}
      <EditorToolbar
        editor={editor}
        outlineOpen={outline}
        onToggleOutline={() => setOutline(!outline)}
        aiDisabled={dirty || !!busy || !editor?.getText().trim()}
        aiHint={
          dirty
            ? t("저장한 뒤에 AI 검토를 할 수 있어요.")
            : t(
                "일부를 선택하면 그 부분만, 선택하지 않으면 저장한 문서 전체를 검토해요.",
              )
        }
        onAiReview={() => {
          const selection = editor?.state.selection;
          const text =
            selection && !selection.empty
              ? editor?.state.doc
                  .textBetween(selection.from, selection.to, "\n\n")
                  .trim()
              : "";
          const selectionKey = `rms-ai-selection:${user.id}:${initial.id}`;
          if (text)
            sessionStorage.setItem(
              selectionKey,
              JSON.stringify({ revision: base.revision, text }),
            );
          else sessionStorage.removeItem(selectionKey);
          navigate(
            `/r/${initial.researchId}/assistant?mode=review_writing&document=${initial.id}${text ? "&selection=1" : ""}`,
          );
        }}
      />
      <div className="writing-layout">
        {outline && (
          <aside className="writing-outline">
            <h2>{t("목차")}</h2>
            {headings.length ? (
              headings.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const el = document.querySelectorAll(
                      ".rms-document-editor h1,.rms-document-editor h2,.rms-document-editor h3",
                    )[i];
                    el?.scrollIntoView({
                      behavior: matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? "instant"
                        : "smooth",
                      block: "center",
                    });
                  }}
                >
                  {h || t("제목 없음")}
                </button>
              ))
            ) : (
              <p>{t("소제목을 넣으면 목차가 생겨요.")}</p>
            )}
            <VisibilityField
              value={visibility}
              onChange={(v) => {
                setVisibility(v);
                setDirty(true);
              }}
            />
          </aside>
        )}
        <div className="writing-paper">
          <EditorContent editor={editor} />
        </div>
      </div>
      <MarginPanel
        label={t("문서 버전과 연결된 기록")}
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
            { value: "links", label: t("연결"), count: milestones.length },
          ]}
        >
          {infoTab === "versions" && (
            <div className="panel-frame-body">
              {[...versionList].reverse().map((v) => (
                <button
                  type="button"
                  className="student-simple-row writing-version-row"
                  key={v.id}
                  disabled={!!busy}
                  onClick={() => {
                    setFrom(v.id);
                    setTo("draft");
                    setVersionsOpen(true);
                  }}
                >
                  <span className="grow">
                    <strong>v{v.number}</strong>
                    <small>{formatDateTime(v.createdAt)}</small>
                  </span>
                  <Icon name="chevron-right" size={15} />
                </button>
              ))}
              {!versionList.length && (
                <p className="student-empty-inline">
                  {t(
                    "아직 남긴 버전이 없어요. ‘버전’에서 지금 내용을 버전으로 남길 수 있어요.",
                  )}
                </p>
              )}
              <p className="panel-frame-note">
                {t(
                  "버전을 누르면 지금 작성 중인 내용과 비교해요. 저장만으로는 버전이 생기지 않아요.",
                )}
              </p>
            </div>
          )}
          {infoTab === "links" && (
            <div className="panel-frame-body">
              <h3>
                {t("목표")}
                <span className="count-chip">{milestones.length}</span>
              </h3>
              {milestones.map((milestone) => (
                <Link
                  className="student-simple-row"
                  key={milestone.id}
                  to={`/r/${initial.researchId}/planning`}
                >
                  <span className="grow">
                    <strong>{milestone.title}</strong>
                    <small>
                      {milestone.status === "done" ? t("끝남") : t("진행 예정")}
                    </small>
                  </span>
                  <Icon name="chevron-right" size={15} />
                </Link>
              ))}
              {!milestones.length && (
                <p className="student-empty-inline">
                  {t("계획·일정의 목표에 이 문서를 넣으면 여기에 보여요.")}
                </p>
              )}
            </div>
          )}
        </PanelFrame>
      </MarginPanel>
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
          <TextComparison
            before={conflict?.text ?? ""}
            after={editor?.getText() ?? ""}
          />
          <div className="bottom-actions">
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
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="rms-dialog wide-dialog">
          <DialogHeader>
            <DialogTitle>{t("문서 버전")}</DialogTitle>
            <DialogDescription>
              {t(
                "되돌리면 문서가 선택한 버전 내용으로 바뀌고, 이 내용이 새 버전으로 남아요. 기존 버전은 지워지지 않아요. 지금 내용도 남기려면 먼저 ‘지금 버전 남기기’를 눌러 주세요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="comparison-selects">
            <Choice
              label={t("이전 버전")}
              value={from}
              onChange={setFrom}
              options={[
                { value: "", label: t("비교할 버전 선택") },
                ...versionList.map((v) => ({
                  value: v.id,
                  label: `v${v.number} · ${formatDateTime(v.createdAt)}`,
                })),
              ]}
            />
            <Icon name="arrow-right" size={18} />
            <Choice
              label={t("이후 버전")}
              value={to}
              onChange={setTo}
              options={[
                { value: "draft", label: t("지금 쓰는 내용") },
                ...versionList.map((v) => ({
                  value: v.id,
                  label: `v${v.number}`,
                })),
              ]}
            />
          </div>
          {from ? (
            <>
              <Segments
                label={t("비교 방식")}
                size="small"
                value={compareView}
                onChange={(next) => setCompareView(next as typeof compareView)}
                options={[
                  { value: "changes", label: t("바뀐 부분") },
                  { value: "slide", label: t("밀어서 비교") },
                ]}
              />
              {compareView === "changes" ? (
                <TextComparison before={before} after={after} />
              ) : (
                <div>
                  <div className="version-compare-scroll">
                    <VersionCompareSlider
                      label={t("{before} · {after} 비교", {
                        before: beforeLabel,
                        after: afterLabel,
                      })}
                      before={
                        <VersionSheet
                          tone="before"
                          label={beforeLabel}
                          text={before}
                        />
                      }
                      after={
                        <VersionSheet
                          tone="after"
                          label={afterLabel}
                          text={after}
                        />
                      }
                    />
                  </div>
                  <p className="version-compare-hint">
                    {t(
                      "가운데 손잡이를 끌거나, 손잡이에 포커스를 두고 좌우 방향키로 5%씩 옮겨요.",
                    )}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="quiet-placeholder">
              {t(
                "저장만 해서는 버전이 생기지 않아요. ‘지금 버전 남기기’로 버전을 남기면 이후에 고친 내용과 비교할 수 있어요.",
              )}
            </p>
          )}
          <div className="bottom-actions">
            <Button
              variant="outline"
              disabled={!from || !!busy}
              onClick={() =>
                void action("restore", async () => {
                  const v = versionList.find((v) => v.id === from)!;
                  const saved = await save("documents", {
                    ...base,
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
                  setVersionsOpen(false);
                  localStorage.removeItem(key);
                  toast.success(
                    t("v{number} 내용으로 되돌리고 새 버전으로 남겼어요.", {
                      number: v.number,
                    }),
                  );
                })
              }
            >
              {from
                ? t("v{number} 내용으로 되돌리기", {
                    number: versionList.find((v) => v.id === from)?.number,
                  })
                : t("되돌리기")}
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                void action("version", async () => {
                  const version = await keepVersion();
                  setFrom(version.id);
                  setTo("draft");
                  toast.success(
                    t("지금 내용을 저장하고 새 버전으로 남겼어요."),
                  );
                })
              }
            >
              {t("지금 버전 남기기")}
            </Button>
          </div>
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
          {preview && (
            <iframe
              title={t("검토용 PDF 미리보기")}
              src={preview.url}
              className="pdf-export-preview"
            />
          )}
          <div className="bottom-actions">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => setPreview(null)}
            >
              {t("닫기")}
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                void action("register", async () => {
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
                    if (pending.version)
                      await save("versions", pending.version);
                    else
                      pending.version = await upload(
                        pending.file,
                        pending.material,
                      );
                  } catch (e) {
                    if (e instanceof UploadConnectionError)
                      pending.version = e.uploadedVersion;
                    throw e;
                  }
                  const versionId = pending.version?.id;
                  pendingPDF.current = {};
                  setPreview(null);
                  toast.success(
                    t(
                      "PDF를 자료로 등록했어요. 수정 결과에 고친 내용을 적어 주세요.",
                    ),
                  );
                  if (versionId)
                    navigate(
                      `/r/${initial.researchId}/results?new=1&version=${versionId}`,
                    );
                })
              }
            >
              {busy === "register"
                ? t("등록 중")
                : t("등록하고 수정 결과 쓰기")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
