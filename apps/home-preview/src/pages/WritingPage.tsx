import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Redo2,
  RemoveFormatting,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
} from "@/lib/domain";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Choice,
  DockItem,
  VisibilityField,
  Segments,
} from "@/components/experience";
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
          삭제
        </span>
        <span>
          <i className="added" />
          추가
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
        title="글쓰기"
        description="계획서부터 원고까지, 기록과 수정 과정을 함께 남깁니다."
        actions={
          <div className="button-row">
            <Button
              disabled={creating}
              variant="outline"
              onClick={() => beginCreate("manuscript")}
            >
              원고 만들기
            </Button>
            <Button disabled={creating} onClick={() => beginCreate()}>
              <Icon name="plus" size={17} />
              계획서 만들기
            </Button>
          </div>
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
                ? "원고 만들기"
                : "연구 계획서 만들기"}
            </DialogTitle>
            <DialogDescription>
              제목을 정한 뒤 작성 공간을 만듭니다. 문서는 나만 보기로
              시작합니다.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (createType) void create(createType);
            }}
          >
            <label className="field">
              <span>문서 제목 (필수)</span>
              <Input
                autoFocus
                maxLength={160}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 연구 방법 초안"
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
                취소
              </Button>
              <Button disabled={creating || !newTitle.trim()}>
                {creating ? "만드는 중" : "문서 만들기"}
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
                  ? "연구 계획서"
                  : d.type === "manuscript"
                    ? "논문 원고"
                    : "연구 노트"}
              </span>
              <h3>{d.title}</h3>
              <p>{d.text.slice(0, 180) || "첫 문장을 시작해 보세요."}</p>
            </div>
            <div>
              <strong>{d.title}</strong>
              <small>
                {new Date(d.updatedAt).toLocaleDateString("ko-KR")} · 버전{" "}
                {
                  data.documentVersions.filter((v) => v.documentId === d.id)
                    .length
                }
                개 · {d.visibility === "shared" ? "공동 문서" : "나만 보기"}
              </small>
            </div>
          </Link>
        ))}
      </div>
      {!docs.length && !creating && (
        <EmptyState
          icon="file"
          title="연구의 첫 문장을 남겨 보세요."
          description="저장한 버전은 비교하고, 검토용 PDF로 만들 수 있습니다."
          action={
            <Button variant="outline" onClick={() => beginCreate()}>
              계획서 작성
            </Button>
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
    [from, setFrom] = useState(""),
    [to, setTo] = useState("draft"),
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
    // 도크의 눌림 상태·글자 수·표 행 추가 버튼이 커서 이동과 입력을 따라가게 한다.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: "rms-document-editor", "aria-label": "문서 본문" },
    },
    onUpdate: ({ editor }) => {
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
    if (dirty && editor)
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
  useNavigationGuard({ dirty, busy: !!busy, label: "문서 초안" });
  useEffect(() => {
    if (!restored) return;
    // 같은 id로 띄워 개발 모드 이중 실행에서도 안내가 한 번만 보이게 한다.
    toast.info("이 브라우저에 남아 있는 작성본을 복원했습니다.", {
      id: `writing-draft-${initial.id}`,
    });
  }, [restored, initial.id]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  async function persist() {
    if (!editor || !title.trim()) throw new Error("문서 제목을 적어 주세요.");
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
  const before = versionList.find((v) => v.id === from)?.text ?? "",
    after =
      to === "draft"
        ? (editor?.getText() ?? "")
        : (versionList.find((v) => v.id === to)?.text ?? "");
  return (
    <div className="writing-page">
      <header className="writing-heading">
        <div>
          <Link className="text-link" to={`/r/${initial.researchId}/writing`}>
            <Icon name="arrow-left" size={15} />
            글쓰기
          </Link>
          <input
            aria-label="문서 제목"
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
              {busy ? "저장 중" : dirty ? "저장하지 않은 변경" : "저장됨"}
            </span>
            <span>{editor?.getText().length ?? 0}자</span>
            <span>수정 {base.revision}회</span>
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
            버전
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
            검토용 PDF
          </Button>
          <Button
            disabled={!!busy || !title.trim()}
            onClick={() =>
              void action("save", async () => {
                await persist();
                toast.success("문서를 저장했습니다.");
              })
            }
          >
            {busy === "save" ? "저장 중" : "저장"}
          </Button>
        </div>
      </header>
      {error && (
        <div className="rms-error" role="alert">
          {error}
        </div>
      )}
      <div className="writing-layout">
        {outline && (
          <aside className="writing-outline">
            <h2>목차</h2>
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
                  {h || "제목 없음"}
                </button>
              ))
            ) : (
              <p>제목을 추가하면 목차가 생깁니다.</p>
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
      <div className="editor-dock-wrap">
        <div className="editor-dock" role="toolbar" aria-label="문서 서식">
          <DockItem
            label="목차 표시"
            onClick={() => setOutline(!outline)}
            active={outline}
          >
            <Icon name="menu" size={18} />
          </DockItem>
          <i />
          {[
            {
              type: "bold",
              label: "굵게",
              glyph: Bold,
              run: () => editor?.chain().focus().toggleBold().run(),
            },
            {
              type: "italic",
              label: "기울임",
              glyph: Italic,
              run: () => editor?.chain().focus().toggleItalic().run(),
            },
            {
              type: "strike",
              label: "취소선",
              glyph: Strikethrough,
              run: () => editor?.chain().focus().toggleStrike().run(),
            },
            {
              type: "heading",
              label: "소제목",
              glyph: Heading2,
              run: () =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run(),
            },
            {
              type: "bulletList",
              label: "글머리 목록",
              glyph: List,
              run: () => editor?.chain().focus().toggleBulletList().run(),
            },
            {
              type: "orderedList",
              label: "번호 목록",
              glyph: ListOrdered,
              run: () => editor?.chain().focus().toggleOrderedList().run(),
            },
            {
              type: "blockquote",
              label: "인용문",
              glyph: Quote,
              run: () => editor?.chain().focus().toggleBlockquote().run(),
            },
          ].map(({ type, label, glyph: Glyph, run }) => (
            <DockItem
              key={type}
              label={label}
              active={editor?.isActive(type)}
              onClick={run}
            >
              <Glyph size={18} />
            </DockItem>
          ))}
          <DockItem
            label="서식 지우기"
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <RemoveFormatting size={18} />
          </DockItem>
          <DockItem
            label="표 추가"
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            <Icon name="grid" size={18} />
          </DockItem>
          {editor?.isActive("table") && (
            <DockItem
              label="행 추가"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <Icon name="plus" size={18} />
            </DockItem>
          )}
          <i />
          <DockItem
            label="실행 취소"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
          >
            <Icon name="undo" size={18} />
          </DockItem>
          <DockItem
            label="다시 실행"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
          >
            <Redo2 size={18} />
          </DockItem>
          <Button
            size="sm"
            disabled={dirty || !!busy || !editor?.getText().trim()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
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
          >
            <Icon name="sparkles" size={16} />
            {editor?.state.selection.empty ? "AI 검토" : "선택 문단 검토"}
          </Button>
        </div>
        <p>
          {dirty
            ? "먼저 작성본을 저장하세요."
            : "문단을 선택하면 해당 부분만, 선택하지 않으면 저장한 본문을 검토합니다."}
        </p>
      </div>
      <Dialog
        open={!!conflict}
        onOpenChange={(v) => {
          if (!v) setConflict(null);
        }}
      >
        <DialogContent className="rms-dialog wide-dialog">
          <DialogHeader>
            <DialogTitle>다른 연구자가 먼저 저장했습니다.</DialogTitle>
            <DialogDescription>
              내 작성본은 유지됩니다. 차이를 확인하고 어느 내용으로 이어갈지
              선택하세요.
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
              최신본으로 바꾸기
            </Button>
            <Button
              onClick={() => {
                if (conflict) {
                  setBase(conflict);
                  setConflict(null);
                  setError("");
                  toast.info(
                    "내 작성본을 유지했습니다. 확인 후 저장해 주세요.",
                  );
                }
              }}
            >
              내 작성본으로 이어가기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="rms-dialog wide-dialog">
          <DialogHeader>
            <DialogTitle>문서 버전</DialogTitle>
            <DialogDescription>
              변경 이력을 비교합니다. 복원해도 이전 버전을 지우지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="comparison-selects">
            <Choice
              label="이전 버전"
              value={from}
              onChange={setFrom}
              options={[
                { value: "", label: "비교할 이전 버전 선택" },
                ...versionList.map((v) => ({
                  value: v.id,
                  label: `v${v.number} · ${new Date(v.createdAt).toLocaleString("ko-KR")}`,
                })),
              ]}
            />
            <Icon name="arrow-right" size={18} />
            <Choice
              label="이후 버전"
              value={to}
              onChange={setTo}
              options={[
                { value: "draft", label: "현재 작성본" },
                ...versionList.map((v) => ({
                  value: v.id,
                  label: `v${v.number}`,
                })),
              ]}
            />
          </div>
          {from ? (
            <TextComparison before={before} after={after} />
          ) : (
            <p className="quiet-placeholder">
              저장은 작성 중인 내용을 갱신합니다. ‘현재 버전 보존’으로 비교할
              기준을 남기면 작성 중인 내용과 비교할 수 있습니다.
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
                  toast.success("선택한 내용을 새 버전으로 복원했습니다.");
                })
              }
            >
              선택한 이전 버전으로 복원
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                void action("version", async () => {
                  const version = await keepVersion();
                  setFrom(version.id);
                  setTo("draft");
                  toast.success("보존 버전을 저장했습니다.");
                })
              }
            >
              현재 버전 보존
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
            <DialogTitle>검토용 PDF 확인</DialogTitle>
            <DialogDescription>
              페이지 나눔과 표를 확인한 뒤 자료로 등록하세요. 이 파일은 이후
              원고 변경과 별도로 보존됩니다.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <iframe
              title="생성한 검토용 PDF"
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
              닫기
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                void action("register", async () => {
                  if (!preview) return;
                  const pending = pendingPDF.current;
                  pending.material ??= await save("materials", {
                    ...recordBase(initial.researchId),
                    title: `${preview.version.title} · v${preview.version.number}`,
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
                    "보존 PDF를 등록했습니다. 수정한 내용을 이어서 적어 주세요.",
                  );
                  if (versionId)
                    navigate(
                      `/r/${initial.researchId}/results?new=1&version=${versionId}`,
                    );
                })
              }
            >
              {busy === "register" ? "등록 중" : "등록하고 수정 결과 작성"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
