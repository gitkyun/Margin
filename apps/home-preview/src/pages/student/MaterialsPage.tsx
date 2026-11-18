import { DialogBody } from "@/components/ui/dialog";
import { dateLocale, t } from "@/lib/i18n";
import { AnimatedList } from "@/components/AnimatedList";
import { MaterialPreviewBadge } from "@/components/MaterialPreviewBadge";
import { MaterialFolders, useMoveMaterial } from "@/components/MaterialFolders";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MATERIAL_DRAG_TYPE } from "@/lib/material-folders";
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
import { PageHeader, EmptyState, InlineEmpty } from "@/components/common";
import { SectionBoundary } from "@/components/SectionBoundary";
import { PdfViewer, type PdfViewerHandle } from "@/components/PdfViewer";
import {
  LinkCard,
  MaterialHeader,
  MaterialInfo,
  MoveFolderDialog,
} from "@/pages/docs/MaterialView";
import {
  MATERIAL_TYPE_LABELS,
  useMaterialUpload,
} from "@/pages/docs/MaterialUpload";
import { MarginPanel, PanelFrame } from "@/components/margin-panel/MarginPanel";
import { queryUp } from "@/design/responsive";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { safeUrl, type Material } from "@/lib/domain";
import {
  BackLink,
  DocumentTabs,
  ErrorNotice,
  FilterSegments,
  FormDialog,
  LabeledInput,
  SaveActions,
  SearchInput,
  useSaving,
} from "./shared";
import { filterCounts } from "@/lib/filter-counts";

