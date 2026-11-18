import type { Feedback, Task } from "@/lib/domain";

/** 이 글을 '고칠 글'로 가진 할 일(보관한 것은 뺌). 만든 순서대로. */
export function documentTasks(
  tasks: readonly Task[],
  documentId: string,
): Task[] {
  return tasks
    .filter((task) => task.documentId === documentId && !task.archivedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface MarginGroup {
  /** 이 무리가 붙는 제목 글자. null이면 글 맨 위 여백. */
  anchor: string | null;
  tasks: Task[];
}

/**
 * 여백 무리(IA v2 05 §3.5): 할 일을 `sectionAnchor` 제목별로 묶습니다.
 * 제목이 없거나 지금 글에서 찾지 못하면 맨 위 무리에 모읍니다. 순서는 글의 제목 순서.
 */
export function marginGroups(
  tasks: readonly Task[],
  headings: readonly string[],
): MarginGroup[] {
  const known = new Set(headings);
  const top: Task[] = [];
  const byAnchor = new Map<string, Task[]>();
  for (const task of tasks) {
    const anchor = task.sectionAnchor?.trim();
    if (!anchor || !known.has(anchor)) {
      top.push(task);
      continue;
    }
    byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), task]);
  }
  const groups: MarginGroup[] = top.length
    ? [{ anchor: null, tasks: top }]
    : [];
  for (const heading of headings) {
    const list = byAnchor.get(heading);
    if (!list) continue;
    groups.push({ anchor: heading, tasks: list });
    byAnchor.delete(heading);
  }
  return groups;
}

/** 이 글의 할 일에 딸린 피드백. 처음 나온 순서로 번호(1부터)를 붙입니다. */
export function documentFeedback(
  tasks: readonly Task[],
  feedback: readonly Feedback[],
): { feedback: Feedback; number: number }[] {
  const out: { feedback: Feedback; number: number }[] = [];
  const seen = new Set<string>();
  for (const task of tasks)
    for (const id of task.feedbackIds) {
      if (seen.has(id)) continue;
      const item = feedback.find((f) => f.id === id && !f.archivedAt);
      if (!item) continue;
      seen.add(id);
      out.push({ feedback: item, number: out.length + 1 });
    }
  return out;
}

/**
 * '다룸'으로 세는 피드백 상태(05 §3.5): 수정 결과 있음·보류·고치지 않음.
 * 학생이 표시한 상태이고 교수 응답과는 다릅니다.
 */
export function isHandled(status: Feedback["status"]): boolean {
  return status === "recorded" || status === "held" || status === "unchanged";
}
