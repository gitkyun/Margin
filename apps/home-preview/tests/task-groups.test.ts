import { describe, expect, it } from "vitest";
import {
  doneToday,
  dueLabel,
  endOfWeek,
  groupTasks,
  taskSource,
} from "../src/lib/task-groups";
import type { Task } from "../src/lib/domain";

// 2026-11-17은 화요일
const TODAY = "2026-11-17";

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    researchId: "r1",
    title: id,
    description: "",
    status: "todo",
    dueDate: null,
    priority: "normal",
    feedbackIds: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...patch,
  } as Task;
}

describe("할 일 묶음(IA v2 06 §3.1)", () => {
  it("이번 주는 토요일까지", () => {
    expect(endOfWeek(TODAY)).toBe("2026-11-21");
    expect(endOfWeek("2026-11-21")).toBe("2026-11-21");
    expect(endOfWeek("2026-11-22")).toBe("2026-11-28");
  });

  it("기한 지남 / 오늘 / 이번 주 / 나중 / 기한 없음 순으로 나누고 빈 묶음은 뺀다", () => {
    const groups = groupTasks(
      [
        task("none"),
        task("later", { dueDate: "2026-11-25" }),
        task("week", { dueDate: "2026-11-21" }),
        task("today-low", { dueDate: TODAY, priority: "low" }),
        task("today-high", { dueDate: TODAY, priority: "high" }),
        task("over", { dueDate: "2026-11-15" }),
      ],
      TODAY,
    );
    expect(groups.map((g) => [g.label, g.tasks.map((x) => x.id)])).toEqual([
      ["기한 지남", ["over"]],
      ["오늘", ["today-high", "today-low"]],
      ["이번 주", ["week"]],
      ["나중", ["later"]],
      ["기한 없음", ["none"]],
    ]);
    expect(groupTasks([task("none")], TODAY).map((g) => g.key)).toEqual([
      "undated",
    ]);
  });

  it("오늘 끝낸 할 일만 고른다", () => {
    expect(
      doneToday(
        [
          task("a", { status: "done", updatedAt: `${TODAY}T03:00:00Z` }),
          task("b", { status: "done" }),
          task("c", { updatedAt: `${TODAY}T03:00:00Z` }),
        ],
        TODAY,
      ).map((x) => x.id),
    ).toEqual(["a"]);
  });

  it("기한 글자", () => {
    expect(dueLabel(null, TODAY)).toBeNull();
    expect(dueLabel(TODAY, TODAY)).toEqual({ text: "오늘", overdue: false });
    expect(dueLabel("2026-11-18", TODAY)?.text).toBe("내일");
    expect(dueLabel("2026-11-15", TODAY)).toEqual({
      text: "2일 지남",
      overdue: true,
    });
    expect(dueLabel("2026-12-03", TODAY)?.text).toBe("12월 3일");
  });

  it("출처는 피드백의 기록 → 가져간 미팅 → 직접 추가", () => {
    const meetings = [
      { id: "m1", title: "6차", taskIds: [] },
      { id: "m2", title: "7차", taskIds: ["t2"] },
    ];
    const feedback = [{ id: "f1", meetingId: "m1" }];
    expect(
      taskSource(task("t1", { feedbackIds: ["f1"] }), feedback, meetings),
    ).toBe("6차");
    expect(taskSource(task("t2"), feedback, meetings)).toBe("7차");
    expect(taskSource(task("t3"), feedback, meetings)).toBe("직접 추가");
  });
});