const materialFilters = [
  ["all", t("전체")],
  ["draft", t("논문·초안")],
  ["reference", t("참고문헌")],
  ["analysis", t("분석 자료")],
  ["links", t("링크")],
] as const;
const materialTypes = MATERIAL_TYPE_LABELS;
function byteSize(bytes: number) {
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
export function MaterialsPage() {
  const { researchId = "", materialId } = useParams();
  // 넓은 화면(1200px 이상)에서는 행을 누르면 여백 패널에 미리보기를 엽니다.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { data, save, remove } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const filter = params.get("type") ?? "all",
    setFilter = (v: string) => {
      const n = new URLSearchParams(params);
      n.set("type", v);
      setParams(n);
    };
  const folder = params.get("folder") ?? "";
  const uploader = useMaterialUpload(researchId);
  const [editing, setEditing] = useState<Material | null>(null);
  const editForm = useSaving();
  const moveMaterial = useMoveMaterial();
  const activeFolders = data.folders.filter(
    (f) => f.researchId === researchId && !f.archivedAt,
  );
  const current = data.materials.find(
    (item) => item.id === materialId && item.researchId === researchId,
  );
  const versions = data.versions
    .filter((item) => item.materialId === materialId)
    .sort((a, b) => b.number - a.number);
  const selected =
    versions.find(
      (item) => item.id === (params.get("ver") ?? params.get("version")),
    ) ?? versions[0];
  // 글·자료 목록의 [올리기](IA v2 05 §2.5)는 ?register=1로 와서 올리기 창을 엽니다.
  useEffect(() => {
    if (materialId || params.get("register") !== "1") return;
    uploader.start({
      folderId: folder && folder !== "archived" ? folder : undefined,
    });
    const rest = new URLSearchParams(params);
    rest.delete("register");
    setParams(rest, { replace: true });
  }, []);
  const hasMaterials = data.materials.some(
    (item) => item.researchId === researchId && !item.archivedAt,
  );
  const searched = data.materials.filter(
    (item) =>
      item.researchId === researchId &&
      (folder === "archived" ? !!item.archivedAt : !item.archivedAt) &&
      (!folder || folder === "archived" || item.folderId === folder) &&
      (!search || item.title.toLowerCase().includes(search.toLowerCase())),
  );
  const matches = (item: (typeof searched)[number], value: string) =>
    value === "all" ||
    (value === "links" ? !!item.externalUrl : item.type === value);
  const counts = filterCounts(
    materialFilters.map(([value]) => value),
    searched,
    matches,
  );
  const materials = searched
    .filter((item) => matches(item, filter))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // 자료 보기(W3, 05 §4): 주소에 ?ver=(예전 ?version=)와 ?page=가 남습니다.
  const viewer = useRef<PdfViewerHandle>(null);
  const [moving, setMoving] = useState(false);
  function pickVersion(id: string) {
    const next = new URLSearchParams(params);
    next.delete("version");
    next.delete("page");
    next.set("ver", id);
    setParams(next);
  }
  function rememberPage(page: number) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (page > 1) next.set("page", String(page));
        else next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  const initialPage = Number(params.get("page"));
  useEffect(() => {
    if (initialPage > 1) viewer.current?.goToPage(initialPage);
  }, [selected?.id]);
  async function archiveCurrent(material: Material) {
    if (material.archivedAt) {
      try {
        await save("materials", { ...material, archivedAt: undefined });
        toast.success(t("복원했어요."));
      } catch (e) {
        toast.error((e as Error).message);
      }
      return;
    }
    navigate(`/r/${researchId}/docs`);
    try {
      await remove("materials", material.id);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    toast.success(t("보관했어요. 검토에 쓴 파일은 그대로 남아요."), {
      duration: 6000,
      action: {
        label: t("되돌리기"),
        onClick: () =>
          void save("materials", { ...material, archivedAt: undefined })
            .then(() => toast.success(t("복원했어요.")))
            .catch((e: Error) => toast.error(e.message)),
      },
    });
  }
  const info = (
    <MaterialInfo
      researchId={researchId}
      versions={versions}
      selected={selected}
      onVersion={pickVersion}
    />
  );
  if (materialId && !current)
    return (
      <>
        <BackLink to={`/r/${researchId}/materials`}>{t("자료 목록")}</BackLink>
        <EmptyState
          title={t("자료를 열 수 없어요")}
          description={t("이 연구의 자료 목록에서 다시 선택해 주세요.")}
        />
      </>
    );
  return (
    <div className="student-page">
      {current ? (
        <div className="material-view">
          {/* 휴대폰 폭에서는 열어 둔 탭 줄이 없어 뒤로 가기로 목록에 갑니다(05 §3.1). */}
          <span className="material-view-back">
            <BackLink to={`/r/${researchId}/docs`}>{t("글·자료")}</BackLink>
          </span>
          <MaterialHeader
            material={current}
            typeLabel={materialTypes[current.type]}
            versions={versions}
            selected={selected}
            onVersion={pickVersion}
            onUpload={() => uploader.start({ material: current })}
            onDownload={() => viewer.current?.download()}
            onEdit={() => {
              setEditing({ ...current });
              editForm.setError(null);
            }}
            onMove={() => setMoving(true)}
            archived={!!current.archivedAt}
            onArchive={() => void archiveCurrent(current)}
            info={info}
          />
          <div className="material-view-body">
            <div className="material-view-main">
              {current.externalUrl && safeUrl(current.externalUrl) && (
                <LinkCard
                  url={safeUrl(current.externalUrl)!}
                  onCopy={() => {
                    void navigator.clipboard
                      .writeText(current.externalUrl!)
                      .then(() => toast.success(t("링크를 복사했어요")))
                      .catch(() =>
                        toast.error(
                          t(
                            "링크를 복사하지 못했어요. 링크를 직접 선택해 복사해 주세요.",
                          ),
                        ),
                      );
                  }}
                />
              )}
              {selected ? (
                <SectionBoundary resetKeys={[selected.id]}>
                  <PdfViewer
                    key={selected.id}
                    ref={viewer}
                    version={selected}
                    onPageChange={rememberPage}
                  />
                </SectionBoundary>
              ) : (
                <section className="surface">
                  <EmptyState
                    title={t("아직 올린 파일이 없어요")}
                    description={
                      current.externalUrl
                        ? t(
                            "지금 내용을 남기거나 교수님께 수정 결과를 확인받으려면 PDF 파일을 추가해 주세요.",
                          )
                        : undefined
                    }
                    action={
                      <Button
                        variant="outline"
                        onClick={() => uploader.start({ material: current })}
                      >
                        {t("PDF 추가")}
                      </Button>
                    }
                  />
                </section>
              )}
            </div>
            <aside className="material-view-side" aria-label={t("자료 정보")}>
              {info}
            </aside>
          </div>
          <MoveFolderDialog
            open={moving}
            onOpenChange={setMoving}
            folders={activeFolders}
            value={current.folderId}
            onMove={(folderId) => moveMaterial(current, folderId)}
          />
        </div>
      ) : (
        <>
          <PageHeader
            title={t("자료")}
            tabs={<DocumentTabs researchId={researchId} selected="materials" />}
            description={t(
              "PDF는 올린 내용이 그대로 남고, 링크한 문서는 내용이 바뀔 수 있어요.",
            )}
            actions={
              // 자료가 없을 때는 빈 상태의 '자료 등록'이 주 행동이라 여기는 보조로 낮춥니다.
              <Button
                variant={hasMaterials ? undefined : "outline"}
                onClick={() =>
                  uploader.start({
                    folderId:
                      folder && folder !== "archived" ? folder : undefined,
                  })
                }
              >
                <Icon name="plus" size={17} />
                {t("자료 등록")}
              </Button>
            }
          />
          <div className="page-toolbar">
            <FilterSegments
              label={t("자료 종류")}
              options={materialFilters}
              value={filter}
              onChange={setFilter}
              counts={counts}
            />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("자료 이름으로 찾기")}
            />
          </div>
          <MaterialFolders
            researchId={researchId}
            value={folder}
            onChange={(v) => {
              const n = new URLSearchParams(params);
              v ? n.set("folder", v) : n.delete("folder");
              setParams(n);
            }}
          />
          <AnimatedList className="surface material-list">
            {materials.length ? (
              materials.map((material) => {
                const materialVersions = data.versions
                  .filter((version) => version.materialId === material.id)
                  .sort((a, b) => b.number - a.number);
                // 보관한 자료는 옮기지 않아요. 키보드로는 오른쪽 ‘폴더로 옮기기’ 메뉴를 써요.
                const movable =
                  folder !== "archived" &&
                  !material.archivedAt &&
                  activeFolders.length > 0;
                return (
                  <div key={material.id} className="material-list-item">
                    <Link
                      className="material-list-row list-row"
                      to={`/r/${researchId}/docs/m/${material.id}`}
                      aria-current={
                        previewId === material.id ? "true" : undefined
                      }
                      draggable={movable}
                      onDragStart={(event) => {
                        if (!movable) return;
                        event.dataTransfer.setData(
                          MATERIAL_DRAG_TYPE,
                          material.id,
                        );
                        event.dataTransfer.setData(
                          "text/plain",
                          material.title,
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          !window.matchMedia?.(queryUp("lg")).matches
                        )
                          return;
                        event.preventDefault();
                        setPreviewId(material.id);
                      }}
                    >
                      {!material.externalUrl && materialVersions[0] ? (
                        <MaterialPreviewBadge version={materialVersions[0]} />
                      ) : (
                        <span
                          className={`material-symbol ${material.externalUrl ? "is-link" : ""}`}
                        >
                          <Icon
                            name={material.externalUrl ? "link" : "file"}
                            size={23}
                          />
                          {!material.externalUrl && <small>PDF</small>}
                        </span>
                      )}
                      <span className="list-row-body">
                        <strong
                          className="list-row-title"
                          title={material.title}
                        >
                          {material.title}
                        </strong>
                        <small className="list-row-meta">
                          {materialTypes[material.type]} ·{" "}
                          {material.externalUrl
                            ? t("링크")
                            : materialVersions.length
                              ? t("버전 {count}개 · 최신 v{number}", {
                                  count: materialVersions.length,
                                  number: materialVersions[0].number,
                                })
                              : t("파일 없음")}
                        </small>
                      </span>
                      <span className="list-row-aside">
                        {new Intl.DateTimeFormat(dateLocale(), {
                          month: "long",
                          day: "numeric",
                        }).format(new Date(material.updatedAt))}
                      </span>
                      <Icon name="chevron-right" size={17} />
                    </Link>
                    {movable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="material-move-trigger"
                            aria-label={t("{title} 폴더로 옮기기", {
                              title: material.title,
                            })}
                          >
                            <Icon name="more" size={17} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>
                            {t("폴더로 옮기기")}
                          </DropdownMenuLabel>
                          {activeFolders
                            .filter((f) => f.id !== material.folderId)
                            .map((f) => (
                              <DropdownMenuItem
                                key={f.id}
                                onSelect={() =>
                                  void moveMaterial(material, f.id)
                                }
                              >
                                <Icon name="folder" size={16} />
                                {f.title}
                              </DropdownMenuItem>
                            ))}
                          {material.folderId && (
                            <DropdownMenuItem
                              onSelect={() =>
                                void moveMaterial(material, undefined)
                              }
                            >
                              <Icon name="close" size={16} />
                              {t("폴더에서 빼기")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })
            ) : (
              <EmptyState
                title={
                  folder === "archived"
                    ? t("보관한 자료가 없어요")
                    : search || filter !== "all"
                      ? t("조건에 맞는 자료가 없어요")
                      : folder
                        ? t("이 폴더에 자료가 없어요")
                        : t("아직 등록한 자료가 없어요")
                }
                description={
                  folder === "archived"
                    ? undefined
                    : t(
                        "논문 초안과 분석 자료는 PDF로, 참고할 웹 문서는 링크로 등록할 수 있어요.",
                      )
                }
                action={
                  folder === "archived" ? undefined : (
                    <Button
                      variant="outline"
                      onClick={() =>
                        uploader.start({
                          folderId:
                            folder && folder !== "archived"
                              ? folder
                              : undefined,
                        })
                      }
                    >
                      {t("자료 등록")}
                    </Button>
                  )
                }
              />
            )}
          </AnimatedList>
          <MaterialPreviewPanel
            researchId={researchId}
            materialId={previewId}
            onClose={() => setPreviewId(null)}
          />
        </>
      )}
      {uploader.node}
      <FormDialog
        busy={editForm.saving}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={t("자료 정보 편집")}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!editing || !editing.title.trim()) return;
            void editForm.perform(async () => {
              if (editing.externalUrl && !safeUrl(editing.externalUrl))
                throw new Error(
                  t("http 또는 https로 시작하는 링크를 적어 주세요."),
                );
              await save("materials", {
                ...editing,
                title: editing.title.trim(),
              });
              setEditing(null);
              toast.success(t("자료 정보를 저장했어요"));
            });
          }}
        >
          <DialogBody>
            {editing && (
              <>
                <LabeledInput
                  label={t("자료 이름")}
                  required
                  value={editing.title}
                  onChange={(title) =>
                    setEditing((v) => (v ? { ...v, title } : v))
                  }
                />
                <label className="field">
                  <span className="field-name">{t("자료 유형")}</span>
                  <SelectField
                    className="native-select"
                    value={editing.type}
                    onChange={(event) =>
                      setEditing((v) =>
                        v
                          ? {
                              ...v,
                              type: event.target.value as Material["type"],
                            }
                          : v,
                      )
                    }
                  >
                    {Object.entries(materialTypes).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                </label>
                {editing.externalUrl !== undefined && (
                  <LabeledInput
                    label={t("링크")}
                    type="url"
                    required
                    value={editing.externalUrl}
                    onChange={(externalUrl) =>
                      setEditing((v) => (v ? { ...v, externalUrl } : v))
                    }
                  />
                )}
              </>
            )}
            <ErrorNotice error={editForm.error} />
          </DialogBody>
          <SaveActions
            saving={editForm.saving}
            onCancel={() => setEditing(null)}
          />
        </form>
      </FormDialog>
    </div>
  );
}

/** 자료 목록에서 고른 자료의 요약. 파일 내용은 전체 화면에서 엽니다. */
function MaterialPreviewPanel({
  researchId,
  materialId,
  onClose,
}: {
  researchId: string;
  materialId: string | null;
  onClose(): void;
}) {
  const { data } = useWorkspace();
  const material = data.materials.find(
    (item) => item.id === materialId && item.researchId === researchId,
  );
  const versions = data.versions
    .filter((version) => version.materialId === material?.id)
    .sort((a, b) => b.number - a.number);
  const versionIds = new Set(versions.map((version) => version.id));
  const results = data.results.filter(
    (result) => result.versionId && versionIds.has(result.versionId),
  );
  const meetings = data.meetings.filter((meeting) =>
    meeting.versionIds.some((id) => versionIds.has(id)),
  );
  const day = (value: string) =>
    new Intl.DateTimeFormat(dateLocale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  return (
    <MarginPanel label={t("자료 미리보기")} open={!!material} onClose={onClose}>
      {material && (
        <PanelFrame title={t("자료 미리보기")} onClose={onClose}>
          <div className="panel-frame-body material-preview-panel">
            {/* 여백 미리보기 레일: 최신 PDF의 첫 페이지 */}
            {!material.externalUrl && versions[0] && (
              <MaterialPreviewBadge
                key={versions[0].id}
                version={versions[0]}
                size="large"
              />
            )}
            <strong className="material-preview-title">{material.title}</strong>
            <dl className="material-preview-facts">
              <div>
                <dt>{t("종류")}</dt>
                <dd>
                  {materialTypes[material.type]}
                  {material.externalUrl ? ` · ${t("링크")}` : ""}
                </dd>
              </div>
              {!material.externalUrl && (
                <div>
                  <dt>{t("버전")}</dt>
                  <dd>
                    {versions.length
                      ? t("{count}개 · 최신 v{number}", {
                          count: versions.length,
                          number: versions[0].number,
                        })
                      : t("파일 없음")}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t("올린 날")}</dt>
                <dd>{day(versions[0]?.createdAt ?? material.createdAt)}</dd>
              </div>
              {versions[0] && (
                <div>
                  <dt>{t("파일")}</dt>
                  <dd>
                    {versions[0].fileName} · {byteSize(versions[0].size)}
                  </dd>
                </div>
              )}
            </dl>
            <Button asChild>
              <Link to={`/r/${researchId}/docs/m/${material.id}`}>
                {t("전체 화면으로 열기")}
                <Icon name="arrow-right" size={15} />
              </Link>
            </Button>
            <h3>
              {t("이 자료를 쓴 기록")}
              <span className="count-chip">
                {results.length + meetings.length}
              </span>
            </h3>
            {results.map((result) => (
              <Link
                key={result.id}
                className="student-simple-row"
                to={`/r/${researchId}/results/${result.id}`}
              >
                <span className="grow">
                  <strong>{result.title}</strong>
                  <small>{t("수정 결과")}</small>
                </span>
                <Icon name="chevron-right" size={15} />
              </Link>
            ))}
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                className="student-simple-row"
                to={`/r/${researchId}/meetings/${meeting.id}?tab=prepare`}
              >
                <span className="grow">
                  <strong>{meeting.title}</strong>
                  <small>{t("미팅 준비")}</small>
                </span>
                <Icon name="chevron-right" size={15} />
              </Link>
            ))}
            {!results.length && !meetings.length && (
              <InlineEmpty>{t("아직 이 자료를 쓴 기록이 없어요.")}</InlineEmpty>
            )}
          </div>
        </PanelFrame>
      )}
    </MarginPanel>
  );
}
