import { describe, expect, it } from "vitest";
import { feedbackProgress } from "../src/lib/feedback-progress";
import type {
  Feedback,
  ReviewItem,
  ReviewResponse,
  ReviewRound,
  RevisionPlan,
  RevisionResult,
  Task,
} from "../src/lib/domain";

const feedback = { id: "f1", status: "in_progress" } as Feedback;
const plan = (status: RevisionPlan["status"]) =>
  ({ id: `p-${status}`, feedbackId: "f1", status }) as RevisionPlan;
const task = (id: string, status: Task["status"]) =>
  ({ id, status, feedbackIds: ["f1"] }) as Task;
const result = { id: "res1", feedbackIds: ["f1"] } as RevisionResult;
const item = { id: "i1", requestId: "q1", resultId: "res1" } as ReviewItem;
const round = (id: string, number: number) =>
  ({ id, itemId: "i1", number }) as ReviewRound;
const response = (
  roundId: string,
  value: ReviewResponse["result"],
  createdAt = "2026-11-05T00:00:00Z",
) =>
  ({
    id: `${roundId}-${value}`,
    roundId,
    result: value,
    createdAt,
  }) as ReviewResponse;

function values(input: Partial<Parameters<typeof feedbackProgress>[0]>) {
  return feedbackProgress({
    feedback,
    plans: [],
    tasks: [],
    results: [],
    reviewItems: [],
    rounds: [],
    responses: [],
    ...input,
  }).map((step) => [step.key, step.value, step.filled]);
}

describe("feedbackProgress", () => {
  it("shows five steps with nothing filled except the feedback itself", () => {
    expect(values({})).toEqual([
      ["feedback", "진행 중", true],
      ["plans", "아직 없음", false],
      ["tasks", "아직 없음", false],
      ["results", "아직 없음", false],
      ["review", "요청 전", false],
    ]);
  });

  it("counts only plans that were not cancelled", () => {
    const steps = values({ plans: [plan("saved"), plan("cancelled")] });
    expect(steps[1]).toEqual(["plans", "1개", true]);
  });

  it("reports finished tasks out of all linked tasks without merging states", () => {
    const steps = values({
      tasks: [task("t1", "done"), task("t2", "doing"), task("t3", "todo")],
    });
    expect(steps[2]).toEqual(["tasks", "완료 1 / 3", true]);
    // 할 일이 모두 끝나도 수정 결과나 교수 확인이 채워지지 않아요.
    const allDone = values({ tasks: [task("t1", "done")] });
    expect(allDone[3]).toEqual(["results", "아직 없음", false]);
    expect(allDone[4]).toEqual(["review", "요청 전", false]);
  });

  it("waits for the professor once a result is in a review request", () => {
    const steps = values({
      results: [result],
      reviewItems: [item],
      rounds: [round("r1", 1)],
    });
    expect(steps[3]).toEqual(["results", "1건", true]);
    expect(steps[4]).toEqual(["review", "응답 기다리는 중", false]);
  });

  it("uses the response on the latest round", () => {
    const steps = values({
      results: [result],
      reviewItems: [item],
      rounds: [round("r1", 1), round("r2", 2)],
      responses: [
        response("r1", "changes_requested"),
        response("r2", "confirmed"),
      ],
    });
    expect(steps[4]).toEqual(["review", "수정 내용 확인", true]);
  });

  it("goes back to waiting when a new round has no response yet", () => {
    const steps = values({
      results: [result],
      reviewItems: [item],
      rounds: [round("r1", 1), round("r2", 2)],
      responses: [response("r1", "changes_requested")],
    });
    expect(steps[4]).toEqual(["review", "응답 기다리는 중", false]);
  });

  it("shows that more revision is needed", () => {
    const steps = values({
      results: [result],
      reviewItems: [item],
      rounds: [round("r1", 1)],
      responses: [response("r1", "changes_requested")],
    });
    expect(steps[4]).toEqual(["review", "추가 수정 필요", true]);
  });
});
