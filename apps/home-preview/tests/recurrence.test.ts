import { describe, expect, it } from "vitest";
import { nextCadenceDate, readCadence } from "../src/lib/recurrence";

// 2026-11-18은 수요일(3)입니다.
const WED_WEEKLY = { weekday: 3, time: "14:00", every: 1 };
const meeting = (
  date: string | null,
  extra: Partial<{
    status: "preparing" | "recorded" | "cancelled" | "recording";
    recordType: "meeting" | "written";
    archivedAt: string;
  }> = {},
) => ({ date, status: "recorded" as const, ...extra });

describe("readCadence (IA v2 07 §1.3)", () => {
  it("accepts a well-formed cadence", () => {
    expect(readCadence({ weekday: 0, time: "09:30", every: 4 })).toEqual({
      weekday: 0,
      time: "09:30",
      every: 4,
    });
  });
  it("rejects bad shapes as off", () => {
    expect(readCadence(undefined)).toBeNull();
    expect(readCadence({ weekday: 7, time: "14:00", every: 1 })).toBeNull();
    expect(readCadence({ weekday: 3, time: "24:00", every: 1 })).toBeNull();
    expect(readCadence({ weekday: 3, time: "14:00", every: 5 })).toBeNull();
    expect(readCadence({ weekday: 1.5, time: "14:00", every: 1 })).toBeNull();
  });
});

describe("nextCadenceDate (IA v2 07 §1.3)", () => {
  it("uses today when there is no dated meeting, starting the next day", () => {
    // 오늘이 수요일이면 기준일 다음 날부터 세므로 다음 주 수요일
    expect(nextCadenceDate(WED_WEEKLY, [], "2026-11-18")).toBe("2026-11-25");
    expect(nextCadenceDate(WED_WEEKLY, [], "2026-11-16")).toBe("2026-11-18");
  });
  it("counts from the latest dated meeting, including an already planned one", () => {
    expect(
      nextCadenceDate(
        WED_WEEKLY,
        [meeting("2026-11-11"), meeting("2026-11-25", { status: "preparing" })],
        "2026-11-20",
      ),
    ).toBe("2026-12-02");
  });
  it("adds (every - 1) weeks to the first matching weekday", () => {
    expect(
      nextCadenceDate(
        { ...WED_WEEKLY, every: 2 },
        [meeting("2026-11-18")],
        "2026-11-18",
      ),
    ).toBe("2026-12-02");
  });
  it("skips forward by the interval until it is not before today", () => {
    expect(
      nextCadenceDate(
        { ...WED_WEEKLY, every: 2 },
        [meeting("2026-10-01")],
        "2026-11-20",
      ),
    ).toBe("2026-11-25");
  });
  it("ignores written feedback, cancelled, trashed and undated records", () => {
    expect(
      nextCadenceDate(
        WED_WEEKLY,
        [
          meeting("2026-12-30", { recordType: "written" }),
          meeting("2026-12-30", { status: "cancelled" }),
          meeting("2026-12-30", { archivedAt: "2026-11-19T00:00:00Z" }),
          meeting(null),
          meeting("2026-11-11"),
        ],
        "2026-11-16",
      ),
    ).toBe("2026-11-18");
  });
  it("crosses month and year ends", () => {
    expect(
      nextCadenceDate(
        { weekday: 5, time: "10:00", every: 1 },
        [meeting("2026-12-25")],
        "2026-12-20",
      ),
    ).toBe("2027-01-01");
  });
});
