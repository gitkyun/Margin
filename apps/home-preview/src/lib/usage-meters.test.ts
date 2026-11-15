import { describe, expect, it } from "vitest";
import type { WorkspaceData } from "./domain";
import {
  STORAGE_TICK_BYTES,
  formatBytes,
  monthlyAIUsage,
  seoulMonthKey,
  storageScale,
  storageUsage,
} from "./usage-meters";

describe("monthly AI usage", () => {
  it("counts only my runs in the Seoul month", () => {
    const run = (
      id: string,
      createdAt: string,
      status = "complete",
      userId = "u1",
    ) =>
      ({
        id,
        researchId: "r",
        userId,
        mode: "ask_research",
        status,
        createdAt,
      }) as WorkspaceData["aiRuns"][number];
    const month = seoulMonthKey(new Date("2026-11-15T00:00:00Z"));
    expect(month).toBe("2026-11");
    const usage = monthlyAIUsage(
      [
        run("a", "2026-11-03T01:00:00Z"),
        run("b", "2026-10-31T16:00:00Z", "failed"), // 서울 11월 1일 01시
        run("c", "2026-10-31T14:00:00Z"), // 서울 10월 31일
        run("d", "2026-11-05T00:00:00Z", "complete", "someone"),
      ],
      "u1",
      month,
    );
    expect(usage).toEqual({ total: 2, complete: 1, failed: 1 });
  });
});

describe("storage usage", () => {
  const file = (
    id: string,
    researchId: string,
    size: number,
    storagePath = id,
  ) => ({ id, researchId, size, storagePath }) as never;
  it("adds real file sizes in my researches once per storage path", () => {
    const usage = storageUsage(
      {
        researches: [
          { id: "mine", ownerId: "u1" },
          { id: "shared", ownerId: "u2" },
        ] as WorkspaceData["researches"],
        versions: [
          file("v1", "mine", 1000),
          file("v2", "mine", 500, "v1"),
          file("v3", "shared", 9999),
        ],
        recordings: [
          file("rec", "mine", 2000),
          file("bad", "mine", Number.NaN),
        ],
        attachments: [file("att", "mine", 0)],
      },
      "u1",
    );
    expect(usage).toEqual({ bytes: 3000, files: 2 });
  });

  it("draws 500MB ticks up to the first tick above the usage", () => {
    expect(storageScale(0).ticks).toEqual([STORAGE_TICK_BYTES]);
    expect(storageScale(STORAGE_TICK_BYTES + 1).max).toBe(
      STORAGE_TICK_BYTES * 2,
    );
    expect(formatBytes(STORAGE_TICK_BYTES)).toBe("500 MB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(12)).toBe("12 B");
  });
});
