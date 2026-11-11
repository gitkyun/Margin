import { t } from "@/lib/i18n";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { recordBase, type MaterialFolder } from "@/lib/domain";
import { Icon } from "./icons";
import { Button } from "./ui/button";
import { Choice } from "./experience";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
export function MaterialFolders({
  researchId,
  value,
  onChange,
}: {
  researchId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data, save } = useWorkspace(),
    folders = data.folders.filter(
      (f) => f.researchId === researchId && !f.archivedAt,
    ),
    [draft, setDraft] = useState<MaterialFolder | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function node(f: MaterialFolder, depth = 0) {
    if (depth > 12) return null;
    const children = folders.filter((c) => c.parentId === f.id);
    return (
      <div
        key={f.id}
        className="folder-node"
        style={{ paddingLeft: depth ? 12 : 0 }}
      >
        <div className="folder-tree-row">
          <button
            type="button"
            aria-pressed={value === f.id}
            onClick={() => onChange(f.id)}
          >
            <Icon name="folder" size={16} />
            <span>{f.title}</span>
            <small>
              {
                data.materials.filter(
                  (m) => m.folderId === f.id && !m.archivedAt,
                ).length
              }
            </small>
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("{title} 폴더 편집", { title: f.title })}
            onClick={() => {
              setDraft({ ...f });
              setError("");
            }}
          >
            <Icon name="more" size={16} />
          </Button>
        </div>
        {children.length > 0 && (
          <details open>
            <summary>
              {t("하위 폴더 {count}개", { count: children.length })}
            </summary>
            {children.map((c) => node(c, depth + 1))}
          </details>
        )}
      </div>
    );
  }
  return (
    <aside className="folder-tree">
      <div className="section-heading">
        <h2>{t("폴더")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("폴더 만들기")}
          onClick={() => {
            setDraft({
              ...recordBase(researchId),
              title: "",
              parentId: value && value !== "archived" ? value : undefined,
            });
            setError("");
          }}
        >
          <Icon name="plus" size={17} />
        </Button>
      </div>
      <button
        className="folder-all"
        aria-pressed={!value}
        onClick={() => onChange("")}
      >
        <Icon name="folder" size={17} />
        {t("모든 자료")}
      </button>
      {folders
        .filter((f) => !f.parentId || !folders.some((p) => p.id === f.parentId))
        .map((f) => node(f))}
      <button
        className="folder-all"
        aria-pressed={value === "archived"}
        onClick={() => onChange("archived")}
      >
        <Icon name="archive" size={17} />
        {t("보관한 자료")}
      </button>
      {data.folders.some(
        (f) => f.researchId === researchId && f.archivedAt,
      ) && (
        <details className="archived-folders">
          <summary>{t("보관한 폴더")}</summary>
          {data.folders
            .filter((f) => f.researchId === researchId && f.archivedAt)
            .map((f) => (
              <div className="folder-tree-row" key={f.id}>
                <span>{f.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("{title} 폴더 복원", { title: f.title })}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await save("folders", {
                        ...f,
                        parentId: folders.some((p) => p.id === f.parentId)
                          ? f.parentId
                          : undefined,
                        archivedAt: undefined,
                      });
                      toast.success(t("폴더를 복원했어요"));
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("복원")}
                </Button>
              </div>
            ))}
        </details>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={(v) => !v && !busy && setDraft(null)}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>
              {folders.some((f) => f.id === draft?.id)
                ? t("폴더 편집")
                : t("폴더 만들기")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "자료를 주제별로 묶을 수 있어요. 폴더를 보관해도 안의 자료와 검토 기록은 그대로 남아요.",
              )}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await save("folders", {
                    ...draft,
                    title: draft.title.trim(),
                  });
                  setDraft(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                {t("폴더 이름")}
                <Input
                  value={draft.title}
                  maxLength={120}
                  required
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label className="field">
                {t("상위 폴더")}
                <Choice
                  label={t("상위 폴더")}
                  value={draft.parentId ?? ""}
                  onChange={(v) =>
                    setDraft({ ...draft, parentId: v || undefined })
                  }
                  options={[
                    { value: "", label: t("없음") },
                    ...folders
                      .filter((f) => f.id !== draft.id)
                      .map((f) => ({ value: f.id, label: f.title })),
                  ]}
                />
              </label>
              {error && (
                <p className="rms-error" role="alert">
                  {error}
                </p>
              )}
              <div className="bottom-actions">
                {folders.some((f) => f.id === draft.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await save("folders", {
                          ...draft,
                          archivedAt: new Date().toISOString(),
                        });
                        if (value === draft.id) onChange("");
                        setDraft(null);
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("폴더 보관")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  {t("취소")}
                </Button>
                <Button type="submit" disabled={busy || !draft.title.trim()}>
                  {busy ? t("저장 중") : t("저장")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  );
}
