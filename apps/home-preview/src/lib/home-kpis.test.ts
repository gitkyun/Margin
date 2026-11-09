import { describe, expect, it } from "vitest";
import { daysUntil, homeKpis, segmentBar } from "./home-kpis";
import type { DocumentVersion, Meeting, Task } from "./domain";

const today = new Date("2026-11-04T09:30:00");

function task(id: string, status: Task["status"]): Task {
  return { id, status } as Task;
}

describe("daysUntil", () => {
  it("counts calendar days from today regardless of the current hour", () => {
    expect(daysUntil("2026-11-07", today)).toBe(3);
    expect(daysUntil("2026-11-04", today)).toBe(0);
    expect(daysUntil("2026-11-02", today)).toBe(-2);
  });

  it("returns null when the date is missing or invalid", () => {
    expect(daysUntil(null, today)).toBeNull();
    expect(daysUntil("not-a-date", today)).toBeNull();
  });
});

describe("segmentBar", () => {
  it("fills segments in proportion to completed work", () => {
    expect(segmentBar(1, 4)).toEqual([true, false, false, false]);
    expect(segmentBar(3, 3)).toEqual([true, true, true]);
  });

  it("caps long lists at eight segments", () => {
    const bar = segmentBar(10, 20);
    expect(bar).toHaveLength(8);
    expect(bar.filter(Boolean)).toHaveLength(4);
  });

  it("returns an empty bar when there is nothing to measure", () => {
    expect(segmentBar(0, 0)).toEqual([]);
  });
});

describe("homeKpis", () => {
  const base = "/r/abc";

  it("summarises the next meeting, open tasks, items to check and drafts", () => {
    const next = {
      id: "m1",
      date: "2026-11-07",
      taskIds: ["t1", "t2"],
    } as Meeting;
    const tasks = [task("t1", "done"), task("t2", "todo"), task("t3", "doing")];
    const kpis = homeKpis({
      base,
      next,
      tasks,
      docs: [{ id: "d1" }],
      versions: [
        { documentId: "d1" },
        { documentId: "d1" },
        { documentId: "other" },
      ] as DocumentVersion[],
      attention: 2,
      attentionHref: "/reviews/x",
      today,
    });

    expect(kpis.map((k) => [k.label, k.value, k.context])).toEqual([
      ["다음 미팅", "D-3", "준비 1/2"],
      ["남은 할 일", "2", "전체 3개"],
      ["확인할 내용", "2", "검토 알림·AI 제안"],
      ["문서", "1", "버전 2개"],
    ]);
    expect(kpis[0].to).toBe("/r/abc/meetings/m1?tab=prepare");
    expect(kpis[2]).toMatchObject({ tone: "red", to: "/reviews/x" });
  });

  it("shows calm empty values when the research has no records yet", () => {
    const kpis = homeKpis({
      base,
      next: undefined,
      tasks: [],
      docs: [],
      versions: [],
      attention: 0,
      attentionHref: "/r/abc/assistant",
      today,
    });

    expect(kpis.map((k) => [k.value, k.context, k.tone])).toEqual([
      ["미정", "일정 없음", "gray"],
      ["0", "전체 0개", "green"],
      ["0", "새 소식 없음", "gray"],
      ["0", "버전 0개", "gray"],
    ]);
    expect(kpis[0].to).toBe("/r/abc/meetings");
    expect(kpis[2].to).toBe("/r/abc/reviews");
  });

  it("marks a meeting today and an overdue meeting in words", () => {
    const make = (date: string) =>
      homeKpis({
        base,
        next: { id: "m", date, taskIds: [] } as unknown as Meeting,
        tasks: [],
        docs: [],
        versions: [],
        attention: 0,
        attentionHref: "",
        today,
      })[0];

    expect(make("2026-11-04")).toMatchObject({ value: "오늘", tone: "amber" });
    expect(make("2026-11-01")).toMatchObject({
      value: "3일 지남",
      tone: "red",
    });
  });
});
