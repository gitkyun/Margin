import AIContextMeter from "@/components/kokonut/ai-context-meter";
import AIAttachment from "@/components/kokonut/ai-attachment";
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
      className="flex w-full flex-col gap-4"
      role="group"
      aria-label={t("첨부한 기록")}
    >
      {uploading && (
        <AIAttachment
          file={{ name: t("파일 준비 중"), size: 0, pages: 0 }}
          status={uploadProgress === null ? "reading" : "uploading"}
          uploaded={uploadProgress === null ? undefined : uploadProgress / 100}
          pagesRead={0}
          answer={[]}
        />
      )}
      {contexts.map((context, index) => {
        const attachment =
          context.kind === "attachments"
            ? data.attachments.find((item) => item.id === context.id)
            : undefined;
        return (
          <div
            key={`${context.kind}:${context.id}:${context.page ?? ""}`}
            className="flex items-start gap-2"
          >
            <AIAttachment
              file={{
                name: context.title,
                size: attachment?.size ?? 0,
                pages: context.page ? 1 : 0,
              }}
              status={uploadError ? "error" : "done"}
              error={uploadError}
              pagesRead={context.page ? 1 : 0}
              answer={[]}
              pageNumbers={context.page ? [context.page] : undefined}
            />
            {onRemove && (
              <button
                type="button"
                className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--hover-fill)]"
                disabled={disabled}
                aria-label={t("{title} 첨부 해제", { title: context.title })}
                onClick={() => onRemove(index)}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
