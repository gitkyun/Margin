import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import type { Material, MaterialFolder } from "@/lib/domain";
import { folderPath } from "@/lib/docs-list";
import { materialTypeLabel } from "@/lib/docs-labels";
import { t } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { useWorkspace } from "@/lib/workspace";

const MATERIAL_TYPES: readonly Material["type"][] = [
  "reference",
  "draft",
  "analysis",
  "other",
];

export interface BatchActionsBarProps {
  researchId: string;
  materialIds: readonly string[];
  folders: readonly MaterialFolder[];
  onDismiss(): void;
}

/** 방금 올린 자료를 한 번에 폴더·유형·공개 범위로 정리하는 인라인 바. */
export function BatchActionsBar({
  researchId,
  materialIds,
  folders,
  onDismiss,
}: BatchActionsBarProps) {
  const { data, user, save, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);

  const targets = data.materials.filter(
    (m) =>
      m.researchId === researchId &&
      !m.archivedAt &&
      materialIds.includes(m.id),
  );
  if (!targets.length) return null;

  const sortedFolders = folders
    .map((f) => ({ id: f.id, label: folderPath(folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));

  async function applyAll(
    updater: (material: Material) => Material,
    successMessage: string,
  ) {
    if (busy) return;
    setBusy(true);
    let updated = 0;
    let conflicted = false;
    try {
      for (const item of targets) {
        const latest =
          data.materials.find((m) => m.id === item.id) ?? item;
        try {
          await save("materials", updater(latest), { skipRefresh: true });
          updated += 1;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === "40001") {
            conflicted = true;
          } else {
            throw err;
          }
        }
      }
      await refresh();
      if (conflicted) {
        toast.warning(
          t("일부 자료가 다른 창에서 바뀌어 최신 상태로 불러왔어요. 다시 적용해 주세요."),
        );
      } else if (updated > 0) {
        toast.success(successMessage);
      }
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  const allMine = targets.every((m) => !m.createdBy || m.createdBy === user.id);

  return (
    <div
      className="batch-actions-bar"
      role="region"
      aria-label={t("방금 올린 자료 일괄 정리")}
    >
      <div className="batch-actions-summary">
        <Icon name="check" size={15} />
        <strong>
          {t("방금 올린 자료 {count}개", { count: targets.length })}
        </strong>
        <span>{t("기본 나만 보기로 저장됐어요.")}</span>
      </div>
      <div className="batch-actions-controls">
        {sortedFolders.length > 0 && (
          <select
            className="batch-actions-select"
            aria-label={t("일괄 폴더 이동")}
            disabled={busy}
            value=""
            onChange={(event) => {
              const val = event.target.value;
              if (!val) return;
              const folderId = val === "__none__" ? undefined : val;
              const name =
                sortedFolders.find((f) => f.id === folderId)?.label ?? "";
              void applyAll(
                (m) => ({ ...m, folderId }),
                folderId
                  ? t("{count}개 자료를 ‘{folder}’ 폴더로 옮겼어요.", {
                      count: targets.length,
                      folder: name,
                    })
                  : t("{count}개 자료를 폴더에서 뺐어요.", {
                      count: targets.length,
                    }),
              );
            }}
          >
            <option value="">{t("폴더로 옮기기")}</option>
            <option value="__none__">{t("폴더 없음")}</option>
            {sortedFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        )}
        <select
          className="batch-actions-select"
          aria-label={t("일괄 자료 유형 지정")}
          disabled={busy}
          value=""
          onChange={(event) => {
            const val = event.target.value as Material["type"] | "";
            if (!val) return;
            void applyAll(
              (m) => ({ ...m, type: val, typeExplicit: true }),
              t("{count}개 자료 유형을 ‘{type}’으로 지정했어요.", {
                count: targets.length,
                type: materialTypeLabel(val),
              }),
            );
          }}
        >
          <option value="">{t("유형 지정")}</option>
          {MATERIAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {materialTypeLabel(type)}
            </option>
          ))}
        </select>
        {allMine && (
          <select
            className="batch-actions-select"
            aria-label={t("일괄 공개 범위 변경")}
            disabled={busy}
            value=""
            onChange={(event) => {
              const val = event.target.value as "private" | "shared" | "";
              if (!val) return;
              void applyAll(
                (m) => ({ ...m, visibility: val }),
                val === "shared"
                  ? t("{count}개 자료를 함께 보기로 바꿨어요.", {
                      count: targets.length,
                    })
                  : t("{count}개 자료를 나만 보기로 바꿨어요.", {
                      count: targets.length,
                    }),
              );
            }}
          >
            <option value="">{t("공개 범위")}</option>
            <option value="private">{t("나만 보기")}</option>
            <option value="shared">{t("함께 보기")}</option>
          </select>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onDismiss}
        >
          {t("완료")}
        </Button>
      </div>
    </div>
  );
}
