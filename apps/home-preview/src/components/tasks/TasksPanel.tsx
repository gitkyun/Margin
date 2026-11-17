import { t } from "@/lib/i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { useTaskRowMotion } from "@/components/task-row-motion";
import { useWorkspace } from "@/lib/workspace";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { seoulToday } from "@/lib/home-meeting";
import { friendlyError } from "@/lib/supabase";
import { groupTasks, taskSource } from "@/lib/task-groups";
import { recordBase, type Task } from "@/lib/domain";
import { QuickTaskInput, TaskRow } from "./TaskRow";
import "./tasks.css";

/**
 * 할 일 창(IA v2 P2, 06 §3.2). 다른 화면을 보면서 남은 할 일을 체크하는 간단한 보기입니다.
 * 묶음은 기한 지남 / 오늘 / 이번 주 / 그 뒤(접힘). 필터·피드백 탭은 두지 않습니다.
 */
export function TasksPanel({
  researchId,
  onClose,
}: {
  researchId: string;
  onClose(): void;
}) {
  const { data, save, remove } = useWorkspace();
  const completion = useTaskCompletion(save);
  const rowMotion = useTaskRowMotion();
  const [adding, setAdding] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const today = seoulToday();
  const feedback = data.feedback.filter(
    (item) => item.researchId === researchId,
  );
  const meetings = data.meetings.filter(
    (meeting) => meeting.researchId === researchId,
  );
  const open = data.tasks.filter(
    (task) =>
      task.researchId === researchId &&
      !task.archivedAt &&
      (task.status !== "done" ||
        completion.held.has(task.id) ||
        completion.recent.has(task.id)),
  );
  const groups = groupTasks(open, today);
  const near = groups.filter((group) =>
    ["overdue", "today", "week"].includes(group.key),
  );
  const later = groups
    .filter((group) => !["overdue", "today", "week"].includes(group.key))
    .flatMap((group) => group.tasks);

  async function add(title: string) {
    try {
      const task = await save("tasks", {
        ...recordBase(researchId),
        origin: "manual",
        title,
        description: "",
        status: "todo",
        dueDate: null,
        priority: "normal",
        visibility: "private",
        feedbackIds: [],
      } as Task);
      toast.success(t("할 일을 추가했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => void remove("tasks", task.id),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
      throw error;
    }
  }

  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      today={today}
      source={taskSource(task, feedback, meetings)}
      completion={completion}
      rowMotion={rowMotion}
    />
  );

  return (
    <section className="tasks-panel" aria-labelledby="tasks-panel-heading">
      <header className="tasks-panel-head">
        <h2 id="tasks-panel-heading">{t("할 일")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("할 일 추가")}
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("할 일 창 닫기")}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </Button>
      </header>
      <Link className="item-detail-link" to={`/r/${researchId}/tasks`}>
        {t("할 일 화면에서 보기")}
        <Icon name="chevron-right" size={14} />
      </Link>
      {adding && (
        <QuickTaskInput onAdd={add} onClose={() => setAdding(false)} />
      )}
      {near.map((group) => (
        <section key={group.key} className="tasks-group">
          <h3 className="tasks-panel-group">
            {group.label}
            <span>{group.tasks.length}</span>
          </h3>
          <AnimatePresence initial={false}>
            {group.tasks.map(row)}
          </AnimatePresence>
        </section>
      ))}
      {later.length > 0 && (
        <section className="tasks-group">
          <button
            type="button"
            className="tasks-finished-toggle"
            aria-expanded={showLater}
            onClick={() => setShowLater(!showLater)}
          >
            <Icon
              name={showLater ? "chevron-down" : "chevron-right"}
              size={16}
            />
            {t("그 뒤 {count}개", { count: later.length })}
          </button>
          {showLater && (
            <AnimatePresence initial={false}>{later.map(row)}</AnimatePresence>
          )}
        </section>
      )}
      {!open.length && (
        <p className="item-detail-empty">{t("남은 할 일이 없어요.")}</p>
      )}
    </section>
  );
}
