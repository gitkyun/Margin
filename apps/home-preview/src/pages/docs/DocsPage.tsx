import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MaterialFolders } from "@/components/MaterialFolders";
import { MaterialPreviewBadge } from "@/components/MaterialPreviewBadge";
import { useWorkspace } from "@/lib/workspace";
import { koreanScore } from "@/lib/hangul-search";
import { friendlyError } from "@/lib/supabase";
import { formatDate, type DocumentRecord, type Material } from "@/lib/domain";
import {
  docCounts,
  docRows,
  documentOutline,
  folderPath,
  type DocRow,
  type DocsKind,
  type DocsSort,
  type DocsView,
} from "@/lib/docs-list";
import { DocInfoDialog } from "./DocInfoDialog";
import { MaterialInfoDialog, MoveFolderDialog } from "./MaterialView";
import { NewDocDialog } from "./NewDocDialog";
import { useMaterialUpload } from "./MaterialUpload";
import { useFileDrop } from "@/lib/use-file-drop";
import "./docs.css";

const MATERIAL_TYPES = [
  "draft",
  "reference",
  "analysis",
  "other",
  "link",
] as const;

function documentTypeLabel(type: DocumentRecord["type"]): string {
  return { plan: t("계획서"), manuscript: t("원고"), note: t("메모") }[type];
}
function materialTypeLabel(type: Material["type"] | "link"): string {
  return {
    draft: t("초안"),
    reference: t("참고"),
    analysis: t("분석"),
    other: t("기타"),
    link: t("링크"),
  }[type];
}
function sinceLabel(at: string): string {
  const diff = Date.now() - new Date(at).getTime();
  if (!Number.isFinite(diff)) return "";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("방금");
  if (minutes < 60) return t("{count}분 전", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{count}시간 전", { count: hours });
  return formatDate(at.slice(0, 10));
}
function domainOf(url?: string): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}

/**
 * 글·자료 목록(IA v2 05 §2, W1). 글과 자료를 한 목록에서 찾고, 만들고, 올리고, 폴더로 정리합니다.
 * 주소: kind=writing|material, folder=<id>|archived, type(자료 종류), q, sort=name.
 */
