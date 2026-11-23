import { dateLocale, t } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Popover } from "radix-ui";
import { Icon } from "@/components/icons";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Choice } from "@/components/experience";
import { Input } from "@/components/ui/input";
import { InlineEmpty } from "@/components/common";
import {
  safeUrl,
  type Material,
  type MaterialFolder,
  type MaterialVersion,
} from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace";
import { folderPath } from "@/lib/docs-list";
import "./material-view.css";

function byteSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 자료 보기(W3) 머리(IA v2 05 §4): 제목 · 종류 배지 · 버전 고르기 |
 * [정보](좁은 판) [새 버전 올리기] [내려받기] [⋯].
 */
export function MaterialHeader({
  material,
  typeLabel,
  versions,
  selected,
  onVersion,
  onUpload,
  onDownload,
  onEdit,
  onMove,
  archived,
  onArchive,
  info,
}: {
  material: Material;
  typeLabel: string;
  versions: MaterialVersion[];
  selected?: MaterialVersion;
  onVersion: (id: string) => void;
  onUpload: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onMove: () => void;
  /** 보관한 자료를 주소로 열었을 때는 ⋯에 '복원'을 둡니다. */
  archived: boolean;
  onArchive: () => void;
  info: ReactNode;
}) {
  return (
    <header className="material-head">
      <div className="material-head-main">
        <h1 className="material-head-title">{material.title}</h1>
        <span className="material-badge">{typeLabel}</span>
        {material.externalUrl && (
          <span className="material-badge">{t("링크")}</span>
        )}
        {selected && versions.length > 1 && (
          <Choice
            compact
            label={t("파일 버전")}
            value={selected.id}
            onChange={onVersion}
            options={versions.map((v) => ({
              value: v.id,
              label: `v${v.number}`,
            }))}
          />
        )}
        {selected && versions.length === 1 && (
          <span className="material-head-version">v{selected.number}</span>
        )}
      </div>
      <div className="material-head-actions">
        {/* 넓은 판에서는 정보가 오른쪽 열에 있어 이 버튼을 숨깁니다(05 §4). */}
        <span className="material-info-trigger">
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="outline">
                <Icon name="info" size={16} />
                {t("정보")}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="material-info-popover"
                align="end"
                sideOffset={6}
                collisionPadding={16}
              >
                {info}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </span>
        <Button variant="outline" onClick={onUpload}>
          <Icon name="upload" size={16} />
          {t("새 버전 올리기")}
        </Button>
        {selected && (
          <Button variant="outline" onClick={onDownload}>
            <Icon name="download" size={16} />
            {t("내려받기")}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="icon" aria-label={t("자료 메뉴")}>
              <Icon name="more" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              {t("정보 편집")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMove}>
              {t("폴더로 옮기기")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}>
              {archived ? t("복원") : t("보관")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/** 자료 보기 정보 열(05 §4): 버전 목록과 이 버전을 쓴 기록. */
export function MaterialInfo({
  researchId,
  versions,
  selected,
  onVersion,
}: {
  researchId: string;
  versions: MaterialVersion[];
  selected?: MaterialVersion;
  onVersion: (id: string) => void;
}) {
  const { data } = useWorkspace();
  const results = selected
    ? data.results.filter(
        (result) => result.versionId === selected.id && !result.archivedAt,
      )
    : [];
  const meetings = selected
    ? data.meetings.filter(
        (meeting) =>
          meeting.versionIds.includes(selected.id) && !meeting.archivedAt,
      )
    : [];
  const day = new Intl.DateTimeFormat(dateLocale(), {
    month: "long",
    day: "numeric",
  });
  return (
    <div className="material-info">
      <section>
        <h2>{t("버전")}</h2>
        {versions.length ? (
          <ul className="material-info-versions">
            {versions.map((version) => (
              <li key={version.id}>
                <button
                  type="button"
                  aria-current={selected?.id === version.id || undefined}
                  onClick={() => onVersion(version.id)}
                >
                  <strong>v{version.number}</strong>
                  <span>
                    {day.format(new Date(version.createdAt))} ·{" "}
                    {byteSize(version.size)}
                  </span>
                  {selected?.id === version.id && (
                    <Icon name="check" size={14} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <InlineEmpty>
            {t("PDF를 올리면 여기에서 버전별로 다시 열 수 있어요.")}
          </InlineEmpty>
        )}
        <p className="material-info-note">
          {t("새 파일을 올려도 이전 버전과 검토에 쓴 파일은 그대로 남아요.")}
        </p>
      </section>
      {selected && (
        <section>
          <h2>{t("이 버전을 쓴 기록")}</h2>
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              className="material-info-row"
              to={`/r/${researchId}/meetings/${meeting.id}`}
            >
              <span>{meeting.title}</span>
              <small>{t("미팅 준비")}</small>
            </Link>
          ))}
          {results.map((result) => (
            <Link
              key={result.id}
              className="material-info-row"
              to={`/r/${researchId}/results/${result.id}`}
            >
              <span>{t("수정 결과 ‘{title}’", { title: result.title })}</span>
              <small>{result.location || t("볼 위치 없음")}</small>
            </Link>
          ))}
          {!meetings.length && !results.length && (
            <InlineEmpty>
              {t("아직 이 버전을 사용한 기록이 없어요.")}
            </InlineEmpty>
          )}
        </section>
      )}
    </div>
  );
}

/** 링크 자료: PDF 자리의 주소 카드(05 §4). http·https만 엽니다. */
export function LinkCard({ url, onCopy }: { url: string; onCopy: () => void }) {
  return (
    <section className="material-link-card">
      <Icon name="link" size={20} />
      <div>
        <strong>{t("원본 문서")}</strong>
        <p>
          {t(
            "링크한 문서는 원래 서비스에서 내용이 바뀔 수 있어요. 링크만으로는 지금 내용이 남지 않아요.",
          )}
        </p>
        <span className="material-link-url">{url}</span>
      </div>
      <div className="material-link-actions">
        <Button asChild variant="outline">
          <a href={url} target="_blank" rel="noopener noreferrer">
            {t("링크 열기")}
            <Icon name="arrow-up-right" size={16} />
          </a>
        </Button>
        <Button variant="outline" onClick={onCopy}>
          {t("복사")}
        </Button>
      </div>
    </section>
  );
}

/** ⋯ › 폴더로 옮기기(05 §4) */
export function MoveFolderDialog({
  open,
  onOpenChange,
  folders,
  value,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: readonly MaterialFolder[];
  value?: string;
  onMove: (folderId: string | undefined) => Promise<void>;
}) {
  const NONE = "none";
  const [choice, setChoice] = useState(value ?? NONE);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setChoice(value ?? NONE);
  }, [open]);
  const options = folders
    .map((f) => ({ value: f.id, label: folderPath(folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>{t("폴더로 옮기기")}</DialogTitle>
          <DialogDescription>
            {t("폴더를 바꿔도 파일과 버전은 그대로예요.")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            onMove(choice === NONE ? undefined : choice)
              .then(() => onOpenChange(false))
              .finally(() => setBusy(false));
          }}
        >
          <DialogBody>
            <label className="field">
              <span>{t("폴더")}</span>
              <Choice
                label={t("폴더")}
                value={choice}
                onChange={setChoice}
                options={[{ value: NONE, label: t("폴더 없음") }, ...options]}
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
            <Button type="submit" disabled={busy}>
              {busy ? t("옮기는 중") : t("옮기기")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 줄 메뉴 › 정보 편집(05 §2.3, §4 ⋯): 이름·종류·공개 범위·링크. 폴더는 '폴더로 옮기기'에서 바꿉니다. */
export function MaterialInfoDialog({
  open,
  onOpenChange,
  material,
  typeOptions,
  canEditVisibility = true,
  hasCollaborators = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material;
  typeOptions: { value: Material["type"]; label: string }[];
  canEditVisibility?: boolean;
  hasCollaborators?: boolean;
  onSave: (next: Material) => Promise<void>;
}) {
  const [draft, setDraft] = useState(material);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setDraft(material);
    setError("");
  }, [open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>{t("자료 정보 편집")}</DialogTitle>
          <DialogDescription>
            {t("이름과 종류를 바꿔도 올린 파일과 버전은 그대로예요.")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            const title = draft.title.trim();
            if (!title) return setError(t("자료 이름을 적어 주세요."));
            let externalUrl = draft.externalUrl;
            if (material.externalUrl !== undefined) {
              externalUrl = safeUrl(draft.externalUrl ?? "") ?? undefined;
              if (!externalUrl)
                return setError(
                  t("http 또는 https로 시작하는 링크를 적어 주세요."),
                );
            }
            setBusy(true);
            setError("");
            onSave({ ...draft, title, externalUrl })
              .then(() => onOpenChange(false))
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(false));
          }}
        >
          <DialogBody>
            <label className="field">
              <span>{t("자료 이름")}</span>
              <Input
                value={draft.title}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t("자료 종류")}</span>
              <Choice
                label={t("자료 종류")}
                value={draft.typeExplicit ? draft.type : "__unset__"}
                onChange={(v) =>
                  v === "__unset__"
                    ? setDraft({ ...draft, type: "other", typeExplicit: false })
                    : setDraft({
                        ...draft,
                        type: v as Material["type"],
                        typeExplicit: true,
                      })
                }
                options={[{ value: "__unset__", label: t("미분류") }, ...typeOptions]}
              />
            </label>
            <div className="field">
              <span>{t("공개 범위")}</span>
              <Choice
                label={t("공개 범위")}
                disabled={!canEditVisibility}
                value={draft.visibility ?? "shared"}
                onChange={(v) =>
                  setDraft({ ...draft, visibility: v as "private" | "shared" })
                }
                options={[
                  { value: "private", label: t("나만 보기") },
                  { value: "shared", label: t("함께 보기") },
                ]}
              />
              {!canEditVisibility && (
                <small className="material-info-note">
                  {t("작성자만 공개 범위를 바꿀 수 있어요.")}
                </small>
              )}
              {canEditVisibility &&
                hasCollaborators &&
                draft.visibility === "private" && (
                  <small className="material-info-note">
                    {t(
                      "나만 볼 수 있어요. 공동연구자와 함께 보려면 ‘함께 보기’로 바꿔 주세요.",
                    )}
                  </small>
                )}
            </div>
            {material.externalUrl !== undefined && (
              <label className="field">
                <span>{t("링크")}</span>
                <Input
                  type="url"
                  value={draft.externalUrl ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, externalUrl: e.target.value })
                  }
                />
              </label>
            )}
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
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {t("취소")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("저장 중") : t("저장")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
