import { describe, expect, it } from "vitest";
import {
  isDateKey,
  normalizeRoadmap,
  stageDateProblem,
  submissionDateProblem,
  validateRoadmapPlan,
} from "./roadmap";

const today = "2026-11-14",
  submissionDate = "2027-03-31";
const plan = validateRoadmapPlan({
  today,
  submissionDate,
  stages: [
    { title: "문헌 검토", status: "active", dueDate: null },
    { title: "자료 분석", status: "planned" },
  ],
  completedStages: ["주제 정하기"],
});
const stage = (over: Record<string, unknown> = {}) => ({
  title: "문헌 검토",
  startDate: "2026-11-14",
  endDate: "2026-12-20",
  reason: "선행연구 표를 먼저 채워요.",
  sourceIndex: 1,
  ...over,
});

describe("roadmap proposal input", () => {
  it("numbers the stages it will send and keeps finished ones apart", () => {
    expect(plan.stages.map((s) => [s.index, s.title])).toEqual([
      [1, "문헌 검토"],
      [2, "자료 분석"],
    ]);
    expect(plan.completedStages).toEqual(["주제 정하기"]);
  });

  it("needs a real submission date after today and within five years", () => {
    expect(isDateKey("2027-02-30")).toBe(false);
    expect(submissionDateProblem(today, today)).toBe("not_future");
    expect(submissionDateProblem(today, "2031-11-15")).toBe("too_far");
    expect(submissionDateProblem(today, submissionDate)).toBeNull();
    for (const bad of [today, "2026-01-01", "2027-02-30", "내년 봄"])
      expect(() =>
        validateRoadmapPlan({
          today,
          submissionDate: bad,
          stages: [],
          completedStages: [],
        }),
      ).toThrow();
  });

  it("rejects a client 'today' far from the server date", () => {
    const value = { today, submissionDate, stages: [], completedStages: [] };
    expect(() => validateRoadmapPlan(value, "2026-11-13")).not.toThrow();
    expect(() => validateRoadmapPlan(value, "2026-11-20")).toThrow();
  });

  it("rejects malformed stages", () => {
    const base = { today, submissionDate, completedStages: [] };
    expect(() =>
      validateRoadmapPlan({ ...base, stages: [{ title: " ", status: "planned" }] }),
    ).toThrow();
    expect(() =>
      validateRoadmapPlan({ ...base, stages: [{ title: "분석", status: "done" }] }),
    ).toThrow();
    expect(() =>
      validateRoadmapPlan({
        ...base,
        stages: Array(21).fill({ title: "단계", status: "planned" }),
      }),
    ).toThrow();
  });
});

describe("roadmap proposal output", () => {
  it("accepts dated stages inside today..submission and orders them by start", () => {
    const result = normalizeRoadmap(
      {
        stages: [
          stage({
            title: "투고 준비",
            sourceIndex: 0,
            startDate: "2027-03-01",
            endDate: submissionDate,
          }),
          stage({ sourceIndex: 2, startDate: "2026-12-10", endDate: "2027-02-28" }),
          stage(),
        ],
        assumptions: " 설문 자료를 이미 모았다고 가정했어요. ",
      },
      plan,
    );
    expect(result.stages.map((s) => s.startDate)).toEqual([
      "2026-11-14",
      "2026-12-10",
      "2027-03-01",
    ]);
    expect(result.assumptions).toBe("설문 자료를 이미 모았다고 가정했어요.");
  });

  it("keeps the user's stage name when the model renames a sent stage", () => {
    const [first] = normalizeRoadmap(
      { stages: [stage({ title: "문헌 고찰(개정)" })], assumptions: "" },
      plan,
    ).stages;
    expect(first.title).toBe("문헌 검토");
  });

  it("refuses dates before today or after the submission date instead of fixing them", () => {
    for (const over of [
      { startDate: "2026-11-01" },
      { endDate: "2027-04-01" },
      { startDate: "2026-12-25", endDate: "2026-12-20" },
      { endDate: "2026-02-30" },
      { startDate: "12월 초" },
    ])
      expect(() =>
        normalizeRoadmap({ stages: [stage(over)], assumptions: "" }, plan),
      ).toThrow();
  });

  it("refuses unknown or repeated stage references and empty plans", () => {
    expect(() =>
      normalizeRoadmap({ stages: [stage({ sourceIndex: 3 })], assumptions: "" }, plan),
    ).toThrow();
    expect(() =>
      normalizeRoadmap({ stages: [stage(), stage()], assumptions: "" }, plan),
    ).toThrow();
    expect(() => normalizeRoadmap({ stages: [], assumptions: "" }, plan)).toThrow();
    expect(() =>
      normalizeRoadmap({ stages: Array(13).fill(stage({ sourceIndex: 0 })) }, plan),
    ).toThrow();
  });

  it("names the problem with an edited stage", () => {
    const check = (s: { startDate: string; endDate: string }) =>
      stageDateProblem(s, today, submissionDate);
    expect(check({ startDate: "", endDate: "2026-12-01" })).toBe("missing");
    expect(check({ startDate: "2026-12-02", endDate: "2026-12-01" })).toBe("reversed");
    expect(check({ startDate: "2026-11-01", endDate: "2026-12-01" })).toBe("before_today");
    expect(check({ startDate: "2026-12-01", endDate: "2027-04-02" })).toBe("after_submission");
    expect(check({ startDate: "2026-12-01", endDate: "2026-12-01" })).toBeNull();
  });
});
