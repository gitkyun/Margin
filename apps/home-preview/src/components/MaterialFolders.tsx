import { t } from "@/lib/i18n";
import { useState, type DragEvent } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { recordBase, type Material, type MaterialFolder } from "@/lib/domain";
import {
  MATERIAL_DRAG_TYPE,
  parentFolderOptions,
  rootFolders,
} from "@/lib/material-folders";
import "./material-library.css";
import { Icon } from "./icons";
import { Button } from "./ui/button";
import { Choice } from "./experience";
import { useDisabledReason } from "./common";
import { Disclosure } from "./ui/disclosure";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

/**
 * 자료를 폴더로 옮겨요(끌어 놓기와 ‘폴더로 옮기기’ 메뉴가 함께 씀).
 * folderId가 없으면 폴더에서 빼요. 저장은 사용자가 놓거나 고른 때만 해요.
 */
export function useMoveMaterial() {
  const { data, save } = useWorkspace();
  return async (material: Material, folderId: string | undefined) => {
    if ((material.folderId ?? undefined) === folderId) return;
    const folder = data.folders.find((f) => f.id === folderId);
    try {
      await save("materials", { ...material, folderId });
      toast.success(
        folder
          ? t("‘{title}’을 ‘{folder}’ 폴더로 옮겼어요.", {
              title: material.title,
              folder: folder.title,
            })
          : t("‘{title}’을 폴더에서 뺐어요.", { title: material.title }),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
}

export function MaterialFolders({
  researchId,
  value,
  onChange,
}: {
  researchId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const move = useMoveMaterial();
  // 접은 폴더(처음에는 모두 펼쳐 둬요)와 지금 자료를 끌어 올려 둔 폴더
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const { data, save } = useWorkspace(),
    folders = data.folders.filter(
      (f) => f.researchId === researchId && !f.archivedAt,
    ),
    [draft, setDraft] = useState<MaterialFolder | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    titleReason = useDisabledReason(
      draft &&
        !draft.title.trim() &&
        t("폴더 이름을 입력하면 저장할 수 있어요."),
    );
  /** 폴더 행이 자료를 받아요. 다른 끌기(파일·글자)는 무시해요. */
  function dropProps(target: string, folderId: string | undefined) {
    const accepts = (e: DragEvent) =>
      e.dataTransfer.types.includes(MATERIAL_DRAG_TYPE);
    return {
      "data-drop": dropTarget === target ? "true" : undefined,
      onDragOver: (e: DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(target);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDropTarget((v) => (v === target ? null : v));
      },
      onDrop: (e: DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        setDropTarget(null);
        const material = data.materials.find(
          (m) =>
            m.id === e.dataTransfer.getData(MATERIAL_DRAG_TYPE) &&
            m.researchId === researchId &&
            !m.archivedAt,
        );
        if (material) void move(material, folderId);
      },
    };
  }
  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function node(f: MaterialFolder, depth = 0) {
    if (depth > 12) return null;
    const children = folders.filter((c) => c.parentId === f.id);
    const open = !collapsed.has(f.id);
    const childListId = `folder-children-${f.id}`;
    return (
      <li key={f.id} className="folder-node">
        <div
          className="folder-tree-row"
          style={{ paddingLeft: depth * 14 }}
          {...dropProps(f.id, f.id)}
        >
          {children.length > 0 ? (
            <Button
              variant="ghost"
              size="icon-xs"
              className="folder-toggle"
              aria-expanded={open}
              aria-controls={childListId}
              aria-label={
                open
                  ? t("{title} 하위 폴더 접기", { title: f.title })
                  : t("{title} 하위 폴더 펼치기", { title: f.title })
              }
              onClick={() => toggle(f.id)}
            >
              <Icon name="chevron-right" size={14} />
            </Button>
          ) : (
            <span className="folder-toggle-space" aria-hidden="true" />
          )}
          <button
            type="button"
            className="folder-select"
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
        {children.length > 0 && open && (
          <ul id={childListId} className="folder-children">
            {children.map((c) => node(c, depth + 1))}
          </ul>
        )}
      </li>
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
        {...dropProps("all", undefined)}
      >
        <Icon name="folder" size={17} />
        {t("모든 자료")}
      </button>
      {folders.length > 0 && (
        <ul className="folder-tree-list" aria-label={t("폴더 목록")}>
          {rootFolders(folders).map((f) => node(f))}
        </ul>
      )}
      {folders.length > 0 && (
        <p className="folder-drop-hint">
          {t(
            "자료를 폴더로 끌어 놓거나, 자료의 ‘폴더로 옮기기’ 메뉴로 옮길 수 있어요.",
          )}
        </p>
      )}
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
        <Disclosure className="archived-folders" summary={t("보관한 폴더")}>
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
        </Disclosure>
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
                    // 자기 자신과 하위 폴더는 상위 폴더로 고를 수 없어요(순환 방지).
                    ...parentFolderOptions(folders, draft.id).map((f) => ({
                      value: f.id,
                      label: f.title,
                    })),
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
                <Button
                  type="submit"
                  disabled={busy || !draft.title.trim()}
                  aria-describedby={titleReason.describedBy}
                >
                  {busy ? t("저장 중") : t("저장")}
                </Button>
              </div>
              {titleReason.node}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  );
}
