import { t } from "@/lib/i18n";
import type { ReactNode } from "react";
import { Popover } from "radix-ui";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VisibilityField } from "@/components/experience";
import {
  formatDateTime,
  type DocumentRecord,
  type DocumentVersion,
} from "@/lib/domain";
import type { OutlineEntry } from "@/lib/editor-head";
import "./editor.css";

export const DOC_TYPE_LABEL: Record<DocumentRecord["type"], string> = {
  plan: t("계획서"),
  manuscript: t("원고"),
  note: t("메모"),
};

export type SaveState = "saving" | "dirty" | "failed" | "saved";

/** 목차 목록. 넓은 판에서는 왼쪽 열, 좁은 판에서는 머리의 [목차] 팝오버 안에 놓입니다. */
export function Outline({
  entries,
  onPick,
}: {
  entries: OutlineEntry[];
  onPick: (index: number) => void;
}) {
  if (!entries.length)
    return (
      <p className="editor-outline-empty">
        {t("소제목을 넣으면 목차가 생겨요.")}
      </p>
    );
  return (
    <ul className="editor-outline-list">
      {entries.map((entry) => (
        <li key={entry.index} data-level={entry.level}>
          <button
            type="button"
            title={entry.text}
            onClick={() => onPick(entry.index)}
          >
            {entry.text || t("제목 없음")}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * 글 편집(W2) 머리(IA v2 05 §3.3): 제목 · 종류 배지 · 저장 상태 · 공개 범위 |
 * [목차](좁은 판) [버전 ▾] [문장 점검] [⋯].
 */
export function EditorHeader({
  titleField,
  type,
  save,
  savedAt,
  onRetry,
  visibility,
  onVisibility,
  outline,
  onOutline,
  versions,
  onKeepVersion,
  onOpenVersion,
  review,
  onEditInfo,
  onShowInfo,
  onPdf,
  onArchive,
  busy,
}: {
  titleField: ReactNode;
  type: DocumentRecord["type"];
  save: SaveState;
  savedAt: string;
  onRetry: () => void;
  visibility: "private" | "shared";
  onVisibility: (value: "private" | "shared") => void;
  outline: OutlineEntry[];
  onOutline: (index: number) => void;
  versions: DocumentVersion[];
  onKeepVersion: () => void;
  onOpenVersion: (id: string) => void;
  review: {
    disabled: boolean;
    hint: string;
    selection: boolean;
    onStart: () => void;
  };
  onEditInfo: () => void;
  onShowInfo: () => void;
  onPdf: () => void;
  onArchive: () => void;
  busy: boolean;
}) {
  return (
    <header className="editor-head">
      <div className="editor-head-main">
        {titleField}
        <div className="editor-head-meta">
          <span className="editor-type-badge">{DOC_TYPE_LABEL[type]}</span>
          <span className="editor-save" role="status">
            {/* 상태가 바뀔 때마다 key가 바뀌어 흐림→선명 전환이 한 번 재생돼요 */}
            <span key={save} className="text-swap">
              {save === "saving" ? (
                t("저장 중")
              ) : save === "failed" ? (
                <>
                  <Icon name="warning" size={14} />
                  {t("저장 실패")}
                </>
              ) : save === "dirty" ? (
                t("저장하지 않은 변경")
              ) : (
                t("저장됨 · {time}", { time: savedAt })
              )}
            </span>
          </span>
          {save === "failed" && (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              {t("다시 시도")}
            </Button>
          )}
          <VisibilityField compact value={visibility} onChange={onVisibility} />
        </div>
      </div>
      <div className="editor-head-actions">
        {/* 넓은 판에서는 목차가 왼쪽 열에 있어 이 버튼을 숨깁니다(05 §3.1). */}
        <span className="editor-outline-trigger">
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="outline">
                <Icon name="list" size={16} />
                {t("목차")}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="editor-outline-popover"
                align="start"
                sideOffset={6}
                collisionPadding={16}
              >
                <Outline
                  entries={outline}
                  onPick={(index) => onOutline(index)}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" disabled={busy}>
              <Icon name="history" size={16} />
              {t("버전")}
              <Icon name="chevron-down" size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onKeepVersion}>
              {t("지금 버전 남기기")}
            </DropdownMenuItem>
            {versions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>
                  {t("지금 내용과 비교할 버전")}
                </DropdownMenuLabel>
                {[...versions]
                  .reverse()
                  .slice(0, 12)
                  .map((v) => (
                    <DropdownMenuItem
                      key={v.id}
                      onSelect={() => onOpenVersion(v.id)}
                    >
                      {t("v{number} · {date}", {
                        number: v.number,
                        date: formatDateTime(v.createdAt),
                      })}
                    </DropdownMenuItem>
                  ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Hint label={review.hint} position="bottom-center">
          <span>
            <Button
              variant="outline"
              disabled={review.disabled}
              // 누를 때 본문의 선택 영역이 풀리지 않게 합니다(고른 부분만 점검).
              onMouseDown={(e) => e.preventDefault()}
              onClick={review.onStart}
            >
              <Icon name="sparkles" size={16} />
              {review.selection ? t("고른 부분 문장 점검") : t("문장 점검")}
            </Button>
          </span>
        </Hint>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="icon" aria-label={t("글 메뉴")}>
              <Icon name="more" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditInfo}>
              {t("글 정보")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShowInfo}>
              {t("정보 보기")}
            </DropdownMenuItem>
            {!busy && (
              <DropdownMenuItem onSelect={onPdf}>
                {t("검토용 PDF 만들기")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {!busy && (
              <DropdownMenuItem onSelect={onArchive}>
                {t("보관")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
