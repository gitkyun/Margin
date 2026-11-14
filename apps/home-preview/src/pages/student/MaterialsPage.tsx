import { dateLocale, t } from "@/lib/i18n";
import { AnimatedList } from "@/components/AnimatedList";
import { MaterialPreviewBadge } from "@/components/MaterialPreviewBadge";
import {
  MaterialUploadField,
  MaterialSubmitLabel,
} from "./MaterialUploadField";
import { MaterialFolders } from "@/components/MaterialFolders";
import { Segments, SelectField } from "@/components/experience";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import { PdfViewer } from "@/components/PdfViewer";
import { MarginPanel, PanelFrame } from "@/components/margin-panel/MarginPanel";
import { queryUp } from "@/design/responsive";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { UploadConnectionError } from "@/lib/repository";
import {
  recordBase,
  safeUrl,
  type Material,
  type MaterialVersion,
} from "@/lib/domain";
import {
  BackLink,
  ErrorNotice,
  FilterSegments,
  FormDialog,
  LabeledInput,
  SaveActions,
  SearchInput,
  useSaving,
  useBackState,
} from "./shared";
import { filterCounts } from "@/lib/filter-counts";

const materialFilters = [
  ["all", t("전체")],
  ["draft", t("논문·초안")],
  ["reference", t("참고문헌")],
  ["analysis", t("분석 자료")],
  ["links", t("링크")],
] as const;
import {
  OrphanMaterialError,
  pendingUploadKey,
  registerPdf,
} from "./material-upload";
const materialTypes = {
  draft: t("논문·초안"),
  reference: t("참고문헌"),
  analysis: t("분석 자료"),
  other: t("기타"),
};
function byteSize(bytes: number) {
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
export function MaterialsPage() {
  const { researchId = "", materialId } = useParams();
  // 넓은 화면(1200px 이상)에서는 행을 누르면 여백 패널에 미리보기를 엽니다.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const back = useBackState();
  const { data, save, upload, remove } = useWorkspace();
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
  const [registering, setRegistering] = useState(false);
  const [target, setTarget] = useState<Material | null>(null);
  const [registerMode, setRegisterMode] = useState<"file" | "link">("file");
  const [draft, setDraft] = useState<Material | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [editing, setEditing] = useState<Material | null>(null);
  const editForm = useSaving();
  const pendingKey = pendingUploadKey(researchId);
  const [pending, setPending] = useState<MaterialVersion | null>(() => {
    try {
      const raw = sessionStorage.getItem(pendingKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const current = data.materials.find(
    (item) => item.id === materialId && item.researchId === researchId,
  );
  const versions = data.versions
    .filter((item) => item.materialId === materialId)
    .sort((a, b) => b.number - a.number);
  const selected =
    versions.find((item) => item.id === params.get("version")) ?? versions[0];
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  function startRegistration(material?: Material) {
    if (pending) {
      setError(
        t(
          "먼저 올려 둔 파일의 등록을 마쳐 주세요. ‘등록 다시 시도’를 누르면 파일을 다시 올리지 않고 등록할 수 있어요.",
        ),
      );
      return;
    }
    setTarget(material ?? null);
    setDraft(
      material
        ? { ...material }
        : {
            ...recordBase(researchId),
            title: "",
            type: "other",
            folderId: folder && folder !== "archived" ? folder : undefined,
          },
    );
    setFile(null);
    setProgress(null);
    setError(null);
    setRegisterMode("file");
    setRegistering(true);
  }
  function selectFile(chosen: File | undefined) {
    if (!chosen) return;
    if (!chosen.name.toLowerCase().endsWith(".pdf")) {
      setError(t("PDF 파일만 올릴 수 있어요."));
      return;
    }
    if (chosen.size > 500 * 1024 * 1024) {
      setError(t("500MB 이하의 PDF만 올릴 수 있어요."));
      return;
    }
    setError(null);
    setFile(chosen);
    if (!target)
      setDraft((value) =>
        value
          ? {
              ...value,
              title: value.title || chosen.name.replace(/\.pdf$/i, ""),
            }
          : value,
      );
  }
  function rememberPending(version: MaterialVersion | null) {
    setPending(version);
    try {
      if (version) sessionStorage.setItem(pendingKey, JSON.stringify(version));
      else sessionStorage.removeItem(pendingKey);
    } catch {}
  }
  async function reconnect() {
    if (!pending || saving) return;
    setSaving(true);
    setError(null);
    try {
      const version = await save("versions", pending);
      rememberPending(null);
      setRegistering(false);
      navigate(
        `/r/${researchId}/materials/${version.materialId}?version=${version.id}`,
      );
      toast.success(t("올려 둔 파일을 자료에 등록했어요"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "파일 등록을 마치지 못했어요. 파일을 다시 올릴 필요 없이 등록만 다시 시도해 주세요.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }
  async function register(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !draft) return;
    if (pending) {
      await reconnect();
      return;
    }
    if (!draft.title.trim()) {
      setError(t("자료 이름을 적어 주세요."));
      return;
    }
    if (registerMode === "link" && !safeUrl(draft.externalUrl ?? "")) {
      setError(t("http 또는 https로 시작하는 링크를 적어 주세요."));
      return;
    }
    if (registerMode === "file" && !file) {
      setError(t("등록할 PDF를 선택해 주세요."));
      return;
    }
    setSaving(true);
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      if (registerMode === "link") {
        const material = await save("materials", {
          ...draft,
          title: draft.title.trim(),
          externalUrl: safeUrl(draft.externalUrl ?? "") ?? undefined,
        });
        setDraft(material);
        setRegistering(false);
        navigate(`/r/${researchId}/materials/${material.id}`);
        toast.success(t("링크를 등록했어요"));
      } else {
        setProgress(0);
        const { material, version } = await registerPdf(
          { save, upload, remove },
          {
            draft: { ...draft, title: draft.title.trim() },
            isNew: !target,
            file: file!,
            onProgress: (value) => setProgress(value),
            signal: controller.signal,
            // A retry on an existing material needs its new updatedAt.
            onMaterialSaved: (saved) => {
              if (target) setDraft(saved);
            },
          },
        );
        setDraft(material);
        setRegistering(false);
        navigate(
          `/r/${researchId}/materials/${material.id}?version=${version.id}`,
        );
        toast.success(
          target ? t("새 버전을 추가했어요") : t("PDF를 등록했어요"),
        );
      }
    } catch (e) {
      if (e instanceof UploadConnectionError) {
        rememberPending(e.uploadedVersion);
        setError(e.message);
      } else if (e instanceof OrphanMaterialError) {
        setError(e.message);
        setProgress(null);
      } else if (controller.signal.aborted) {
        setError(
          t(
            "업로드를 중단했어요. 창을 닫았다가 ‘자료 등록’을 다시 눌러 등록해 주세요.",
          ),
        );
        setProgress(null);
      } else
        setError(
          e instanceof Error
            ? e.message
            : t(
                "등록하지 못했어요. 선택한 파일과 입력한 내용은 그대로 있어요.",
              ),
        );
    } finally {
      setSaving(false);
    }
  }
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
        <>
          <PageHeader
            back={
              <BackLink to={`/r/${researchId}/materials`}>
                {t("자료 목록")}
              </BackLink>
            }
            title={current.title}
            description={`${materialTypes[current.type]} · ${current.externalUrl ? t("링크") : t("PDF 파일")}`}
            actions={
              <div className="button-row">
                {/* 자주 쓰지 않는 보관은 머리의 보조 동작으로 둡니다(검수 P2). */}
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await save("materials", {
                        ...current,
                        archivedAt: current.archivedAt
                          ? undefined
                          : new Date().toISOString(),
                      });
                      toast.success(
                        current.archivedAt
                          ? t("자료를 복원했어요")
                          : t(
                              "자료를 보관했어요. 검토에 쓴 파일은 그대로 남아요.",
                            ),
                      );
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {current.archivedAt ? t("자료 복원") : t("자료 보관")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing({ ...current });
                    editForm.setError(null);
                  }}
                >
                  <Icon name="edit" size={16} />
                  {t("정보 편집")}
                </Button>
                <Button onClick={() => startRegistration(current)}>
                  <Icon name="upload" size={16} />
                  {t("새 버전 추가")}
                </Button>
              </div>
            }
          />
          <div className="material-location">
            <label className="field">
              {t("폴더")}
              <SelectField
                aria-label={t("폴더")}
                value={current.folderId ?? ""}
                onChange={(e) =>
                  void save("materials", {
                    ...current,
                    folderId: e.target.value || undefined,
                  }).catch((e) => toast.error((e as Error).message))
                }
              >
                <option value="">{t("폴더 없음")}</option>
                {data.folders
                  .filter((f) => f.researchId === researchId && !f.archivedAt)
                  .map((f) => (
                    <option value={f.id} key={f.id}>
                      {f.title}
                    </option>
                  ))}
              </SelectField>
            </label>
          </div>
          {current.externalUrl && (
            <section className="surface external-reference">
              <div>
                <StatusBadge tone="neutral">{t("링크")}</StatusBadge>
                <h2>{t("원본 문서")}</h2>
                <p>
                  {t(
                    "링크한 문서는 원래 서비스에서 내용이 바뀔 수 있어요. 링크만으로는 지금 내용이 남지 않아요.",
                  )}
                </p>
                <a
                  href={safeUrl(current.externalUrl) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {current.externalUrl}
                  <Icon name="arrow-up-right" size={16} />
                </a>
              </div>
              <Button
                variant="outline"
                onClick={() => {
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
              >
                {t("링크 복사")}
              </Button>
            </section>
          )}
          <div className="material-detail-layout">
            <section className="material-viewer-column">
              {selected ? (
                <>
                  <div className="material-version-toolbar">
                    <label className="sr-only" htmlFor="version-select">
                      {t("파일 버전 선택")}
                    </label>
                    <SelectField
                      id="version-select"
                      className="native-select"
                      value={selected.id}
                      onChange={(event) =>
                        setParams({ version: event.target.value })
                      }
                    >
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          v{version.number} · {version.fileName}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <PdfViewer key={selected.id} version={selected} />
                </>
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
                        onClick={() => startRegistration(current)}
                      >
                        {t("PDF 추가")}
                      </Button>
                    }
                  />
                </section>
              )}
            </section>
            <aside className="stack">
              <section className="surface material-history">
                <h2>{t("파일 버전")}</h2>
                {versions.length ? (
                  versions.map((version) => (
                    <button
                      key={version.id}
                      className={`version-history-item ${selected?.id === version.id ? "active" : ""}`}
                      onClick={() => setParams({ version: version.id })}
                    >
                      <span className="version-number">v{version.number}</span>
                      <span>
                        <strong>{version.fileName}</strong>
                        <small>
                          {new Intl.DateTimeFormat(dateLocale(), {
                            month: "long",
                            day: "numeric",
                          }).format(new Date(version.createdAt))}{" "}
                          · {byteSize(version.size)}
                        </small>
                      </span>
                      {selected?.id === version.id && (
                        <Icon name="check" size={15} />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="student-empty-inline">
                    {t("PDF를 올리면 여기에서 버전별로 다시 열 수 있어요.")}
                  </p>
                )}
                <p className="student-footnote">
                  {t(
                    "새 파일을 올려도 이전 버전과 검토에 쓴 파일은 그대로 남아요.",
                  )}
                </p>
              </section>
              {selected && (
                <section className="surface">
                  <h2>{t("이 버전을 사용한 기록")}</h2>
                  {data.results
                    .filter((result) => result.versionId === selected.id)
                    .map((result) => (
                      <Link
                        key={result.id}
                        className="student-simple-row"
                        to={`/r/${researchId}/results/${result.id}`}
                        state={back(current.title)}
                      >
                        <span className="grow">
                          <strong>{result.title}</strong>
                          <small>
                            {t("수정 결과 · {location}", {
                              location: result.location || t("볼 위치 없음"),
                            })}
                          </small>
                        </span>
                        <Icon name="chevron-right" size={15} />
                      </Link>
                    ))}
                  {data.meetings
                    .filter((meeting) =>
                      meeting.versionIds.includes(selected.id),
                    )
                    .map((meeting) => (
                      <Link
                        key={meeting.id}
                        className="student-simple-row"
                        to={`/r/${researchId}/meetings/${meeting.id}?tab=prepare`}
                        state={back(current.title)}
                      >
                        <span className="grow">
                          <strong>{meeting.title}</strong>
                          <small>{t("미팅 준비")}</small>
                        </span>
                        <Icon name="chevron-right" size={15} />
                      </Link>
                    ))}
                  {!data.results.some(
                    (result) => result.versionId === selected.id,
                  ) &&
                    !data.meetings.some((meeting) =>
                      meeting.versionIds.includes(selected.id),
                    ) && (
                      <p className="student-empty-inline">
                        {t("아직 이 버전을 사용한 기록이 없어요.")}
                      </p>
                    )}
                </section>
              )}
            </aside>
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title={t("자료")}
            description={t(
              "PDF는 올린 내용이 그대로 남고, 링크한 문서는 내용이 바뀔 수 있어요.",
            )}
            actions={
              // 자료가 없을 때는 빈 상태의 '자료 등록'이 주 행동이라 여기는 보조로 낮춥니다.
              <Button
                variant={hasMaterials ? undefined : "outline"}
                onClick={() => startRegistration()}
              >
                <Icon name="plus" size={17} />
                {t("자료 등록")}
              </Button>
            }
          />
          <MaterialFolders
            researchId={researchId}
            value={folder}
            onChange={(v) => {
              const n = new URLSearchParams(params);
              v ? n.set("folder", v) : n.delete("folder");
              setParams(n);
            }}
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
          <AnimatedList className="surface material-list">
            {materials.length ? (
              materials.map((material) => {
                const materialVersions = data.versions
                  .filter((version) => version.materialId === material.id)
                  .sort((a, b) => b.number - a.number);
                return (
                  <Link
                    key={material.id}
                    className="material-list-row"
                    to={`/r/${researchId}/materials/${material.id}`}
                    aria-current={
                      previewId === material.id ? "true" : undefined
                    }
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
                    <span className="grow">
                      <strong>{material.title}</strong>
                      <small>
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
                    <span className="material-row-date">
                      {new Intl.DateTimeFormat(dateLocale(), {
                        month: "long",
                        day: "numeric",
                      }).format(new Date(material.updatedAt))}
                    </span>
                    <Icon name="chevron-right" size={17} />
                  </Link>
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
                      onClick={() => startRegistration()}
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
      {pending && (
        <div className="pending-upload-note" role="status">
          <Icon name="warning" size={19} />
          <span>
            <strong>{t("파일은 올렸지만 자료에 등록하지 못했어요.")}</strong>
            <small>
              {t("{fileName} · 파일은 다시 올리지 않아도 돼요.", {
                fileName: pending.fileName,
              })}
            </small>
          </span>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => void reconnect()}
          >
            {t("등록 다시 시도")}
          </Button>
        </div>
      )}
      {!registering && error && <ErrorNotice error={error} />}
      <FormDialog
        busy={saving}
        open={registering}
        onOpenChange={(open) => {
          if (!saving) setRegistering(open);
        }}
        title={target ? t("새 버전 추가") : t("자료 등록")}
        description={
          target
            ? t("새 버전을 올려도 이전 파일과 교수 응답은 그대로 남아요.")
            : t(
                "PDF는 올린 내용이 그대로 남고, 링크한 문서는 내용이 바뀔 수 있어요.",
              )
        }
      >
        <form className="stack material-registration-form" onSubmit={register}>
          {!target && (
            <Segments
              fill
              label={t("자료 종류")}
              value={registerMode}
              onChange={(value) =>
                setRegisterMode(value as typeof registerMode)
              }
              options={[
                { value: "file", label: t("PDF 파일") },
                { value: "link", label: t("링크") },
              ]}
            />
          )}
          {draft && (
            <>
              <LabeledInput
                label={t("자료 이름")}
                required
                value={draft.title}
                onChange={(title) => setDraft((v) => (v ? { ...v, title } : v))}
                disabled={saving}
              />
              <label className="field">
                <span className="field-name">{t("자료 유형")}</span>
                <SelectField
                  className="native-select"
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((v) =>
                      v
                        ? { ...v, type: event.target.value as Material["type"] }
                        : v,
                    )
                  }
                  disabled={saving}
                >
                  {Object.entries(materialTypes).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </label>
              {registerMode === "link" ? (
                <LabeledInput
                  label={t("링크")}
                  required
                  type="url"
                  value={draft.externalUrl ?? ""}
                  onChange={(externalUrl) =>
                    setDraft((v) => (v ? { ...v, externalUrl } : v))
                  }
                  placeholder="https://"
                  hint={t(
                    "링크한 문서를 누가 볼 수 있는지는 원래 서비스의 공유 설정을 따라요.",
                  )}
                  disabled={saving}
                />
              ) : (
                <MaterialUploadField
                  file={file}
                  busy={saving}
                  progress={progress}
                  pending={!!pending}
                  onSelect={selectFile}
                  onClear={() => {
                    setFile(null);
                    setProgress(null);
                    setError(null);
                  }}
                  onAbort={() => abort.current?.abort()}
                />
              )}
            </>
          )}
          <ErrorNotice error={error} />
          <div className="form-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setRegistering(false)}
            >
              {t("취소")}
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving}>
              <MaterialSubmitLabel
                busy={saving}
                label={
                  pending
                    ? t("등록 다시 시도")
                    : registerMode === "link"
                      ? t("링크 등록")
                      : target
                        ? t("새 버전 추가")
                        : t("자료 등록")
                }
              />
            </Button>
          </div>
        </form>
      </FormDialog>
      <FormDialog
        busy={editForm.saving}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={t("자료 정보 편집")}
      >
        <form
          className="stack"
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
                        ? { ...v, type: event.target.value as Material["type"] }
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
              <Link to={`/r/${researchId}/materials/${material.id}`}>
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
              <p className="student-empty-inline">
                {t("아직 이 자료를 쓴 기록이 없어요.")}
              </p>
            )}
          </div>
        </PanelFrame>
      )}
    </MarginPanel>
  );
}
