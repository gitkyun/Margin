import { describe, expect, it } from "vitest";
import type { ResearchPhase } from "./domain";
import {
  buildRoadmapPlan,
  planPhaseChanges,
  timelineMonths,
  timelineOffset,
  todayKey,
} from "./roadmap-plan";

const phase = (
  id: string,
  order: number,
  over: Partial<ResearchPhase> = {},
): ResearchPhase => ({
  id,
  researchId: "r1",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  title: id,
  order,
  dueDate: null,
  status: "planned",
  dependsOn: [],
  ...over,
});
const phases = [
  phase("주제 정하기", 0, { status: "done" }),
  phase("문헌 검토", 1, { status: "active", dueDate: "2026-12-01" }),
  phase("자료 분석", 2),
];
const base = (researchId: string) => ({
  id: "new",
  researchId,
  createdAt: "now",
  updatedAt: "now",
});

describe("roadmap proposal request", () => {
  it("sends unfinished stages with numbers and finished ones by name only", () => {
    const { plan, sent } = buildRoadmapPlan(phases, "2027-03-31", "2026-11-14");
    expect(sent.map((p) => p.id)).toEqual(["문헌 검토", "자료 분석"]);
    expect(plan.stages).toEqual([
      { index: 1, title: "문헌 검토", status: "active", dueDate: "2026-12-01" },
      { index: 2, title: "자료 분석", status: "planned" },
    ]);
    expect(plan.completedStages).toEqual(["주제 정하기"]);
  });

  it("uses the local calendar date for today", () => {
    expect(todayKey(new Date(2026, 10, 4, 23, 30))).toBe("2026-11-04");
  });
});

describe("applying a roadmap proposal", () => {
  const { sent } = buildRoadmapPlan(phases, "2027-03-31", "2026-11-14");
  const stages = [
    {
      title: "문헌 검토",
      startDate: "2026-11-14",
      endDate: "2026-12-20",
      reason: "",
      sourceIndex: 1,
    },
    {
      title: "투고 준비",
      startDate: "2027-03-01",
      endDate: "2027-03-31",
      reason: "",
      sourceIndex: 0,
    },
  ];

  it("updates dates on existing stages and creates new ones as planned", () => {
    const changes = planPhaseChanges(phases, sent, stages, "r1", base);
    const proposed = changes.filter((p) => p.id !== "자료 분석");
    expect(proposed).toHaveLength(2);
    expect(proposed[0]).toMatchObject({
      id: "문헌 검토",
      status: "active",
      startDate: "2026-11-14",
      dueDate: "2026-12-20",
      order: 2,
    });
    expect(proposed[1]).toMatchObject({
      id: "new",
      title: "투고 준비",
      status: "planned",
      order: 3,
      startDate: "2027-03-01",
      dueDate: "2027-03-31",
      visibility: "shared",
    });
  });

  it("keeps stages outside the proposal ahead of it, changing only their order", () => {
    const before = JSON.stringify(phases);
    const changes = planPhaseChanges(phases, sent, stages, "r1", base);
    expect(changes.some((p) => p.id === "주제 정하기")).toBe(false);
    expect(changes.find((p) => p.id === "자료 분석")).toEqual({
      ...phases[2],
      order: 1,
    });
    expect(JSON.stringify(phases)).toBe(before);
  });

  it("saves nothing for a stage whose dates and order already match", () => {
    const only = [
      phase("문헌 검토", 0, { startDate: "2026-11-14", dueDate: "2026-12-20" }),
    ];
    expect(planPhaseChanges(only, only, [stages[0]], "r1", base)).toEqual([]);
  });
});

describe("month timeline", () => {
  it("lists every month from the first to the last date", () => {
    const months = timelineMonths("2026-11-14", "2027-02-03");
    expect(months.map((m) => m.key)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(months.map((m) => m.days)).toEqual([30, 31, 31, 28]);
  });

  it("places dates as a share of all days and gives a one-day bar a width", () => {
    const months = timelineMonths("2026-11-01", "2026-12-31");
    expect(timelineOffset("2026-11-01", months)).toBe(0);
    expect(timelineOffset("2026-12-31", months, "end")).toBe(1);
    expect(timelineOffset("2026-12-01", months)).toBeCloseTo(30 / 61);
    expect(
      timelineOffset("2026-11-10", months, "end") -
        timelineOffset("2026-11-10", months),
    ).toBeCloseTo(1 / 61);
  });
});
