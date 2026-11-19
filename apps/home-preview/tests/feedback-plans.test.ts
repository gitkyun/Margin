import { describe, expect, it } from "vitest";
import {
  emptyPlan,
  planFromCandidate,
  taskFromPlan,
} from "@/lib/feedback-plans";
import type { AICandidate, BaseRecord } from "@/lib/domain";

const base: BaseRecord = {
  id: "p1",
  researchId: "r1",
  createdAt: "2026-11-19T00:00:00.000Z",
  updatedAt: "2026-11-19T00:00:00.000Z",
};
const feedback = {
  id: "f1",
  body: "선행연구 표에 비교 기준을 하나 더 넣어 주세요.",
  sourceQuote: "비교 기준을 더",
};

describe("수정 방법(06 §6.2)", () => {
  it("직접 쓰기는 빈 방법이고 선택된 상태로 저장된다", () => {
    expect(emptyPlan(base, "f1")).toMatchObject({
      origin: "manual",
      feedbackId: "f1",
      title: "",
      method: "",
      status: "saved",
      suggestedTasks: [],
    });
  });

  it("AI 제안은 원문에 있는 인용만 남긴다", () => {
    const candidate = {
      title: " 비교 기준 추가 ",
      method: "표에 연도 열을 넣는다",
      sourceQuote: "비교 기준을 하나 더",
      suggestedTasks: ["표 2에 연도 열 추가"],
    } as AICandidate;
    const plan = planFromCandidate(candidate, base, feedback);
    expect(plan).toMatchObject({
      origin: "ai",
      title: "비교 기준 추가",
      method: "표에 연도 열을 넣는다",
      sourceQuote: "비교 기준을 하나 더",
      suggestedTasks: ["표 2에 연도 열 추가"],
    });
    const made = planFromCandidate(
      { ...candidate, sourceQuote: "피드백에 없는 말" },
      base,
      feedback,
    );
    expect(made.sourceQuote).toBeUndefined();
    // 방법이 없으면 본문을 씁니다.
    expect(
      planFromCandidate(
        { title: "t", body: "본문" } as AICandidate,
        base,
        feedback,
      ).method,
    ).toBe("본문");
  });

  it("방법에서 할 일 추가는 제안된 첫 할 일을 제목으로, 피드백·방법에 잇는다", () => {
    const plan = {
      ...emptyPlan(base, "f1"),
      origin: "ai" as const,
      title: "비교 기준 추가",
      method: "표에 연도 열을 넣는다",
      suggestedTasks: ["  표 2에 연도 열 추가 "],
    };
    const task = taskFromPlan(plan, { ...base, id: "t1" });
    expect(task).toMatchObject({
      id: "t1",
      origin: "ai",
      title: "표 2에 연도 열 추가",
      description: "표에 연도 열을 넣는다",
      status: "todo",
      feedbackIds: ["f1"],
      planId: "p1",
      visibility: "private",
    });
    expect(taskFromPlan({ ...plan, suggestedTasks: [] }, base).title).toBe(
      "비교 기준 추가",
    );
  });
});
