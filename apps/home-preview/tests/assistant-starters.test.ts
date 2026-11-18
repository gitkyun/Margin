import { describe, expect, it } from "vitest";
import { assistantStarters } from "@/lib/assistant-starters";

const R = "r";
const base = {
  meetings: [
    { id: "m1", researchId: R, status: "recorded", taskIds: [] },
    {
      id: "m2",
      researchId: R,
      status: "recorded",
      taskIds: [],
      summary: { text: "요약" },
    },
    { id: "m3", researchId: R, status: "preparing", taskIds: ["t1"] },
  ],
  documents: [{ id: "d1", researchId: R }],
  materials: [],
  feedback: [
    { id: "f1", researchId: R, meetingId: "m2", status: "unprocessed" },
  ],
  tasks: [
    {
      id: "t1",
      researchId: R,
      status: "todo",
      feedbackIds: ["f1"],
      documentId: "d1",
      createdAt: "2026-11-01",
    },
  ],
} as never;

const ids = (path: string, data = base) =>
  assistantStarters(path, data, R).map((s) => s.id);

describe("assistantStarters (IA v2 06 §2.6)", () => {
  it("기록됨: 요약이 없으면 정리하기, 남은 피드백이 있으면 수정 방법 제안", () => {
    expect(ids("/r/r/meetings/m1")).toEqual(["organize"]);
    expect(ids("/r/r/meetings/m2")).toEqual(["revisions"]);
  });

  it("준비: 넘어온 할 일이 있으면 보여 줄 것 정리, 늘 질문 제안", () => {
    expect(ids("/r/r/meetings/m3")).toEqual(["prepare", "questions"]);
  });

  it("글: 안 다룬 연결 피드백이 있으면 그 점검, 늘 흐름 점검", () => {
    expect(ids("/r/r/docs/w/d1")).toEqual(["doc-feedback", "doc-flow"]);
  });

  it("홈: 남은 할 일이 있으면 이번 주 정리", () => {
    expect(ids("/r/r")).toEqual(["week"]);
  });

  it("기록이 거의 없으면 어디서나 파일 올리기를 권하고, 세 개를 넘지 않는다", () => {
    const empty = {
      meetings: [],
      documents: [],
      materials: [],
      feedback: [],
      tasks: [],
    } as never;
    expect(ids("/r/r/assistant", empty)).toEqual(["upload"]);
    expect(ids("/r/r/meetings/m3").length).toBeLessThanOrEqual(3);
    // 다른 연구·없는 기록은 권하지 않는다
    expect(ids("/r/other/meetings/m1")).toEqual([]);
  });
});
