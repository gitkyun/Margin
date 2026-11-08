import { describe, expect, it } from "vitest";
import type { Feedback, Task } from "@/lib/domain";
import { newResultDraft } from "./result-draft";

const feedback = { id: "feedback-1", title: "2장 근거 보강" } as Feedback;
const task = {
  id: "task-1",
  title: "표 2 다시 그리기",
  feedbackIds: ["feedback-9"],
} as Task;

describe("newResultDraft", () => {
  it("links the feedback the result was started from", () => {
    const draft = newResultDraft("research", { feedback });

    expect(draft).toMatchObject({
      researchId: "research",
      title: "2장 근거 보강 수정 결과",
      description: "",
      feedbackIds: ["feedback-1"],
      taskIds: [],
      kind: "document",
      location: "",
    });
    expect(draft.id).toBeTruthy();
  });

  it("prefers the task and carries its feedback links", () => {
    const draft = newResultDraft("research", { feedback, task });

    expect(draft.title).toBe("표 2 다시 그리기 수정 결과");
    expect(draft.taskIds).toEqual(["task-1"]);
    expect(draft.feedbackIds).toEqual(["feedback-1"]);
  });

  it("uses task feedback links when started from a task alone", () => {
    const draft = newResultDraft("research", { task });

    expect(draft.feedbackIds).toEqual(["feedback-9"]);
  });

  it("starts empty with an optional preserved file", () => {
    const draft = newResultDraft("research", { versionId: "version-3" });

    expect(draft).toMatchObject({
      title: "",
      feedbackIds: [],
      taskIds: [],
      versionId: "version-3",
    });
  });
});
