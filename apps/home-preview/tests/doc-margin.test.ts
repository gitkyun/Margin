import { describe, expect, it } from "vitest";
import {
  documentFeedback,
  documentTasks,
  isHandled,
  marginGroups,
} from "@/lib/doc-margin";
import type { Feedback, Task } from "@/lib/domain";

const task = (id: string, extra: Partial<Task> = {}): Task =>
  ({
    id,
    researchId: "r",
    ownerId: "u",
    createdAt: `2026-11-1${id.length}T00:00:${id}0Z`,
    updatedAt: "",
    title: id,
    description: "",
    status: "todo",
    dueDate: null,
    priority: "normal",
    feedbackIds: [],
    ...extra,
  }) as Task;

const feedback = (id: string, status: Feedback["status"]): Feedback =>
  ({ id, title: id, body: "", status, notes: "" }) as Feedback;

describe("documentTasks", () => {
  it("이 글을 고칠 할 일만, 보관한 것은 빼고 만든 순서로", () => {
    const list = [
      task("2", { documentId: "d" }),
      task("1", { documentId: "d" }),
      task("3", { documentId: "other" }),
      task("4", { documentId: "d", archivedAt: "x" }),
    ];
    expect(documentTasks(list, "d").map((t) => t.id)).toEqual(["1", "2"]);
  });
});

describe("marginGroups", () => {
  it("제목 순서로 묶고, 제목이 없거나 못 찾으면 맨 위에 모은다", () => {
    const tasks = [
      task("a", { sectionAnchor: "2. 방법" }),
      task("b"),
      task("c", { sectionAnchor: "1. 서론" }),
      task("d", { sectionAnchor: "사라진 제목" }),
      task("e", { sectionAnchor: "2. 방법" }),
    ];
    const groups = marginGroups(tasks, ["1. 서론", "2. 방법"]);
    expect(groups.map((g) => [g.anchor, g.tasks.map((t) => t.id)])).toEqual([
      [null, ["b", "d"]],
      ["1. 서론", ["c"]],
      ["2. 방법", ["a", "e"]],
    ]);
  });
  it("할 일이 없으면 빈 목록", () => {
    expect(marginGroups([], ["x"])).toEqual([]);
  });
});

describe("documentFeedback", () => {
  it("처음 나온 순서로 번호를 붙이고 같은 피드백은 한 번만", () => {
    const fb = [feedback("f1", "recorded"), feedback("f2", "unprocessed")];
    const items = documentFeedback(
      [
        task("1", { feedbackIds: ["f2"] }),
        task("2", { feedbackIds: ["f1", "f2", "gone"] }),
      ],
      fb,
    );
    expect(items.map((i) => [i.feedback.id, i.number])).toEqual([
      ["f2", 1],
      ["f1", 2],
    ]);
  });
});

describe("isHandled", () => {
  it("수정 결과 있음·보류·고치지 않음만 다룸", () => {
    expect(isHandled("recorded")).toBe(true);
    expect(isHandled("held")).toBe(true);
    expect(isHandled("unchanged")).toBe(true);
    expect(isHandled("unprocessed")).toBe(false);
    expect(isHandled("in_progress")).toBe(false);
  });
});
