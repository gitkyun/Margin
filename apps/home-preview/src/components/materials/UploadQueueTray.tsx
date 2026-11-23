import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icons";
import { Choice } from "@/components/experience";
import { VisibilityControl } from "./VisibilityControl";
import type { Material } from "@/lib/domain";
import { folderPath } from "@/lib/docs-list";
import { materialTypeLabel } from "@/lib/docs-labels";
import { t } from "@/lib/i18n";
import {
  useUploadQueue,
  type StagedUploadFile,
  type UploadJob,
} from "@/lib/upload-queue";
import { useWorkspace } from "@/lib/workspace";
import "./upload-queue.css";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "__unset__", label: t("미분류") },
  { value: "reference", label: materialTypeLabel("reference") },
  { value: "draft", label: materialTypeLabel("draft") },
  { value: "analysis", label: materialTypeLabel("analysis") },
  { value: "other", label: materialTypeLabel("other") },
];

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 전역 비차단 업로드 트레이 + 정보 먼저 확인하기 시트 + 중복 후보 확인 창.
 * RmsApp에 마운트되어 화면을 이동해도 업로드 상태가 유지됩니다.
 */
export function UploadQueueTray() {
  const {
    jobs,
    stagedFiles,
    duplicates,
    collapsed,
    setCollapsed,
    confirmStaged,
    cancelStaged,
    resolveDuplicate,
    cancelJob,
    retryJob,
    retryAllFailed,
    clearTray,
  } = useUploadQueue();

  const visibleJobs = jobs.filter((j) => j.status !== "cancelled");
  const doneCount = visibleJobs.filter((j) => j.status === "done").length;
  const failedCount = visibleJobs.filter(
    (j) => j.status === "failed_upload" || j.status === "failed_register",
  ).length;
  const activeCount = visibleJobs.filter(
    (j) =>
      j.status === "queued" ||
      j.status === "uploading" ||
      j.status === "registering",
  ).length;

  // 모두 끝나고 실패가 없으면 3초 뒤 머리줄만 남겨 접어요(완료 알림을 한 번만 보여 주기).
  useEffect(() => {
    if (activeCount > 0 || failedCount > 0 || doneCount === 0) return;
    const timer = window.setTimeout(() => setCollapsed(true), 3000);
    return () => window.clearTimeout(timer);
  }, [activeCount, failedCount, doneCount, setCollapsed]);

  const sortedJobs = [...visibleJobs].sort((a, b) => {
    const rank = (s: UploadJob["status"]) =>
      s === "failed_upload" || s === "failed_register"
        ? 0
        : s === "uploading" || s === "registering" || s === "queued"
          ? 1
          : 2;
    return rank(a.status) - rank(b.status) || b.createdAt - a.createdAt;
  });

  const summaryTitle =
    failedCount > 0
      ? t("자료 올리기 ({done}/{total}) · {failed}개 실패", {
          done: doneCount,
          total: visibleJobs.length,
          failed: failedCount,
        })
      : activeCount > 0
        ? t("자료 올리는 중 ({done}/{total})", {
            done: doneCount,
            total: visibleJobs.length,
          })
        : t("{count}개 자료 추가됨", { count: doneCount });

  return (
    <>
      {visibleJobs.length > 0 && (
        <aside
          className="upload-tray"
          data-collapsed={collapsed ? "" : undefined}
          role="region"
          aria-label={t("자료 올리기 진행 상태")}
        >
          <div className="upload-tray-head">
            <button
              type="button"
              className="upload-tray-toggle"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Icon
                name={
                  failedCount > 0
                    ? "warning"
                    : activeCount > 0
                      ? "upload"
                      : "check"
                }
                size={16}
              />
              <span>{summaryTitle}</span>
            </button>
            <div className="upload-tray-head-actions">
              {failedCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retryAllFailed}
                >
                  {t("실패 재시도")}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={
                  collapsed ? t("진행 목록 펼치기") : t("진행 목록 접기")
                }
                onClick={() => setCollapsed(!collapsed)}
              >
                <Icon
                  name={collapsed ? "chevron-up" : "chevron-down"}
                  size={15}
                />
              </Button>
              {activeCount === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("업로드 알림 닫기")}
                  onClick={clearTray}
                >
                  <Icon name="close" size={15} />
                </Button>
              )}
            </div>
          </div>

          <div className="upload-tray-body">
            <div className="upload-tray-body-inner">
              <ul className="upload-tray-list">
                {sortedJobs.map((job) => (
                  <li
                    key={job.id}
                    className="upload-item"
                    data-status={job.status}
                  >
                    <div className="upload-item-top">
                      <span className="upload-item-name" title={job.title}>
                        {job.title}
                      </span>
                      <span className="upload-item-meta">
                        {job.status === "queued" && t("대기")}
                        {job.status === "uploading" && `${job.progress}%`}
                        {job.status === "registering" && t("등록 중")}
                        {job.status === "done" && (
                          <>
                            <span>{t("저장됨")}</span>
                            {job.completedMaterialId && (
                              <Link
                                to={`/r/${job.researchId}/docs/m/${job.completedMaterialId}`}
                              >
                                {t("열기")}
                              </Link>
                            )}
                          </>
                        )}
                        {(job.status === "queued" ||
                          job.status === "uploading") && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelJob(job.id)}
                          >
                            {t("취소")}
                          </Button>
                        )}
                        {job.status === "failed_upload" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => retryJob(job.id)}
                          >
                            {t("재시도")}
                          </Button>
                        )}
                        {job.status === "failed_register" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => retryJob(job.id)}
                          >
                            {t("등록 다시 시도")}
                          </Button>
                        )}
                      </span>
                    </div>
                    {job.error && (
                      <p className="upload-item-error" role="alert">
                        {job.error}
                      </p>
                    )}
                    <div className="upload-item-track" aria-hidden="true">
                      <div
                        className="upload-item-fill"
                        style={{
                          transform: `scaleX(${
                            job.status === "done"
                              ? 1
                              : job.status === "failed_register"
                                ? 1
                                : Math.max(0.04, job.progress / 100)
                          })`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <span className="sr-only" aria-live="polite">
            {summaryTitle}
          </span>
        </aside>
      )}

      {stagedFiles.length > 0 && (
        <MetadataReviewDialog
          items={stagedFiles}
          onConfirm={confirmStaged}
          onCancel={cancelStaged}
        />
      )}

      {duplicates.length > 0 && (
        <DuplicateDialog
          candidate={duplicates[0]}
          remaining={duplicates.length}
          onResolve={(action) => resolveDuplicate(duplicates[0].id, action)}
        />
      )}
    </>
  );
}

