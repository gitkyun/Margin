import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Choice, VisibilityField } from "@/components/experience";
import { useDisabledReason } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import { recordBase, type DocumentRecord } from "@/lib/domain";
import { folderPath } from "@/lib/docs-list";
import { DOC_TYPE_LABEL } from "./EditorHeader";

const NO_FOLDER = "none";

/** 글 편집 화면이 이 값을 받으면 본문 첫 줄에 커서를 둡니다(05 §2.4). */
export const FOCUS_BODY = "focusBody";

/**
 * 새 글(IA v2 05 §2.4, 창 폭 480): 제목(필수) · 종류(기본 원고) · 공개 범위(기본 나만 보기) ·
 * 폴더(폴더 안에서 열었으면 그 폴더). [만들기] → 글 편집으로.
 */
export function NewDocDialog({
  open,
  onOpenChange,
  researchId,
  folderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  researchId: string;
  folderId?: string;
}) {
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentRecord["type"]>("manuscript");
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const [folder, setFolder] = useState(folderId ?? NO_FOLDER);
  const [busy, setBusy] = useState(false);
  // 실패 뒤 다시 누르면 같은 id로 저장해 글이 두 개 생기지 않게 합니다.
  const base = useRef<ReturnType<typeof recordBase> | null>(null);
  const reason = useDisabledReason(
    !title.trim() && t("제목을 적으면 만들 수 있어요."),
  );
  useEffect(() => {
    if (!open) return;
    base.current = null;
    setTitle("");
    setType("manuscript");
    setVisibility("private");
    setFolder(folderId ?? NO_FOLDER);
  }, [open]);
  const folders = data.folders.filter(
    (f) => f.researchId === researchId && !f.archivedAt,
  );
  const folderOptions = folders
    .map((f) => ({ value: f.id, label: folderPath(folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  async function create() {
    if (busy || !title.trim()) return;
    setBusy(true);
    base.current ??= recordBase(researchId);
    try {
      const doc = await save("documents", {
        ...base.current,
        title: title.trim(),
        type,
        visibility,
        folderId: folder === NO_FOLDER ? undefined : folder,
        content: { type: "doc", content: [{ type: "paragraph" }] },
        text: "",
        revision: 0,
      });
      onOpenChange(false);
      navigate(`/r/${researchId}/docs/w/${doc.id}`, {
        state: { [FOCUS_BODY]: true },
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="rms-dialog new-doc-dialog">
        <DialogHeader>
          <DialogTitle>{t("새 글")}</DialogTitle>
          <DialogDescription>
            {t("만든 뒤에도 종류·공개 범위·폴더를 바꿀 수 있어요.")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <DialogBody>
            <label className="field">
              <span>{t("제목 (필수)")}</span>
              <Input
                autoFocus
                value={title}
                maxLength={300}
                placeholder={t("예: 연구 방법 초안")}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {reason.node}
            <label className="field">
              <span>{t("종류")}</span>
              <Choice
                label={t("종류")}
                value={type}
                onChange={(v) => setType(v as DocumentRecord["type"])}
                options={(["manuscript", "plan", "note"] as const).map((v) => ({
                  value: v,
                  label: DOC_TYPE_LABEL[v],
                }))}
              />
            </label>
            <VisibilityField value={visibility} onChange={setVisibility} />
            <label className="field">
              <span>{t("폴더")}</span>
              <Choice
                label={t("폴더")}
                value={folder}
                onChange={setFolder}
                options={[
                  { value: NO_FOLDER, label: t("폴더 없음") },
                  ...folderOptions,
                ]}
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {t("취소")}
            </Button>
            <Button
              type="submit"
              disabled={busy || !title.trim()}
              aria-describedby={reason.describedBy}
            >
              {busy ? t("만드는 중") : t("만들기")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
