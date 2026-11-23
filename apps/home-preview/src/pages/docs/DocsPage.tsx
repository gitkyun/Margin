import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RowContextMenu,
  RowMoreMenu,
  SwipeRow,
  rowMenuLabel,
  type RowAction,
} from "@/components/row-actions/RowActions";
import { MaterialFolders } from "@/components/MaterialFolders";
import { MaterialPreviewBadge } from "@/components/MaterialPreviewBadge";
import { useWorkspace } from "@/lib/workspace";
import { useUploadQueue } from "@/lib/upload-queue";
import { koreanScore } from "@/lib/hangul-search";
import { friendlyError } from "@/lib/supabase";
import { formatDate, kstDateKey } from "@/lib/domain";
import {
  documentTypeLabel,
  domainOf,
  materialDisplayTypeLabel,
  materialTypeLabel,
  sinceLabel,
} from "@/lib/docs-labels";
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

/**
 * 글·자료 목록(IA v2 05 §2, W1 + Wave 2 Slice 1 다중 수집).
 * 글과 자료를 한 목록에서 찾고, 만들고, 여러 PDF를 올리고, 폴더로 정리합니다.
 */
export function DocsPage() {
  const { researchId = "" } = useParams();
  const { data, user, save, remove, openFile } = useWorkspace();
  const uploadQueue = useUploadQueue();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [moving, setMoving] = useState<DocRow | null>(null);
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [creating, setCreating] = useState(false);
  const folders = data.folders.filter(
    (f) => f.researchId === researchId && !f.archivedAt,
  );
  const hasCollaborators =
    data.members.filter(
      (m) => m.researchId === researchId && m.status === "active",
    ).length > 1;
  const recentIds = uploadQueue.recentUploadedByResearch[researchId] ?? [];

  // 링크 추가 및 레거시 폴백용 기존 업로더(PDF 다중 업로드는 uploadQueue가 담당)
  const uploader = useMaterialUpload(researchId);
  const uploadFolder = folder && !archivedView ? folder : undefined;

  const drop = useFileDrop({
    maxFiles: 20,
    noClick: true,
    noKeyboard: true,
    onSelect: (file) =>
      uploadQueue.enqueueCapture([file], {
        researchId,
        folderId: uploadFolder,
        forceReview: true,
      }),
    onSelectMultiple: (files) =>
      uploadQueue.enqueueCapture(files, {
        researchId,
        folderId: uploadFolder,
        forceReview: true,
      }),
    onError: (message) => {
      if (message) toast.error(message);
    },
  });

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

  async function download(row: DocRow) {
    if (row.kind !== "material" || !row.latest) return;
    try {
      const blob = await openFile(row.latest);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = row.latest.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  /** 한 행의 동작 목록. ⋯ 메뉴·우클릭·길게 누르기·모바일 스와이프가 함께 씁니다. */
  function rowActions(row: DocRow): RowAction[] {
    if (archivedView)
      return [
        {
          id: "restore",
          label: t("되살리기"),
          icon: "undo",
          onSelect: () => void restore(row),
        },
      ];
    const list: RowAction[] = [
      {
        id: "open",
        label: t("열기"),
        icon: "file",
        onSelect: () => navigate(hrefOf(row)),
      },
      {
        id: "open-tab",
        label: t("새 탭에서 열기"),
        icon: "external",
        onSelect: () => window.open(hrefOf(row), "_blank", "noopener"),
      },
      {
        id: "edit",
        label: t("이름·정보 바꾸기"),
        icon: "edit",
        separated: true,
        onSelect: () => setEditing(row),
      },
      {
        id: "move",
        label: t("폴더로 옮기기"),
        icon: "folder",
        onSelect: () => setMoving(row),
      },
    ];
    if (rowFolder(row))
      list.push({
        id: "unfolder",
        label: t("폴더에서 빼기"),
        icon: "folder",
        onSelect: () => void moveTo(row, undefined),
      });
    if (row.kind === "material" && row.latest && !row.material.externalUrl)
      list.push({
        id: "download",
        label: t("내려받기"),
        icon: "download",
        onSelect: () => void download(row),
      });
    if (row.kind === "material" && row.material.externalUrl)
      list.push({
        id: "copy-link",
        label: t("링크 복사"),
        icon: "copy",
        onSelect: () =>
          void navigator.clipboard
            .writeText(row.material.externalUrl!)
            .then(() => toast.success(t("링크를 복사했어요."))),
      });
    list.push({
      id: "archive",
      label: t("보관"),
      icon: "trash",
      separated: true,
      swipe: "end",
      onSelect: () => void archive(row),
    });
    return list;
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="sr-only"
        aria-label={t("PDF 파일 여러 개 선택")}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (picked.length) {
            uploadQueue.enqueueCapture(picked, {
              researchId,
              folderId: uploadFolder,
              forceReview: true,
            });
          }
        }}
      />
      {drop.isDragActive && (
        <div className="docs-drop-hint" aria-hidden>
          <Icon name="upload" size={20} />
          {folderTitle
            ? t("놓으면 ‘{folder}’ 폴더에 추가할 PDF를 확인해요", {
                folder: folderTitle,
              })
            : t("놓으면 추가할 PDF를 확인해요")}
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
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="outline" size="sm">
                    <Icon name="upload" size={16} />
                    {t("올리기")}
                    <Icon name="chevron-down" size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => fileInputRef.current?.click()}
                  >
                    <Icon name="upload" size={15} />
                    {t("PDF 고르기")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      uploader.start({ folderId: uploadFolder, mode: "link" })
                    }
                  >
                    <Icon name="link" size={15} />
                    {t("웹 링크 추가")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          {rows.length > 0 && (
            <div className="docs-cols-head" aria-hidden="true">
              <span>{t("이름")}</span>
              <span>{t("종류")}</span>
              <span className="docs-col-folder">{t("폴더")}</span>
              <span>{t("공개 범위")}</span>
              <span>{t("버전")}</span>
              <span>{t("고친 날")}</span>
            </div>
          )}
          <ul className="docs-rows">
            {rows.map((row) => {
              const key = `${row.kind}:${row.id}`;
              const isFresh =
                row.kind === "material" && recentIds.includes(row.id);
              const actions = rowActions(row);
              return (
                <RowContextMenu key={key} actions={actions}>
                  <li
                    className="docs-row"
                    data-selected={selected === key ? "" : undefined}
                    data-fresh={isFresh ? "" : undefined}
                  >
                    <SwipeRow actions={actions} className="docs-row-swipe">
                      <div className="docs-row-inner">
                        {archivedView ? (
                          <span className="docs-row-link">
                            <RowBody row={row} />
                          </span>
                        ) : (
                          <Link
                            className="docs-row-link"
                            to={hrefOf(row)}
                            draggable={false}
                            onKeyDown={(event) => {
                              if (event.key === " ") {
                                event.preventDefault();
                                setSelected(selected === key ? null : key);
                              }
                            }}
                          >
                            <RowBody row={row} folders={data.folders} />
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
                            <span className="docs-row-peek">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-pressed={selected === key}
                                aria-label={t("{title} 미리보기", {
                                  title: row.title,
                                })}
                                onClick={() =>
                                  setSelected(selected === key ? null : key)
                                }
                              >
                                <Icon name="eye" size={16} />
                              </Button>
                            </span>
                            <RowMoreMenu
                              label={rowMenuLabel(row.title)}
                              actions={actions}
                            />
                          </span>
                        )}
                      </div>
                    </SwipeRow>
                  </li>
                </RowContextMenu>
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
          canEditVisibility={
            !editing.material.createdBy ||
            editing.material.createdBy === user.id
          }
          hasCollaborators={hasCollaborators}
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

/** 넓은 본문(1080px 이상)에서 요약 한 줄 대신 보여 주는 열. 좁으면 CSS가 숨겨요. */
function RowCols({
  kindLabel,
  folderLabel,
  visibility,
  version,
  date,
}: {
  kindLabel: string;
  folderLabel: string;
  visibility?: "private" | "shared";
  version: string;
  date: string;
}) {
  return (
    <span className="docs-row-cols">
      <span>{kindLabel}</span>
      <span className="docs-col-folder">{folderLabel || "—"}</span>
      <span>{visibility === "private" ? t("나만 보기") : t("함께 보기")}</span>
      <span>{version}</span>
      <span>{date}</span>
    </span>
  );
}

function RowBody({
  row,
  folders = [],
}: {
  row: DocRow;
  folders?: Parameters<typeof folderPath>[0];
}) {
  const folderId = rowFolder(row);
  const folderLabel = folderId ? folderPath(folders, folderId) : "";
  if (row.kind === "writing") {
    const d = row.document;
    return (
      <>
        <span className="docs-row-icon">
          <Icon name="edit" size={18} />
        </span>
        <span className="docs-row-copy">
          <strong>
            <span className="docs-row-title">{d.title}</span>
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
        <RowCols
          kindLabel={documentTypeLabel(d.type)}
          folderLabel={folderLabel}
          visibility={d.visibility}
          version="—"
          date={sinceLabel(d.updatedAt)}
        />
      </>
    );
  }
  const m = row.material;
  const date = formatDate(kstDateKey(row.latest?.createdAt ?? m.createdAt));
  return (
    <>
      <span className="docs-row-icon">
        {m.externalUrl ? (
          <Icon name="link" size={18} />
        ) : row.latest ? (
          <MaterialPreviewBadge version={row.latest} />
        ) : (
          <Icon name="file" size={18} />
        )}
      </span>
      <span className="docs-row-copy">
        <strong>
          <span className="docs-row-title">{m.title}</span>
          {m.visibility === "private" && (
            <span className="docs-row-lock">
              <Icon name="lock" size={13} />
              <span className="sr-only">{t("나만 보기")}</span>
            </span>
          )}
        </strong>
        <small>
          {m.externalUrl
            ? [
                t("링크"),
                formatDate(kstDateKey(m.createdAt)),
                domainOf(m.externalUrl),
              ]
                .filter(Boolean)
                .join(" · ")
            : [
                materialDisplayTypeLabel(m),
                date,
                row.latest ? `v${row.latest.number}` : t("파일 없음"),
              ].join(" · ")}
        </small>
      </span>
      <RowCols
        kindLabel={m.externalUrl ? t("링크") : materialDisplayTypeLabel(m)}
        folderLabel={folderLabel}
        visibility={m.visibility}
        version={row.latest ? `v${row.latest.number}` : "—"}
        date={date}
      />
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
      <p className="docs-preview-meta">
        {materialDisplayTypeLabel(m)} ·{" "}
        {m.visibility === "private" ? t("나만 보기") : t("함께 보기")}
      </p>
      {versions[0] && (
        <MaterialPreviewBadge version={versions[0]} size="large" />
      )}
      <ul className="docs-preview-versions">
        {versions.map((v) => (
          <li key={v.id}>
            v{v.number} · {formatDate(kstDateKey(v.createdAt))} ·{" "}
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
