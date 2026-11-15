import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { AIContext, AIInput, WorkspaceData } from "@/lib/domain";
import { modeLabels } from "@/lib/experience";
import { koreanScore } from "@/lib/hangul-search";
import { t } from "@/lib/i18n";

export interface ComposerCommand {
  id: Exclude<
    AIInput["mode"],
    "ask_research" | "propose_roadmap" | "continue_writing" | "inline_edit"
  >;
  label: string;
  description: string;
  icon: string;
}

export const COMPOSER_COMMANDS: ComposerCommand[] = [
  {
    id: "organize_meeting",
    label: String(modeLabels.organize_meeting),
    description: t("미팅 메모에서 피드백·결정·질문을 뽑아요"),
    icon: "calendar",
  },
  {
    id: "suggest_revisions",
    label: String(modeLabels.suggest_revisions),
    description: t("피드백이나 원고를 보고 고칠 방법을 제안해요"),
    icon: "sparkles",
  },
  {
    id: "review_writing",
    label: String(modeLabels.review_writing),
    description: t("고른 원고의 흐름·근거·문장을 점검해요"),
    icon: "edit",
  },
  {
    id: "plan_research",
    label: String(modeLabels.plan_research),
    description: t("고른 기록에서 해야 할 일을 정리해요"),
    icon: "check",
  },
  {
    id: "read_material",
    label: String(modeLabels.read_material),
    description: t("첨부한 자료나 PDF 핵심 내용을 요약해요"),
    icon: "file",
  },
];

export function findComposerCommand(
  mode: AIInput["mode"],
): ComposerCommand | undefined {
  return COMPOSER_COMMANDS.find((c) => c.id === mode);
}

/** 설명 문장으로만 맞으면 이름으로 맞은 것보다 아래에 둬요. */
const DESCRIPTION_WEIGHT = 0.5;

