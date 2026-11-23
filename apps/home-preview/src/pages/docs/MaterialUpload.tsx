import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { Choice, Segments, SelectField } from "@/components/experience";
import { useWorkspace } from "@/lib/workspace";
import { UploadConnectionError } from "@/lib/repository";
import {
  recordBase,
  safeUrl,
  type Material,
  type MaterialVersion,
} from "@/lib/domain";
import { folderPath } from "@/lib/docs-list";
import { ErrorNotice, FormDialog, LabeledInput } from "@/pages/student/shared";
import {
  MaterialSubmitLabel,
  MaterialUploadField,
} from "@/pages/student/MaterialUploadField";
import {
  OrphanMaterialError,
  pendingUploadKey,
  registerPdf,
} from "@/pages/student/material-upload";
import "./material-upload.css";

export const MATERIAL_TYPE_LABELS: Record<Material["type"], string> = {
  draft: t("논문·초안"),
  reference: t("참고문헌"),
  analysis: t("분석 자료"),
  other: t("기타"),
};

const NO_FOLDER = "none";
const MAX_BYTES = 500 * 1024 * 1024;

export interface UploadStart {
  /** 있으면 이 자료의 새 버전으로 올립니다. */
  material?: Material;
  /** 판에 끌어 놓은 파일. 창이 이 파일이 든 채로 열립니다(05 §2.5). */
  file?: File;
  /** 새 자료가 들어갈 폴더(폴더 안에서 열었을 때) */
  folderId?: string;
  /** 시작 탭(file | link) */
  mode?: "file" | "link";
}

/** 받는 형식·크기 한도와 문구는 예전 올리기 양식 그대로입니다. */
function fileProblem(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return t("PDF 파일만 올릴 수 있어요.");
  if (file.size > MAX_BYTES) return t("500MB 이하의 PDF만 올릴 수 있어요.");
  return null;
}

/**
 * 자료 올리기 창(IA v2 05 §2.5). 글·자료 목록과 자료 보기가 같이 씁니다.
 * PDF(끌어 놓기·진행 표시·취소) 또는 링크(http·https), 자료 종류, 폴더.
 * 파일은 올렸는데 등록을 끝내지 못하면 '등록 다시 시도' 띠를 보여 주고,
 * 다시 누르면 파일을 다시 올리지 않고 등록만 합니다.
 */
export function useMaterialUpload(researchId: string) {
  const { data, save, upload, remove } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Material | null>(null);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [draft, setDraft] = useState<Material | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const pendingKey = pendingUploadKey(researchId);
  const [pending, setPending] = useState<MaterialVersion | null>(() => {
    try {
      const raw = sessionStorage.getItem(pendingKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  const folders = data.folders.filter(
    (f) => f.researchId === researchId && !f.archivedAt,
  );

  function start({
    material,
    file: dropped,
    folderId,
    mode: startMode,
  }: UploadStart = {}) {
    if (pending) {
      setError(
        t(
          "먼저 올려 둔 파일의 등록을 마쳐 주세요. ‘등록 다시 시도’를 누르면 파일을 다시 올리지 않고 등록할 수 있어요.",
        ),
      );
      return;
    }
    const problem = dropped ? fileProblem(dropped) : null;
    setTarget(material ?? null);
    setDraft(
      material
        ? { ...material }
        : {
            ...recordBase(researchId),
            title:
              dropped && !problem ? dropped.name.replace(/\.pdf$/i, "") : "",
            type: "other",
            typeExplicit: false,
            visibility: "private",
            folderId,
          },
    );
    setFile(dropped && !problem ? dropped : null);
    setProgress(null);
    setError(problem);
    setMode(startMode ?? "file");
    setOpen(true);
  }
  function selectFile(chosen: File | undefined) {
    if (!chosen) return;
    const problem = fileProblem(chosen);
    if (problem) {
      setError(problem);
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
  // 창을 닫은 뒤(입력 보호가 풀린 뒤)에 옮겨야 '저장하지 않고 이동할까요?'가 뜨지 않습니다.
  const go = (href: string) => setTimeout(() => navigate(href), 0);
  const viewHref = (materialId: string, versionId?: string) =>
    `/r/${researchId}/docs/m/${materialId}${versionId ? `?ver=${versionId}` : ""}`;
  async function reconnect() {
    if (!pending || saving) return;
    setSaving(true);
    setError(null);
    try {
      const version = await save("versions", pending);
      rememberPending(null);
      setOpen(false);
      go(viewHref(version.materialId, version.id));
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
    if (mode === "link" && !safeUrl(draft.externalUrl ?? "")) {
      setError(t("http 또는 https로 시작하는 링크를 적어 주세요."));
      return;
    }
    if (mode === "file" && !file) {
      setError(t("등록할 PDF를 선택해 주세요."));
      return;
    }
    setSaving(true);
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      if (mode === "link") {
        const material = await save("materials", {
          ...draft,
          title: draft.title.trim(),
          externalUrl: safeUrl(draft.externalUrl ?? "") ?? undefined,
        });
        setDraft(material);
        setOpen(false);
        toast.success(t("링크를 등록했어요"), {
          action: {
            label: t("열기"),
            onClick: () => go(viewHref(material.id)),
          },
        });
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
        setOpen(false);
        toast.success(
          target ? t("새 버전을 추가했어요") : t("PDF를 등록했어요"),
          {
            action: {
              label: t("열기"),
              onClick: () => go(viewHref(material.id, version.id)),
            },
          },
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

  const folderOptions = folders
    .map((f) => ({ value: f.id, label: folderPath(folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const node = (
    <>
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
      {!open && error && <ErrorNotice error={error} />}
      <FormDialog
        busy={saving}
        open={open}
        onOpenChange={(next) => {
          if (!saving) setOpen(next);
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
        <form className="material-registration-form" onSubmit={register}>
          <DialogBody>
            {!target && (
              <Segments
                fill
                label={t("자료 종류")}
                value={mode}
                onChange={(value) => setMode(value as typeof mode)}
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
                  onChange={(title) =>
                    setDraft((v) => (v ? { ...v, title } : v))
                  }
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
                          ? {
                              ...v,
                              type: event.target.value as Material["type"],
                            }
                          : v,
                      )
                    }
                    disabled={saving}
                  >
                    {Object.entries(MATERIAL_TYPE_LABELS).map(
                      ([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </SelectField>
                </label>
                {!target && (
                  <label className="field">
                    <span className="field-name">{t("폴더")}</span>
                    <Choice
                      label={t("폴더")}
                      value={draft.folderId ?? NO_FOLDER}
                      disabled={saving}
                      onChange={(value) =>
                        setDraft((v) =>
                          v
                            ? {
                                ...v,
                                folderId:
                                  value === NO_FOLDER ? undefined : value,
                              }
                            : v,
                        )
                      }
                      options={[
                        { value: NO_FOLDER, label: t("폴더 없음") },
                        ...folderOptions,
                      ]}
                    />
                  </label>
                )}
                {mode === "link" ? (
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
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              {t("취소")}
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving}>
              <MaterialSubmitLabel
                busy={saving}
                label={
                  pending
                    ? t("등록 다시 시도")
                    : mode === "link"
                      ? t("링크 등록")
                      : target
                        ? t("새 버전 추가")
                        : t("자료 등록")
                }
              />
            </Button>
          </DialogFooter>
        </form>
      </FormDialog>
    </>
  );
  return { start, node, pending: !!pending };
}
