import { t } from "@/lib/i18n";
import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@montage-ui/core";
import { DrawnCheck } from "@/components/DrawnCheck";
import { RowUndoButton, TaskRowFrame } from "@/components/TaskRowFrame";
import type { useTaskRowMotion } from "@/components/task-row-motion";
import type { useTaskCompletion } from "@/lib/use-task-completion";
import type { DetailHistoryState } from "@/lib/item-detail";
import { dueLabel } from "@/lib/task-groups";
import type { Task } from "@/lib/domain";
import "./tasks.css";

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
  return (
    <TaskRowFrame
      rowMotion={rowMotion}
      className={`task-line ${done ? "is-complete" : ""}`}
      swipeable={swipeable && !task.archivedAt && !busy}
      done={done}
      onSwipe={() => void completion.toggle(task)}
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
              <span className={due.overdue ? "task-line-overdue" : undefined}>
                {due.text}
              </span>
            )}
            {due && source && " · "}
            {source}
          </small>
        )}
      </Link>
      {recent !== undefined && (
        <RowUndoButton
          title={task.title}
          completedAt={recent}
          onUndo={() => void completion.undo(task.id)}
        />
      )}
    </TaskRowFrame>
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
