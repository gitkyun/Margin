import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Choice } from "@/components/experience";
import { Input } from "@/components/ui/input";
import type { DocumentRecord, MaterialFolder } from "@/lib/domain";
import { folderPath } from "@/lib/docs-list";
import { DOC_TYPE_LABEL } from "./EditorHeader";

/** 고르기 칸은 빈 값을 '선택 안 함'으로 그려서 '폴더 없음'을 따로 값으로 둡니다. */
const NO_FOLDER = "none";

/**
 * 글 정보(IA v2 05 §3.3 ⋯ › 글 정보, §2.3 줄 메뉴 › 정보 편집): 종류와 폴더를 바꿉니다.
 * 글 편집 화면에서는 제목을 머리에서 바로 고치므로 `editTitle`일 때만 제목 칸을 둡니다.
 */
export function DocInfoDialog({
  open,
  onOpenChange,
  document,
  folders,
  editTitle = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Pick<DocumentRecord, "title" | "type" | "folderId">;
  folders: readonly MaterialFolder[];
  editTitle?: boolean;
  onSave: (next: {
    title: string;
    type: DocumentRecord["type"];
    folderId?: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(document.title);
  const [type, setType] = useState(document.type);
  const [folderId, setFolderId] = useState(document.folderId ?? NO_FOLDER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle(document.title);
    setType(document.type);
    setFolderId(document.folderId ?? NO_FOLDER);
    setError("");
  }, [open]);
  const folderOptions = folders
    .map((f) => ({ value: f.id, label: folderPath(folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  // 보관했거나 지금 없는 폴더에 들어 있으면 그 사실을 그대로 보여 줍니다(조용히 '폴더 없음'으로 바꾸지 않음).
  if (
    folderId !== NO_FOLDER &&
    !folderOptions.some((o) => o.value === folderId)
  )
    folderOptions.unshift({ value: folderId, label: t("찾을 수 없는 폴더") });
  const changed =
    title.trim() !== document.title ||
    type !== document.type ||
    folderId !== (document.folderId ?? NO_FOLDER);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>{t("글 정보")}</DialogTitle>
          {!editTitle && (
            <DialogDescription>
              {t("제목은 글 위에서 바로 고칠 수 있어요.")}
            </DialogDescription>
          )}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (saving) return;
            if (!title.trim()) return setError(t("문서 제목을 적어 주세요."));
            if (!changed) return onOpenChange(false);
            setSaving(true);
            setError("");
            onSave({
              title: title.trim(),
              type,
              folderId: folderId === NO_FOLDER ? undefined : folderId,
            })
              .then(() => onOpenChange(false))
              .catch((err: Error) => setError(err.message))
              .finally(() => setSaving(false));
          }}
        >
          <DialogBody>
            {editTitle && (
              <label className="field">
                <span>{t("제목")}</span>
                <Input
                  value={title}
                  maxLength={300}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
            )}
            <label className="field">
              <span>{t("종류")}</span>
              <Choice
                label={t("종류")}
                value={type}
                onChange={(v) => setType(v as DocumentRecord["type"])}
                options={(["plan", "manuscript", "note"] as const).map((v) => ({
                  value: v,
                  label: DOC_TYPE_LABEL[v],
                }))}
              />
            </label>
            <label className="field">
              <span>{t("폴더")}</span>
              <Choice
                label={t("폴더")}
                value={folderId}
                onChange={setFolderId}
                options={[
                  { value: NO_FOLDER, label: t("폴더 없음") },
                  ...folderOptions,
                ]}
              />
            </label>
            {error && (
              <p className="rms-error" role="alert">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {t("취소")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("저장 중") : t("저장")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
