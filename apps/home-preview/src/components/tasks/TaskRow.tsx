import { t } from "@/lib/i18n";
import { useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Checkbox } from "@montage-ui/core";
import { DrawnCheck } from "@/components/DrawnCheck";
import { RowUndoButton, TaskRowFrame } from "@/components/TaskRowFrame";
import type { useTaskRowMotion } from "@/components/task-row-motion";
import type { useTaskCompletion } from "@/lib/use-task-completion";
import type { DetailHistoryState } from "@/lib/item-detail";
import { dueLabel } from "@/lib/task-groups";
import type { Task } from "@/lib/domain";
import {
  RowContextMenu,
  RowMoreMenu,
  rowMenuLabel,
  type RowAction,
} from "@/components/row-actions/RowActions";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import "./tasks.css";

/** YYYY-MM-DD에 날짜를 더해요(달력 날짜만, 시간대 영향 없음). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Completion = ReturnType<typeof useTaskCompletion>;

/** 줄을 눌러 연 항목 상세(앱 안에서 연 첫 단계, 02 §4.3) */
const DETAIL_STATE: DetailHistoryState = { layer: "detail", depth: 1 };

/**
 * 공통 할 일 줄(IA v2 06 §3: `TaskRow`). 체크 · 제목 · 기한 · 출처.
 * 체크·되돌리기·효과음·휴대폰 밀어서 끝내기는 `useTaskCompletion`으로 모든 화면이 같습니다.
 * 줄을 누르면 지금 화면 위에 항목 상세(`?detail=task:<id>`)가 열립니다.
 */
