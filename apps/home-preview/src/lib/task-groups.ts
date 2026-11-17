import { t } from "./i18n";
import type { Feedback, Meeting, Task } from "./domain";

export type TaskGroupKey = "overdue" | "today" | "week" | "later" | "undated";

export interface TaskGroup {
  key: TaskGroupKey;
  label: string;
  tasks: Task[];
}

const DAY = 24 * 60 * 60 * 1000;

function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}

/** 이번 주의 마지막 날(토요일). 주간 띠와 같이 일요일에 주가 시작합니다. */
export function endOfWeek(today: string): string {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, 6 - weekday);
}

export function taskGroupKey(task: Task, today: string): TaskGroupKey {
  if (!task.dueDate) return "undated";
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate <= endOfWeek(today)) return "week";
  return "later";
}

const ORDER: TaskGroupKey[] = ["overdue", "today", "week", "later", "undated"];

export function groupLabel(key: TaskGroupKey): string {
  return {
    overdue: t("기한 지남"),
    today: t("오늘"),
    week: t("이번 주"),
    later: t("나중"),
    undated: t("기한 없음"),
  }[key];
}

/**
 * 할 일을 기한 묶음(기한 지남 / 오늘 / 이번 주 / 나중 / 기한 없음)으로 나눕니다(IA v2 06 §3.1).
 * 묶음 안은 기한 가까운 순, 같으면 우선순위 높은 순입니다. 빈 묶음은 빼고 돌려줍니다.
 */
export function groupTasks(tasks: Task[], today: string): TaskGroup[] {
  const rank = { high: 0, normal: 1, low: 2 } as const;
  const sorted = [...tasks].sort(
    (a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      rank[a.priority] - rank[b.priority] ||
      a.createdAt.localeCompare(b.createdAt),
  );
  return ORDER.map((key) => ({
    key,
    label: groupLabel(key),
    tasks: sorted.filter((task) => taskGroupKey(task, today) === key),
  })).filter((group) => group.tasks.length > 0);
}

/** 오늘 끝낸 할 일(마지막으로 고친 날이 오늘인 완료 할 일) */
export function doneToday(tasks: Task[], today: string): Task[] {
  return tasks.filter(
    (task) => task.status === "done" && task.updatedAt.slice(0, 10) === today,
  );
}

/** 줄 오른쪽의 기한 글자: "오늘", "내일", "2일 지남", "11월 19일" */
export function dueLabel(
  dueDate: string | null,
  today: string,
): { text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  if (dueDate === today) return { text: t("오늘"), overdue: false };
  if (dueDate === addDays(today, 1)) return { text: t("내일"), overdue: false };
  if (dueDate < today) {
    const days = Math.round(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) /
        DAY,
    );
    return { text: t("{count}일 지남", { count: days }), overdue: true };
  }
  const [, month, day] = dueDate.split("-").map(Number);
  return { text: t("{month}월 {day}일", { month, day }), overdue: false };
}

/**
 * 할 일이 나온 기록: 딸린 피드백의 기록 → 가져간 미팅 순으로 찾고, 없으면 "직접 추가".
 */
export function taskSource(
  task: Task,
  feedback: Pick<Feedback, "id" | "meetingId">[],
  meetings: Pick<Meeting, "id" | "title" | "taskIds">[],
): string {
  const fromFeedback = feedback.find(
    (item) => task.feedbackIds.includes(item.id) && item.meetingId,
  )?.meetingId;
  const meeting =
    meetings.find((item) => item.id === fromFeedback) ??
    meetings.find((item) => item.taskIds.includes(task.id));
  return meeting?.title ?? t("직접 추가");
}
