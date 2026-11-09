import { describe, expect, it } from "vitest";
import { navPreview, type PreviewData } from "./nav-preview";
import type { WorkspaceData } from "./domain";

const base = {
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
};
const today = new Date("2026-11-09T09:00:00+09:00");

function data(overrides: Partial<PreviewData> = {}): PreviewData {
  return {
    meetings: [],
    tasks: [],
    feedback: [],
    documents: [],
    materials: [],
    reviews: [],
    milestones: [],
    ...overrides,
  };
}

describe("navPreview", () => {
  it("counts only open tasks of the current research for the home item", () => {
    const tasks = [
      { ...base, id: "t1", researchId: "r1", status: "todo" },
      { ...base, id: "t2", researchId: "r1", status: "done" },
      { ...base, id: "t3", researchId: "r2", status: "todo" },
      { ...base, id: "t4", researchId: "r1", status: "doing", deletedAt: "x" },
    ] as WorkspaceData["tasks"];

    expect(navPreview("", "연구 홈", data({ tasks }), "r1", today)).toEqual({
      title: "연구 홈",
      detail: "남은 할 일 1개",
    });
  });

  it("describes the next preparing meeting with its relative day", () => {
    const meetings = [
      {
        ...base,
        id: "m1",
        researchId: "r1",
        title: "제6차 논문 지도",
        date: "2026-11-12",
        time: "14:00",
        status: "preparing",
      },
    ] as WorkspaceData["meetings"];

    expect(
      navPreview("meetings", "미팅", data({ meetings }), "r1", today)?.detail,
    ).toBe("다음 미팅 11월 12일 (목) · 3일 뒤");
  });

  it("says there is no meeting when nothing is scheduled", () => {
    expect(navPreview("meetings", "미팅", data(), "r1", today)?.detail).toBe(
      "예정된 미팅이 없어요.",
    );
  });

  it("returns null for items without a summary", () => {
    expect(navPreview("assistant", "연구 도우미", data(), "r1", today)).toBe(
      null,
    );
  });
});
