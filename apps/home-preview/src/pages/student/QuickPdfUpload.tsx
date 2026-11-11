import { t } from "@/lib/i18n";
import { SelectField } from "@/components/experience";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { UploadConnectionError, validatePDF } from "@/lib/repository";
import { recordBase, type MaterialVersion } from "@/lib/domain";
import { ErrorNotice } from "./shared";
import {
  OrphanMaterialError,
  pendingUploadKey,
  registerPdf,
} from "./material-upload";

// Uploads a PDF from inside another form (revision result, meeting
// preparation) so the student keeps their draft and the new version is
// linked where they started.
export function QuickPdfUpload({
  researchId,
  onUploaded,
}: {
  researchId: string;
  onUploaded(version: MaterialVersion): void;
}) {
  const { data, save, upload, remove } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [targetId, setTargetId] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const fileMaterials = data.materials.filter(
    (item) => item.researchId === researchId && !item.externalUrl,
  );
  function close() {
    setOpen(false);
    setFile(null);
    setTargetId("");
    setProgress(null);
    setError(null);
  }
  function choose(chosen: File | undefined) {
    if (!chosen) return;
    try {
      validatePDF(chosen);
      setFile(chosen);
      setError(null);
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : t("PDF 파일을 선택해 주세요."));
    }
  }
  async function submit() {
    if (!file || busy) return;
    const target = fileMaterials.find((item) => item.id === targetId);
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { version } = await registerPdf(
        { save, upload, remove },
        {
          draft: target ?? {
            ...recordBase(researchId),
            title: file.name.replace(/\.pdf$/i, ""),
            type: "other",
          },
          isNew: !target,
          file,
          onProgress: setProgress,
          signal: abort.signal,
        },
      );
      onUploaded(version);
      toast.success(
        t("{fileName} v{number} 파일을 올리고 선택해 두었어요", {
          fileName: version.fileName,
          number: version.number,
        }),
      );
      close();
    } catch (e) {
      setProgress(null);
      if (e instanceof UploadConnectionError) {
        try {
          sessionStorage.setItem(
            pendingUploadKey(researchId),
            JSON.stringify(e.uploadedVersion),
          );
        } catch {}
        setError(
          t(
            "파일은 올렸지만 자료에 등록하지 못했어요. 자료 화면에서 ‘등록 다시 시도’를 누르면 파일을 다시 올리지 않고 등록할 수 있어요.",
          ),
        );
      } else if (e instanceof OrphanMaterialError) setError(e.message);
      else if (abort.signal.aborted)
        setError(t("업로드를 중단했어요. 같은 파일로 다시 시도할 수 있어요."));
      else
        setError(
          e instanceof Error
            ? e.message
            : t("파일을 올리지 못했어요. 작성 중인 내용은 그대로 있어요."),
        );
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Icon name="upload" size={15} />
        {t("새 PDF 올리기")}
      </Button>
    );
  return (
    <div className="quick-upload">
      <label className="field">
        <span className="field-name">{t("PDF 파일 · 20MB 이하")}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </label>
      <label className="field">
        <span className="field-name">{t("올릴 자료")}</span>
        <SelectField
          className="native-select"
          value={targetId}
          disabled={busy}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">{t("새 자료로 등록")}</option>
          {fileMaterials.map((item) => (
            <option key={item.id} value={item.id}>
              {t("{title}에 새 버전 추가", { title: item.title })}
            </option>
          ))}
        </SelectField>
      </label>
      {progress !== null && (
        <div className="upload-progress">
          <div>
            <span>
              {progress === 100 ? t("자료에 등록 중") : t("파일 업로드 중")}
            </span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <progress
            max={100}
            value={progress}
            aria-label={t("파일 업로드 진행률")}
          />
        </div>
      )}
      <ErrorNotice error={error} />
      <div className="button-row">
        {busy ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => controller.current?.abort()}
          >
            {t("업로드 중단")}
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" disabled={!file} onClick={submit}>
              {t("올리기")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              {t("닫기")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
