import { describe, expect, it } from "vitest";
import { localDayKey, pollGrid } from "./poll-grid";

const at = (d: number, h: number, m = 0) =>
  new Date(2026, 10, d, h, m).toISOString();
const options = [
  { id: "o3", start: at(21, 10), end: at(21, 11) },
  { id: "o1", start: at(20, 10), end: at(20, 11) },
  { id: "o2", start: at(20, 14), end: at(20, 15) },
  { id: "bad", start: "nope", end: "nope" },
];
const participants = [
  { userId: "u1", name: "가", email: "a@x", available: ["o1", "o2"] },
  { userId: "u2", name: "나", email: "b@x", available: ["o1"] },
  { userId: "u3", name: "다", email: "c@x", available: [] },
  { userId: "u4", name: "라", email: "d@x", available: ["o1", "o3"] },
];

describe("poll availability grid", () => {
  it("groups options into sorted day columns and time rows", () => {
    const grid = pollGrid(options, participants);
    expect(grid.days.map((d) => d.key)).toEqual([
      localDayKey(new Date(2026, 10, 20)),
      localDayKey(new Date(2026, 10, 21)),
    ]);
    expect(grid.rows.map((r) => r.key)).toEqual(["10:00-11:00", "14:00-15:00"]);
    expect(grid.rows[1].cells[1]).toBeNull();
  });

  it("counts availability, levels and best options", () => {
    const grid = pollGrid(options, participants);
    const o1 = grid.rows[0].cells[0]!;
    expect([o1.option.id, o1.count, o1.level, o1.best]).toEqual([
      "o1",
      3,
      3,
      true,
    ]);
    const o3 = grid.rows[0].cells[1]!;
    expect([o3.count, o3.level, o3.best]).toEqual([1, 1, false]);
  });

  it("marks nothing as best when nobody answered", () => {
    const grid = pollGrid(options.slice(0, 2), []);
    expect(grid.rows[0].cells.every((c) => c && !c.best && c.level === 0)).toBe(
      true,
    );
  });
});