export function TaskRow({
  task,
  today,
  source,
  completion,
  rowMotion,
  swipeable = false,
}: {
  task: Task;
  today: string;
  source?: string;
  completion: Completion;
  rowMotion: ReturnType<typeof useTaskRowMotion>;
  swipeable?: boolean;
}) {
  const done = task.status === "done";
  const due = dueLabel(task.dueDate, today);
  const busy = completion.busy.has(task.id);
  const recent = completion.recent.get(task.id);
  const { save, remove } = useWorkspace();
  const navigate = useNavigate();

  async function update(patch: Partial<Task>, message: string) {
    const before = task;
    try {
      await save("tasks", { ...task, ...patch });
      toast.success(message, {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => void save("tasks", before).catch(() => {}),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function archive() {
    try {
      await remove("tasks", task.id);
      toast.success(t("보관했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () =>
            void save("tasks", { ...task, archivedAt: undefined }).catch(
              () => {},
            ),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  const postpone = (days: number, label: string) =>
    void update(
      {
        dueDate: addDays(
          task.dueDate && task.dueDate > today ? task.dueDate : today,
          days,
        ),
      },
      label,
    );
  const actions: RowAction[] = task.archivedAt
    ? []
    : [
        {
          id: "toggle",
          label: done ? t("완료 취소") : t("완료"),
          icon: done ? "undo" : "check",
          onSelect: () => void completion.toggle(task),
        },
        ...(done
          ? []
          : [
              {
                id: "tomorrow",
                label: t("내일로 미루기"),
                icon: "clock",
                swipe: "end" as const,
                onSelect: () => postpone(1, t("내일로 미뤘어요.")),
              },
              {
                id: "next-week",
                label: t("다음 주로 미루기"),
                icon: "calendar",
                onSelect: () => postpone(7, t("다음 주로 미뤘어요.")),
              },
            ]),
        {
          id: "priority",
          label:
            task.priority === "high"
              ? t("우선순위 낮추기")
              : t("우선순위 높이기"),
          icon: "flag",
          separated: true,
          onSelect: () =>
            void update(
              { priority: task.priority === "high" ? "normal" : "high" },
              task.priority === "high"
                ? t("우선순위를 낮췄어요.")
                : t("우선순위를 높였어요."),
            ),
        },
        {
          id: "open",
          label: t("마감일·내용 고치기"),
          icon: "edit",
          onSelect: () =>
            navigate(
              { search: detailSearch(task.id) },
              { state: DETAIL_STATE },
            ),
        },
        {
          id: "archive",
          label: t("보관"),
          icon: "trash",
          separated: true,
          onSelect: () => void archive(),
        },
      ];
  const postponeAction = actions.find((a) => a.swipe === "end");
  return (
    <RowContextMenu actions={actions}>
      <div className="task-row-ctx">
        <TaskRowFrame
          rowMotion={rowMotion}
          className={`task-line ${done ? "is-complete" : ""}`}
          swipeable={swipeable && !task.archivedAt && !busy}
          done={done}
          onSwipe={() => void completion.toggle(task)}
          swipeEnd={
            postponeAction
              ? {
                  label: postponeAction.label,
                  icon: postponeAction.icon,
                  onSwipe: postponeAction.onSelect,
                }
              : undefined
          }
        >
          <Checkbox
            checked={done}
            onCheckedChange={() => void completion.toggle(task)}
            disabled={!!task.archivedAt || busy}
            icon={<DrawnCheck />}
            className={recent ? "task-check-draw" : undefined}
            aria-label={t("{title} 완료", { title: task.title })}
          />
          <Link
            className="task-line-text"
            to={{ search: detailSearch(task.id) }}
            state={DETAIL_STATE}
          >
            <strong>
              {task.priority === "high" && (
                <span
                  className="priority-dot"
                  role="img"
                  aria-label={t("우선순위 높음")}
                />
              )}
              {task.title}
            </strong>
            {(due || source) && (
              <small>
                {due && (
                  <span
                    className={due.overdue ? "task-line-overdue" : undefined}
                  >
                    {due.text}
                  </span>
                )}
                {due && source && " · "}
                {source}
              </small>
            )}
          </Link>
          <span className="task-line-cols" aria-hidden="true">
            <span>{source ?? ""}</span>
            <span>{task.priority === "high" ? t("높음") : ""}</span>
            <span className={due?.overdue ? "task-line-overdue" : undefined}>
              {due?.text ?? ""}
            </span>
          </span>
          {recent !== undefined && (
            <RowUndoButton
              title={task.title}
              completedAt={recent}
              onUndo={() => void completion.undo(task.id)}
            />
          )}
          <span className="task-line-more">
            <RowMoreMenu label={rowMenuLabel(task.title)} actions={actions} />
          </span>
        </TaskRowFrame>
      </div>
    </RowContextMenu>
  );
}

/** 지금 주소의 검색어에 상세만 바꿔 넣은 값(줄의 링크) */
function detailSearch(id: string): string {
  const params = new URLSearchParams(window.location.search);
  params.set("detail", `task:${id}`);
  return `?${params.toString()}`;
}

/**
 * 맨 위 한 줄 입력(06 §3.1). Enter로 저장하고 이어서 다음 줄을 쓰며, Esc로 닫습니다.
 * 한글 조합 중 Enter는 저장하지 않습니다.
 */
export function QuickTaskInput({
  onAdd,
  onClose,
  note,
}: {
  /** 실패하면 스스로 안내(toast)를 띄운 뒤 던지세요. 던지면 적은 글이 남아요. */
  onAdd(title: string): Promise<void>;
  onClose(): void;
  /** 입력 줄 아래 한 줄 안내(예: 이어 둘 피드백) */
  note?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const title = text.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onAdd(title);
      setText("");
    } catch {
      // 실패 안내는 onAdd가 이미 띄웠어요(세 호출처 모두 toast 뒤 다시 던짐).
      // 여기서는 적은 글을 그대로 두어 다시 Enter로 저장할 수 있게만 합니다.
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="task-quick-add">
      <input
        autoFocus
        value={text}
        maxLength={200}
        disabled={busy}
        aria-label={t("새 할 일 제목")}
        placeholder={t("할 일을 적고 Enter")}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => void onKeyDown(event)}
      />
      {note && <small className="task-quick-add-note">{note}</small>}
    </div>
  );
}
