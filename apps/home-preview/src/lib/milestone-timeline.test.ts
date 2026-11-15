import { describe, expect, it } from "vitest";
import { milestoneTimeline, todayLineIndex } from "./milestone-timeline";

const goal = (
  title: string,
  dueDate: string | null,
  status: "planned" | "done" = "planned",
) => ({ title, dueDate, status });

describe("milestoneTimeline", () => {
  it("orders by date with undated goals last and marks past, today and upcoming", () => {
    const items = milestoneTimeline(
      [
        goal("투고", "2026-12-20"),
        goal("날짜 없음", null),
        goal("계획서", "2026-11-01", "done"),
        goal("발표", "2026-11-15"),
        goal("초안", "2026-11-10"),
      ],
      "2026-11-15",
    );
    expect(items.map((i) => [i.milestone.title, i.when, i.days])).toEqual([
      ["계획서", "past", -14],
      ["초안", "past", -5],
      ["발표", "today", 0],
      ["투고", "upcoming", 35],
      ["날짜 없음", "undated", null],
    ]);
  });

  it("flags only unfinished past goals as overdue", () => {
    const items = milestoneTimeline(
      [goal("끝남", "2026-11-01", "done"), goal("밀림", "2026-11-02")],
      "2026-11-15",
    );
    expect(items.map((i) => i.overdue)).toEqual([false, true]);
  });

  it("keeps the original order for goals on the same day", () => {
    const items = milestoneTimeline(
      [goal("a", "2026-11-20"), goal("b", "2026-11-20")],
      "2026-11-15",
    );
    expect(items.map((i) => i.milestone.title)).toEqual(["a", "b"]);
  });
});

describe("todayLineIndex", () => {
  it("points at the first goal from today on", () => {
    expect(
      todayLineIndex([
        { when: "past" },
        { when: "upcoming" },
        { when: "undated" },
      ]),
    ).toBe(1);
  });
  it("goes after the last dated goal when every date has passed", () => {
    expect(todayLineIndex([{ when: "past" }, { when: "undated" }])).toBe(1);
  });
  it("is -1 without dated goals", () => {
    expect(todayLineIndex([{ when: "undated" }])).toBe(-1);
    expect(todayLineIndex([])).toBe(-1);
  });
});