export function filterComposerCommands(query: string): ComposerCommand[] {
  const q = query.trim();
  if (!q) return COMPOSER_COMMANDS;
  // 이름으로 맞은 항목이 설명으로만 맞은 항목보다 앞에 와요(같은 점수면 원래 순서).
  return COMPOSER_COMMANDS.map((command, order) => ({
    command,
    order,
    score: Math.max(
      koreanScore(command.label, q),
      koreanScore(command.description, q) * DESCRIPTION_WEIGHT,
    ),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((entry) => entry.command);
}

export function ComposerCommandMenu({
  commands,
  activeIndex,
  onSelect,
}: {
  commands: ComposerCommand[];
  activeIndex: number;
  onSelect: (id: ComposerCommand["id"]) => void;
}) {
  return (
    <div
      className="composer-command-menu"
      role="listbox"
      aria-label={t("요청 종류 선택")}
    >
      <p className="composer-command-heading">{t("요청 종류")}</p>
      {commands.length ? (
        commands.map((cmd, index) => (
          <button
            key={cmd.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={`composer-command-item${index === activeIndex ? " is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(cmd.id);
            }}
          >
            <Icon name={cmd.icon} size={15} />
            <span>
              <strong>{cmd.label}</strong>
              <small>{cmd.description}</small>
            </span>
          </button>
        ))
      ) : (
        <p className="composer-command-empty">
          {t("맞는 요청 종류가 없어요.")}
        </p>
      )}
    </div>
  );
}

export function ComposerCommandPill({
  command,
  disabled,
  onClear,
}: {
  command: ComposerCommand;
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <span className="composer-command-pill">
      <Icon name={command.icon} size={13} />
      <span>{command.label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={t("{label} 선택 해제", { label: command.label })}
        onClick={onClear}
      >
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}

export interface QueuedQuestion {
  id: string;
  text: string;
  mode: AIInput["mode"];
}

export function ComposerQueue({
  items,
  onMove,
  onEdit,
  onSendNow,
  onRemove,
  onClear,
}: {
  items: QueuedQuestion[];
  onMove: (index: number, delta: -1 | 1) => void;
  onEdit: (id: string) => void;
  onSendNow: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="composer-queue" aria-label={t("보낼 질문 대기 줄")}>
      <div className="composer-queue-head">
        <span>{t("대기 중 {count}건", { count: items.length })}</span>
        <button type="button" onClick={onClear}>
          {t("비우기")}
        </button>
      </div>
      <ol className="composer-queue-list">
        {items.map((item, idx) => (
          <li key={item.id} className="composer-queue-item">
            <span className="composer-queue-num">{idx + 1}</span>
            <span className="composer-queue-text" title={item.text}>
              {item.text}
            </span>
            <div className="composer-queue-actions">
              <button
                type="button"
                disabled={idx === 0}
                aria-label={t("위로 옮기기")}
                onClick={() => onMove(idx, -1)}
              >
                <Icon name="arrow-up" size={12} />
              </button>
              <button
                type="button"
                disabled={idx === items.length - 1}
                aria-label={t("아래로 옮기기")}
                onClick={() => onMove(idx, 1)}
              >
                <Icon name="chevron-down" size={12} />
              </button>
              <button
                type="button"
                aria-label={t("대기 질문 고치기")}
                onClick={() => onEdit(item.id)}
              >
                <Icon name="edit" size={12} />
              </button>
              <button
                type="button"
                className="composer-queue-send-now"
                onClick={() => onSendNow(item.id)}
              >
                {t("지금 보내기")}
              </button>
              <button
                type="button"
                aria-label={t("대기 질문 지우기")}
                onClick={() => onRemove(item.id)}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const MAX_CONTEXT_COUNT = 8;
const MAX_CONTEXT_CHARS = 50_000;
const MAX_HISTORY_COUNT = 10;
const MAX_HISTORY_CHARS = 30_000;
const MAX_QUESTION_CHARS = 2_000;

function contextCharCount(c: AIContext, data: WorkspaceData): number | null {
  if (typeof c.text === "string") return c.text.length;
  if (c.kind === "meetings")
    return data.meetings.find((m) => m.id === c.id)?.memo.length ?? null;
  if (c.kind === "feedback")
    return data.feedback.find((f) => f.id === c.id)?.body.length ?? null;
  if (c.kind === "documents")
    return data.documents.find((d) => d.id === c.id)?.text.length ?? null;
  if (c.kind === "attachments")
    return data.attachments.find((a) => a.id === c.id)?.text.length ?? null;
  return null;
}

export function ComposerContextMeter({
  contexts,
  data,
  draft,
  history,
  disabled,
  onNewChat,
}: {
  contexts: AIContext[];
  data: WorkspaceData;
  draft: string;
  history: ReadonlyArray<{ role: string; text: string }>;
  disabled: boolean;
  onNewChat: () => void;
}) {
  const [open, setOpen] = useState(false);
  const recentHistory = history.slice(-MAX_HISTORY_COUNT);
  const historyChars = recentHistory.reduce((n, m) => n + m.text.length, 0);
  const questionChars = draft.length;
  const sourceEntries = contexts.map((c) => ({
    key: `${c.kind}:${c.id}`,
    title: c.title,
    chars: contextCharCount(c, data),
  }));
  const knownContextChars = sourceEntries.reduce(
    (sum, s) => sum + (s.chars ?? 0),
    0,
  );
  const hasUnknownChars = sourceEntries.some((s) => s.chars === null);
  const totalKnownChars = knownContextChars + historyChars + questionChars;
  const totalLimit = MAX_CONTEXT_CHARS + MAX_HISTORY_CHARS + MAX_QUESTION_CHARS;
  const ratio = Math.min(1, totalKnownChars / totalLimit);
  const overflowed =
    knownContextChars > MAX_CONTEXT_CHARS ||
    contexts.length > MAX_CONTEXT_COUNT ||
    historyChars > MAX_HISTORY_CHARS;
  const dash = `${(ratio * 44).toFixed(1)} 44`;

  return (
    <div className="composer-context-wrap">
      <button
        type="button"
        className="composer-context-trigger"
        aria-expanded={open}
        aria-label={t("컨텍스트 한도 보기")}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="2"
          />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke={overflowed ? "var(--danger)" : "var(--brand)"}
            strokeWidth="2"
            strokeDasharray={dash}
            transform="rotate(-90 9 9)"
          />
        </svg>
      </button>
      {open && (
        <div
          className="composer-context-popover"
          role="dialog"
          aria-label={t("컨텍스트 사용량")}
        >
          <div className="composer-context-head">
            <strong>{t("보내는 내용 크기")}</strong>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onNewChat();
              }}
            >
              {t("새 대화")}
            </button>
          </div>
          <dl className="composer-context-stats">
            <div>
              <dt>
                {t("근거 ({count}/{max}개)", {
                  count: contexts.length,
                  max: MAX_CONTEXT_COUNT,
                })}
              </dt>
              <dd>
                {hasUnknownChars
                  ? t("{count}/{max}개", {
                      count: contexts.length,
                      max: MAX_CONTEXT_COUNT,
                    })
                  : t("{used} / {max}자", {
                      used: knownContextChars.toLocaleString(),
                      max: MAX_CONTEXT_CHARS.toLocaleString(),
                    })}
              </dd>
            </div>
            <div>
              <dt>
                {t("대화 기록 (최근 {count}/{max}개)", {
                  count: recentHistory.length,
                  max: MAX_HISTORY_COUNT,
                })}
              </dt>
              <dd>
                {t("{used} / {max}자", {
                  used: historyChars.toLocaleString(),
                  max: MAX_HISTORY_CHARS.toLocaleString(),
                })}
              </dd>
            </div>
            <div>
              <dt>{t("질문")}</dt>
              <dd>
                {t("{used} / {max}자", {
                  used: questionChars.toLocaleString(),
                  max: MAX_QUESTION_CHARS.toLocaleString(),
                })}
              </dd>
            </div>
          </dl>
          {!!sourceEntries.length && (
            <ul className="composer-context-sources">
              {sourceEntries.map((s) => (
                <li key={s.key}>
                  <span>{s.title}</span>
                  <small>
                    {s.chars === null
                      ? t("크기 미확인")
                      : t("{count}자", { count: s.chars.toLocaleString() })}
                  </small>
                </li>
              ))}
            </ul>
          )}
          {overflowed && (
            <p className="composer-context-warn" role="status">
              {t("근거가 길어 뒤쪽은 읽지 못해요")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function ComposerAttachmentCards({
  contexts,
  data,
  uploading,
  uploadProgress,
  uploadError,
  disabled,
  onRemove,
}: {
  contexts: AIContext[];
  data: WorkspaceData;
  uploading: boolean;
  uploadProgress: number | null;
  uploadError?: string;
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  if (!contexts.length && !uploading) return null;
  return (
    <div
      className="composer-attachment-cards"
      role="group"
      aria-label={t("첨부한 기록")}
    >
      {uploading && (
        <div className="composer-attachment-card is-uploading">
          <Icon name="file" size={15} />
          <div>
            <strong>{t("파일 준비 중")}</strong>
            <small>
              {uploadProgress !== null
                ? t("올리는 중 {percent}%", { percent: uploadProgress })
                : t("읽는 중")}
            </small>
          </div>
        </div>
      )}
      {contexts.map((c, index) => {
        const att =
          c.kind === "attachments"
            ? data.attachments.find((a) => a.id === c.id)
            : undefined;
        const sizeLabel = formatSize(att?.size);
        const pageLabel = c.page ? t("{page}쪽", { page: c.page }) : undefined;
        const status = uploadError
          ? uploadError
          : c.page
            ? t("읽는 쪽 {page}쪽", { page: c.page })
            : t("준비됨");
        const meta = [pageLabel, sizeLabel, status].filter(Boolean).join(" · ");
        return (
          <div
            className="composer-attachment-card"
            key={`${c.kind}:${c.id}:${c.page ?? ""}`}
          >
            <Icon
              name={c.kind === "meetings" ? "calendar" : "file"}
              size={15}
            />
            <div>
              <strong title={c.title}>{c.title}</strong>
              <small>{meta}</small>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              aria-label={t("{title} 첨부 해제", { title: c.title })}
              onClick={() => onRemove(index)}
            >
              <Icon name="close" size={13} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
