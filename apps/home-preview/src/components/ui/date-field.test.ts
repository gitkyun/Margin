import { describe, expect, it } from "vitest";
import { fromDateKey, fromTimeKey, toDateKey, toTimeKey } from "./date-field";

describe("date field value keys", () => {
  it("keeps the local calendar day when converting a date key both ways", () => {
    const date = fromDateKey("2026-11-12");
    expect(date?.getDate()).toBe(12);
    expect(toDateKey(date)).toBe("2026-11-12");
  });

  it("round-trips a 24-hour time key", () => {
    expect(toTimeKey(fromTimeKey("14:05"))).toBe("14:05");
  });

  it("returns an empty key for an empty or invalid value", () => {
    expect(toDateKey(null)).toBe("");
    expect(toDateKey("not a date")).toBe("");
    expect(fromDateKey("")).toBeNull();
    expect(fromTimeKey("")).toBeNull();
  });
});
