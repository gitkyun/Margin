import AIContextMeter from "@/components/kokonut/ai-context-meter";
import { QueueList } from "@/components/kokonut/ai-message-queue";
import { toast } from "sonner";
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
    description: t("가장 최근 미팅 메모에서 피드백·결정·질문을 뽑아요"),
    icon: "calendar",
  },
  {
    id: "suggest_revisions",
    label: String(modeLabels.suggest_revisions),
    description: t("처리 전인 최근 피드백을 고칠 방법을 제안해요"),
    icon: "sparkles",
  },
  {
    id: "review_writing",
    label: String(modeLabels.review_writing),
    description: t("가장 최근 문서의 흐름·근거·문장을 점검해요"),
    icon: "edit",
  },
  {
    id: "plan_research",
    label: String(modeLabels.plan_research),
    description: t("이 연구의 기록에서 해야 할 일을 정리해요"),
    icon: "check",
  },
  {
    id: "read_material",
    label: t("논문·자료 요약"),
    description: t("첨부한 파일이나 가장 최근 첨부 파일을 요약해요"),
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
  webSearch?: boolean;
  calendar?: boolean;
  draft?: boolean;
  contexts?: AIContext[];
}

export function ComposerQueue({
  items,
  onMove,
  onReorder,
  onEdit,
  onSendNow,
  onRemove,
  onClear,
}: {
  items: QueuedQuestion[];
  onMove: (index: number, delta: -1 | 1) => void;
  onReorder: (items: QueuedQuestion[]) => void;
  onEdit: (id: string, text?: string) => void;
  onSendNow: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <QueueList
      queue={items}
      paused={false}
      progress={0}
      onMoved={(text, position) =>
        toast.info(
          t("{name}을(를) {position}번째로 옮겼어요.", {
            name: text,
            position,
          }),
        )
      }
      onReorder={(next) =>
        onReorder(
          next.map((item) => ({
            ...items.find((current) => current.id === item.id)!,
            text: item.text,
          })),
        )
      }
      onEdit={(id, text) => onEdit(id, text)}
      onRemove={onRemove}
      onSendNow={(message) => onSendNow(message.id)}
      onClear={onClear}
      onResume={() => {}}
    />
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
  const recentHistory = history.slice(-MAX_HISTORY_COUNT);
  const historyChars = recentHistory.reduce(
    (sum, message) => sum + message.text.length,
    0,
  );
  const knownChars = contexts.reduce(
    (sum, context) => sum + (contextCharCount(context, data) ?? 0),
    0,
  );
  return (
    <AIContextMeter
      model={t("보내는 내용 크기 · 문자 기준")}
      limit={MAX_CONTEXT_CHARS + MAX_HISTORY_CHARS + MAX_QUESTION_CHARS}
      compactAt={1}
      segments={[
        {
          id: "sources",
          label: t("근거 ({count}/{max}개)", {
            count: contexts.length,
            max: MAX_CONTEXT_COUNT,
          }),
          tokens: knownChars,
        },
        {
          id: "history",
          label: t("대화 기록 (최근 {count}/{max}개)", {
            count: recentHistory.length,
            max: MAX_HISTORY_COUNT,
          }),
          tokens: historyChars,
        },
        { id: "question", label: t("질문"), tokens: draft.length },
      ]}
    />
  );
}

function formatSize(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

const CHIP_CLASS =
  "flex h-11 max-w-60 items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--text)_3%,transparent)] py-1 pr-1.5 pl-1 ring-1 ring-[color-mix(in_srgb,var(--text)_5%,transparent)]";
const CHIP_ICON_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--text)_5%,transparent)] text-[var(--text-tertiary)]";

function contextKindLabel(kind: AIContext["kind"]): string {
  switch (kind) {
    case "meetings":
      return t("미팅");
    case "feedback":
      return t("피드백");
    case "documents":
      return t("문서");
    case "versions":
      return t("버전");
    case "attachments":
      return t("파일");
    case "recordings":
      return t("녹음");
    case "tasks":
      return t("할 일");
    case "phases":
      return t("연구 단계");
    case "milestones":
      return t("일정");
    case "questions":
      return t("질문");
    case "decisions":
      return t("결정");
    case "materials":
      return t("자료");
  }
}

function contextIcon(kind: AIContext["kind"]): string {
  if (kind === "meetings") return "calendar";
  if (kind === "feedback") return "chat";
  if (kind === "tasks") return "check";
  return "file";
}

/** 칩 아래 줄: 종류 · (쪽) · (크기). 확인되지 않은 쪽 수는 만들지 않아요. */
function contextMeta(context: AIContext, size?: number): string {
  return [
    contextKindLabel(context.kind),
    context.page ? t("{page}쪽", { page: context.page }) : undefined,
    formatSize(size),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 입력창 안 칩 줄(AIPrompt `tray`)에 그리는 붙인 기록·첨부 파일.
 * 라이브러리의 AttachmentChip과 같은 모양을 써서 입력창 밖에 따로 뜨지 않게 해요.
 */
export function ComposerAttachmentCards({
  contexts,
  data,
  uploading,
  uploadProgress,
  disabled,
  onRemove,
}: {
  contexts: AIContext[];
  data: WorkspaceData;
  uploading: boolean;
  uploadProgress: number | null;
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  if (!contexts.length && !uploading) return null;
  return (
    <>
      {contexts.map((context, index) => {
        const attachment =
          context.kind === "attachments"
            ? data.attachments.find((item) => item.id === context.id)
            : undefined;
        return (
          <li
            key={`${context.kind}:${context.id}:${context.page ?? ""}`}
            className={CHIP_CLASS}
          >
            <span className={CHIP_ICON_CLASS}>
              <Icon name={contextIcon(context.kind)} size={16} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs text-[var(--text)]">
                {context.title}
              </span>
              <span className="block truncate text-[10px] text-[var(--text-tertiary)] tabular-nums">
                {contextMeta(context, attachment?.size)}
              </span>
            </span>
            <button
              type="button"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)] focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--brand)]"
              disabled={disabled}
              aria-label={t("{title} 첨부 해제", { title: context.title })}
              onClick={() => onRemove(index)}
            >
              <Icon name="close" size={13} />
            </button>
          </li>
        );
      })}
      {uploading && (
        <li className={CHIP_CLASS} aria-live="polite">
          <span className={CHIP_ICON_CLASS}>
            <span className="size-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--brand)] motion-reduce:animate-none" />
          </span>
          <span className="min-w-0 flex-1 pr-2 leading-tight">
            <span className="block truncate text-xs text-[var(--text)]">
              {t("파일 올리는 중")}
            </span>
            <span className="block text-[10px] text-[var(--text-tertiary)] tabular-nums">
              {uploadProgress === null
                ? t("내용 읽는 중")
                : `${Math.round(uploadProgress)}%`}
            </span>
          </span>
        </li>
      )}
    </>
  );
}