export function DocsPage() {
  const { researchId = "" } = useParams();
  const { data, save, remove } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const rawKind = params.get("kind");
  const kind: DocsKind =
    rawKind === "writing" || rawKind === "material" ? rawKind : "all";
  const folder = params.get("folder") ?? "";
  const rawType = params.get("type") ?? "";
  const type = (MATERIAL_TYPES as readonly string[]).includes(rawType)
    ? (rawType as DocsView["type"])
    : "";
  const query = params.get("q") ?? "";
  const sort: DocsSort = params.get("sort") === "name" ? "name" : "recent";
  const base = `/r/${researchId}/docs`;
  const rows = docRows(
    data,
    researchId,
    { kind, folder, type: kind === "material" ? type : "", query, sort },
    (text, q) => koreanScore(text, q) > 0,
  );
  const counts = docCounts(data, researchId);
  const archivedView = folder === "archived";
  const folderTitle =
    folder && !archivedView ? folderPath(data.folders, folder) : "";
  const preview = rows.find((row) => `${row.kind}:${row.id}` === selected);
  // 줄 메뉴의 폴더로 옮기기·정보 편집, 머리의 [새 글](05 §2.3, §2.4)
  const [moving, setMoving] = useState<DocRow | null>(null);
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [creating, setCreating] = useState(false);
  const folders = data.folders.filter(
    (f) => f.researchId === researchId && !f.archivedAt,
  );
  // 올리기 창(05 §2.5): [올리기]로 열거나, 판 어디에든 PDF를 끌어 오면 그 파일이 든 채로 엽니다.
  const uploader = useMaterialUpload(researchId);
  const uploadFolder = folder && !archivedView ? folder : undefined;
  const drop = useFileDrop({
    noClick: true,
    noKeyboard: true,
    onSelect: (file) => uploader.start({ file, folderId: uploadFolder }),
    onError: (message) => {
      if (message) toast.error(message);
    },
  });
  // 열어 둔 탭 줄의 [+]는 ?new=1로 와서 새 글 창을 엽니다.
  useEffect(() => {
    if (params.get("new") !== "1") return;
    setCreating(true);
    set({ new: null });
  }, [params]);

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch))
      if (value) next.set(key, value);
      else next.delete(key);
    setParams(next, { replace: true });
  }
  const hrefOf = (row: DocRow) =>
    row.kind === "writing" ? `${base}/w/${row.id}` : `${base}/m/${row.id}`;

  async function archive(row: DocRow) {
    try {
      await remove(row.kind === "writing" ? "documents" : "materials", row.id);
      toast.success(t("보관했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => void restore(row),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  /** 글·자료의 폴더를 바꿉니다. 지금 기록을 다시 읽어 다른 칸을 덮지 않습니다. */
  async function moveTo(row: DocRow, folderId: string | undefined) {
    try {
      if (row.kind === "writing") {
        const current =
          data.documents.find((d) => d.id === row.id) ?? row.document;
        if ((current.folderId ?? undefined) === folderId) return;
        await save("documents", { ...current, folderId });
      } else {
        const current =
          data.materials.find((m) => m.id === row.id) ?? row.material;
        if ((current.folderId ?? undefined) === folderId) return;
        await save("materials", { ...current, folderId });
      }
      const target = folders.find((f) => f.id === folderId);
      toast.success(
        target
          ? t("‘{title}’을 ‘{folder}’ 폴더로 옮겼어요.", {
              title: row.title,
              folder: target.title,
            })
          : t("‘{title}’을 폴더에서 뺐어요.", { title: row.title }),
      );
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function restore(row: DocRow) {
    try {
      if (row.kind === "writing") {
        const current =
          data.documents.find((d) => d.id === row.id) ?? row.document;
        await save("documents", { ...current, archivedAt: undefined });
      } else {
        const current =
          data.materials.find((m) => m.id === row.id) ?? row.material;
        await save("materials", { ...current, archivedAt: undefined });
      }
      toast.success(t("복원했어요."));
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  const heading = archivedView
    ? t("보관함")
    : folderTitle ||
      (kind === "writing"
        ? t("글")
        : kind === "material"
          ? t("자료")
          : t("글·자료"));

  return (
    <div
      {...drop.getRootProps({ className: "docs-frame" })}
      data-dropping={drop.isDragActive ? "" : undefined}
    >
      <input {...drop.getInputProps()} />
      {drop.isDragActive && (
        <div className="docs-drop-hint" aria-hidden>
          <Icon name="upload" size={20} />
          {t("놓으면 올리기 창이 열려요")}
        </div>
      )}
      <div className="docs-layout" data-preview={preview ? "" : undefined}>
        <nav className="docs-side" aria-label={t("글·자료 분류")}>
          {(
            [
              ["all", t("전체"), counts.all, "list"],
              ["writing", t("글"), counts.writing, "edit"],
              ["material", t("자료"), counts.material, "file"],
            ] as const
          ).map(([value, label, count, icon]) => (
            <button
              key={value}
              type="button"
              className="docs-side-item"
              aria-pressed={kind === value && !folder}
              onClick={() =>
                set({
                  kind: value === "all" ? null : value,
                  folder: null,
                  type: null,
                })
              }
            >
              <Icon name={icon} size={16} />
              <span>{label}</span>
              <small>{count}</small>
            </button>
          ))}
          <MaterialFolders
            embedded
            researchId={researchId}
            value={archivedView ? "" : folder}
            onChange={(value) => set({ folder: value || null, type: null })}
          />
          <button
            type="button"
            className="docs-side-item"
            aria-pressed={archivedView}
            onClick={() => set({ folder: "archived", kind: null, type: null })}
          >
            <Icon name="archive" size={16} />
            <span>{t("보관함")}</span>
            <small>{counts.archived}</small>
          </button>
        </nav>
        <section className="docs-main" aria-label={heading}>
          <div className="docs-head">
            <h1>{heading}</h1>
            <div className="docs-head-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => uploader.start({ folderId: uploadFolder })}
              >
                <Icon name="upload" size={16} />
                {t("올리기")}
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} />
                {t("새 글")}
              </Button>
            </div>
          </div>
          <div className="docs-filters">
            <input
              className="docs-search"
              type="search"
              value={query}
              aria-label={t("글·자료에서 찾기")}
              placeholder={t("글·자료에서 찾기")}
              onChange={(event) => set({ q: event.target.value || null })}
            />
            {kind === "material" && (
              <select
                value={type}
                aria-label={t("자료 종류")}
                onChange={(event) => set({ type: event.target.value || null })}
              >
                <option value="">{t("모든 종류")}</option>
                {MATERIAL_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {materialTypeLabel(value)}
                  </option>
                ))}
              </select>
            )}
            <select
              value={sort}
              aria-label={t("순서")}
              onChange={(event) =>
                set({ sort: event.target.value === "name" ? "name" : null })
              }
            >
              <option value="recent">{t("최근 고친 순")}</option>
              <option value="name">{t("이름순")}</option>
            </select>
          </div>
          {uploader.node}
          <ul className="docs-rows">
            {rows.map((row) => {
              const key = `${row.kind}:${row.id}`;
              return (
                <li
                  key={key}
                  className="docs-row"
                  data-selected={selected === key ? "" : undefined}
                >
                  {archivedView ? (
                    <span className="docs-row-link">
                      <RowBody row={row} />
                    </span>
                  ) : (
                    <Link
                      className="docs-row-link"
                      to={hrefOf(row)}
                      onKeyDown={(event) => {
                        if (event.key === " ") {
                          event.preventDefault();
                          setSelected(selected === key ? null : key);
                        }
                      }}
                    >
                      <RowBody row={row} />
                    </Link>
                  )}
                  {archivedView ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void restore(row)}
                    >
                      {t("복원")}
                    </Button>
                  ) : (
                    <span className="docs-row-tools">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="docs-row-peek"
                        aria-pressed={selected === key}
                        aria-label={t("{title} 미리보기", { title: row.title })}
                        onClick={() =>
                          setSelected(selected === key ? null : key)
                        }
                      >
                        <Icon name="eye" size={16} />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("{title} 메뉴", { title: row.title })}
                          >
                            <Icon name="more" size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => navigate(hrefOf(row))}
                          >
                            {t("열기")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              window.open(hrefOf(row), "_blank", "noopener")
                            }
                          >
                            {t("새 탭에서 열기")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setMoving(row)}>
                            {t("폴더로 옮기기")}
                          </DropdownMenuItem>
                          {rowFolder(row) && (
                            <DropdownMenuItem
                              onSelect={() => void moveTo(row, undefined)}
                            >
                              {t("폴더에서 빼기")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => setEditing(row)}>
                            {t("정보 편집")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void archive(row)}>
                            {t("보관")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {!rows.length && (
            <p className="docs-empty">
              {query || type
                ? t("조건에 맞는 글이나 자료가 없어요.")
                : archivedView
                  ? t("보관한 글이나 자료가 없어요.")
                  : t("아직 글이나 자료가 없어요.")}
            </p>
          )}
        </section>
        {preview && (
          <aside className="docs-preview" aria-label={t("미리보기")}>
            <DocPreview row={preview} href={hrefOf(preview)} />
          </aside>
        )}
      </div>
      <NewDocDialog
        open={creating}
        onOpenChange={setCreating}
        researchId={researchId}
        folderId={folder && !archivedView ? folder : undefined}
      />
      <MoveFolderDialog
        open={moving !== null}
        onOpenChange={(open) => !open && setMoving(null)}
        folders={folders}
        value={moving ? rowFolder(moving) : undefined}
        onMove={async (folderId) => {
          if (moving) await moveTo(moving, folderId);
        }}
      />
      {editing?.kind === "writing" && (
        <DocInfoDialog
          open
          editTitle
          onOpenChange={(open) => !open && setEditing(null)}
          document={
            data.documents.find((d) => d.id === editing.id) ?? editing.document
          }
          folders={folders}
          onSave={async ({ title, type, folderId }) => {
            const current =
              data.documents.find((d) => d.id === editing.id) ??
              editing.document;
            await save("documents", { ...current, title, type, folderId });
            toast.success(t("글 정보를 저장했어요."));
          }}
        />
      )}
      {editing?.kind === "material" && (
        <MaterialInfoDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          material={
            data.materials.find((m) => m.id === editing.id) ?? editing.material
          }
          typeOptions={(
            ["draft", "reference", "analysis", "other"] as const
          ).map((value) => ({ value, label: materialTypeLabel(value) }))}
          onSave={async (next) => {
            await save("materials", next);
            toast.success(t("자료 정보를 저장했어요."));
          }}
        />
      )}
    </div>
  );
}

function rowFolder(row: DocRow): string | undefined {
  return row.kind === "writing" ? row.document.folderId : row.material.folderId;
}

function RowBody({ row }: { row: DocRow }) {
  if (row.kind === "writing") {
    const d = row.document;
    return (
      <>
        <Icon name="edit" size={18} />
        <span className="docs-row-copy">
          <strong>
            {d.title}
            {d.visibility === "private" && (
              <span className="docs-row-lock">
                <Icon name="lock" size={13} />
                <span className="sr-only">{t("나만 보기")}</span>
              </span>
            )}
          </strong>
          <small>
            {[documentTypeLabel(d.type), sinceLabel(d.updatedAt)].join(" · ")}
          </small>
        </span>
      </>
    );
  }
  const m = row.material;
  return (
    <>
      {m.externalUrl ? (
        <Icon name="link" size={18} />
      ) : row.latest ? (
        <MaterialPreviewBadge version={row.latest} />
      ) : (
        <Icon name="file" size={18} />
      )}
      <span className="docs-row-copy">
        <strong>{m.title}</strong>
        <small>
          {m.externalUrl
            ? [
                t("링크"),
                formatDate(m.createdAt.slice(0, 10)),
                domainOf(m.externalUrl),
              ]
                .filter(Boolean)
                .join(" · ")
            : [
                materialTypeLabel(m.type),
                formatDate((row.latest?.createdAt ?? m.createdAt).slice(0, 10)),
                row.latest ? `v${row.latest.number}` : t("파일 없음"),
              ].join(" · ")}
        </small>
      </span>
    </>
  );
}

function DocPreview({ row, href }: { row: DocRow; href: string }) {
  const { data } = useWorkspace();
  if (row.kind === "writing") {
    const d = row.document;
    const outline = documentOutline(d.content);
    return (
      <>
        <h2>{d.title}</h2>
        <p className="docs-preview-meta">
          {documentTypeLabel(d.type)} ·{" "}
          {t("{count}자", { count: d.text.length.toLocaleString() })}
        </p>
        {outline.length > 0 && (
          <ol className="docs-preview-outline">
            {outline.map((title, i) => (
              <li key={i}>{title}</li>
            ))}
          </ol>
        )}
        {d.text.trim() && (
          <p className="docs-preview-text">{d.text.slice(0, 600)}</p>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link to={href}>{t("열기")}</Link>
        </Button>
      </>
    );
  }
  const m = row.material;
  if (m.externalUrl)
    return (
      <>
        <h2>{m.title}</h2>
        <p className="docs-preview-meta docs-preview-url">{m.externalUrl}</p>
        <div className="docs-preview-actions">
          <Button variant="outline" size="sm" asChild>
            <a href={m.externalUrl} target="_blank" rel="noopener noreferrer">
              {t("링크 열기")}
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void navigator.clipboard
                .writeText(m.externalUrl!)
                .then(() => toast.success(t("링크를 복사했어요.")))
            }
          >
            {t("복사")}
          </Button>
        </div>
      </>
    );
  const versions = data.versions
    .filter((v) => v.materialId === m.id && !v.archivedAt)
    .sort((a, b) => b.number - a.number);
  return (
    <>
      <h2>{m.title}</h2>
      {versions[0] && (
        <MaterialPreviewBadge version={versions[0]} size="large" />
      )}
      <ul className="docs-preview-versions">
        {versions.map((v) => (
          <li key={v.id}>
            v{v.number} · {formatDate(v.createdAt.slice(0, 10))} ·{" "}
            {(v.size / 1048576).toFixed(1)}MB
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" asChild>
        <Link to={href}>{t("열기")}</Link>
      </Button>
    </>
  );
}
