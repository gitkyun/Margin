import { describe, expect, it } from "vitest";
import { dDayLabel, daysUntil } from "./submission-countdown";

describe("submission countdown", () => {
  it("counts whole days until the target date", () => {
    expect(daysUntil("2026-11-15", "2026-12-08")).toBe(23);
  });
  it("crosses month and year boundaries", () => {
    expect(daysUntil("2026-12-31", "2027-01-01")).toBe(1);
  });
  it("returns null for an invalid date", () => {
    expect(daysUntil("2026-11-15", "not-a-date")).toBeNull();
  });
  it("labels future, same-day and past dates", () => {
    expect(dDayLabel(23)).toBe("D-23");
    expect(dDayLabel(0)).toBe("D-Day");
    expect(dDayLabel(-3)).toBe("D+3");
  });
});
