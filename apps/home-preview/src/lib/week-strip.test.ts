import { describe, expect, it } from "vitest";
import { emptyWorkspace, type WorkspaceData } from "./domain";
import { buildWeek, seoulTodayKey, shiftDay, weekKeys } from "./week-strip";

const R = "r1";

function fixture(): WorkspaceData {
  const data = emptyWorkspace();
  const meeting = (id: string, date: string | null, extra = {}) =>
    ({
      id,
      researchId: R,
      title: `미팅 ${id}`,
      date,
      time: "14:00",
      status: "preparing",
      createdAt: "2026-11-01",
      updatedAt: "2026-11-01",
      ...extra,
    }) as unknown as WorkspaceData["meetings"][number];
  const task = (id: string, dueDate: string | null, extra = {}) =>
    ({
      id,
      researchId: R,
      title: `할 일 ${id}`,
      dueDate,
      status: "todo",
      createdAt: "2026-11-01",
      updatedAt: "2026-11-01",
      ...extra,
    }) as unknown as WorkspaceData["tasks"][number];
  return {
    ...data,
    meetings: [
      meeting("m1", "2026-11-10"),
      meeting("m2", "2026-11-10", { time: "09:30" }),
      meeting("cancelled", "2026-11-10", { status: "cancelled" }),
      meeting("other", "2026-11-10", { researchId: "r2" }),
    ],
    tasks: [
      task("t1", "2026-11-10"),
      task("done", "2026-11-10", { status: "done" }),
      task("archived", "2026-11-12", { archivedAt: "2026-11-02" }),
      task("t2", "2026-11-14"),
    ],
  };
}

describe("week strip dates", () => {
  it("returns Sunday-to-Saturday keys around any day of the week", () => {
    expect(weekKeys("2026-11-11")).toEqual([
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
    ]);
  });

  it("shifts days across month ends without a time-zone slip", () => {
    expect(shiftDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("reads today in Seoul time", () => {
    // 2026-11-09 23:30 UTC is already 11-10 in Seoul.
    expect(seoulTodayKey(new Date("2026-11-09T23:30:00Z"))).toBe("2026-11-10");
  });
});

describe("buildWeek", () => {
  it("puts live meetings (by time) then open deadlines on each day", () => {
    const week = buildWeek({
      data: fixture(),
      researchId: R,
      anchorKey: "2026-11-10",
      todayKey: "2026-11-09",
    });
    expect(week).toHaveLength(7);
    const tuesday = week.find((d) => d.key === "2026-11-10")!;
    expect(tuesday.weekday).toBe("화");
    expect(tuesday.day).toBe(10);
    expect(tuesday.items.map((i) => i.id)).toEqual(["m2", "m1", "t1"]);
    expect(tuesday.items[2]).toMatchObject({
      kind: "task",
      href: `/r/${R}/tasks/t1`,
    });
    expect(week.find((d) => d.key === "2026-11-12")!.items).toEqual([]);
    expect(week.find((d) => d.isToday)?.key).toBe("2026-11-09");
  });
});
