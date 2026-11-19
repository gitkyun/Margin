import { DialogBody } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import { useMoveMaterial } from "@/components/MaterialFolders";
import { SelectField } from "@/components/experience";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common";
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
import { useWorkspace } from "@/lib/workspace";
import { safeUrl, type Material } from "@/lib/domain";
import {
  BackLink,
  ErrorNotice,
  FormDialog,
  LabeledInput,
  SaveActions,
  useSaving,
} from "./shared";

const materialTypes = MATERIAL_TYPE_LABELS;
export function MaterialsPage() {
  const { researchId = "", materialId } = useParams();
  const { data, save, remove } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
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
          <BackLink to={`/r/${researchId}/docs`}>{t("글·자료")}</BackLink>
          <EmptyState
            title={t("자료를 열 수 없어요")}
            description={t("이 연구의 자료 목록에서 다시 선택해 주세요.")}
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