function MetadataReviewDialog({
  items,
  onConfirm,
  onCancel,
}: {
  items: StagedUploadFile[];
  onConfirm(edited: StagedUploadFile[]): void;
  onCancel(): void;
}) {
  const { data } = useWorkspace();
  const [drafts, setDrafts] = useState<StagedUploadFile[]>(items);
  useEffect(() => {
    setDrafts(items);
  }, [items]);

  const researchId = items[0]?.researchId ?? "";
  const folders = data.folders
    .filter((f) => f.researchId === researchId && !f.archivedAt)
    .map((f) => ({ value: f.id, label: folderPath(data.folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const hasCollaborators =
    data.members.filter(
      (m) => m.researchId === researchId && m.status === "active",
    ).length > 1;

  function updateDraft(id: string, patch: Partial<StagedUploadFile>) {
    setDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  function updateAll(patch: Partial<StagedUploadFile>) {
    setDrafts((prev) => prev.map((item) => ({ ...item, ...patch })));
  }
  const typeValue = (draft: StagedUploadFile) =>
    draft.typeExplicit ? draft.type : "__unset__";
  const typePatch = (val: string): Partial<StagedUploadFile> =>
    val === "__unset__"
      ? { type: "other", typeExplicit: false }
      : { type: val as Material["type"], typeExplicit: true };
  // '모두에 적용' 칸은 모든 파일이 같은 값일 때만 그 값을 보여 줘요.
  const same = <T,>(pick: (d: StagedUploadFile) => T) =>
    drafts.every((d) => pick(d) === pick(drafts[0]))
      ? pick(drafts[0])
      : undefined;
  const allType = same(typeValue);
  const allFolder = same((d) => d.folderId ?? "__none__");
  const allVisibility = same((d) => d.visibility) ?? "private";

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="rms-dialog staging-dialog">
        <DialogHeader>
          <DialogTitle>
            {drafts.length === 1
              ? t("파일 추가")
              : t("파일 {count}개 추가", { count: drafts.length })}
          </DialogTitle>
          <DialogDescription>
            {t("이름과 정보를 확인하고 추가하세요. 나중에 바꿀 수도 있어요.")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(drafts);
          }}
        >
          <DialogBody>
            <div
              className="staging-apply"
              role="group"
              aria-label={t("모든 파일에 적용")}
            >
              <Choice
                compact
                label={t("자료 유형")}
                value={allType ?? ""}
                onChange={(val) => updateAll(typePatch(val))}
                options={[
                  ...(allType === undefined
                    ? [{ value: "", label: t("유형 여러 개") }]
                    : []),
                  ...TYPE_OPTIONS,
                ]}
              />
              <Choice
                compact
                label={t("폴더")}
                value={allFolder ?? ""}
                onChange={(val) =>
                  updateAll({ folderId: val === "__none__" ? undefined : val })
                }
                options={[
                  ...(allFolder === undefined
                    ? [{ value: "", label: t("폴더 여러 개") }]
                    : []),
                  { value: "__none__", label: t("폴더 없음") },
                  ...folders,
                ]}
              />
              <VisibilityControl
                compact
                value={allVisibility}
                hasCollaborators={hasCollaborators}
                onChange={(visibility) => updateAll({ visibility })}
              />
            </div>
            <ul className="staging-list">
              {drafts.map((draft) => (
                <li key={draft.id} className="staging-row">
                  <Icon name="file" size={16} />
                  <Input
                    required
                    maxLength={200}
                    aria-label={t("{fileName} 자료 이름", {
                      fileName: draft.file.name,
                    })}
                    value={draft.title}
                    onChange={(e) =>
                      updateDraft(draft.id, { title: e.target.value })
                    }
                  />
                  {drafts.length > 1 && (
                    <Choice
                      compact
                      label={t("{fileName} 자료 유형", {
                        fileName: draft.file.name,
                      })}
                      value={typeValue(draft)}
                      onChange={(val) => updateDraft(draft.id, typePatch(val))}
                      options={TYPE_OPTIONS}
                    />
                  )}
                  <span className="staging-row-size">
                    {formatSize(draft.file.size)}
                  </span>
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("취소")}
            </Button>
            <Button type="submit">
              {drafts.length === 1
                ? t("추가")
                : t("{count}개 추가", { count: drafts.length })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({
  candidate,
  remaining,
  onResolve,
}: {
  candidate: {
    id: string;
    file: File;
    existingMaterial: Material;
    existingVersion: { number: number; fileName: string };
  };
  remaining: number;
  onResolve(action: "new_version" | "keep_existing" | "new_material"): void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onResolve("keep_existing")}>
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>
            {remaining > 1
              ? t("같은 이름·크기의 파일이 이미 있어요 ({count}개 남음)", {
                  count: remaining,
                })
              : t("같은 이름·크기의 파일이 이미 있어요")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "‘{fileName}’이 기존 자료 ‘{title}’ (v{number})과 이름과 크기가 같아요. 어떻게 처리할까요?",
              {
                fileName: candidate.file.name,
                title: candidate.existingMaterial.title,
                number: candidate.existingVersion.number,
              },
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onResolve("keep_existing")}
          >
            {t("기존 자료 유지")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onResolve("new_material")}
          >
            {t("별도 자료로 추가")}
          </Button>
          <Button type="button" onClick={() => onResolve("new_version")}>
            {t("새 버전(v{next})으로 올리기", {
              next: candidate.existingVersion.number + 1,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
