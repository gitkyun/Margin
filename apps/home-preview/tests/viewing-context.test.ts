import { describe, expect, it } from "vitest";
import { contextKey, viewingContext } from "@/lib/viewing-context";

const data = {
  meetings: [
    { id: "m1", researchId: "r", title: "제6차 논문 지도", memoRevision: 4 },
    { id: "m2", researchId: "r", title: "보관", archivedAt: "x" },
  ],
  documents: [{ id: "d1", researchId: "r", title: "연구계획서", revision: 7 }],
  feedback: [{ id: "f1", researchId: "r", title: "비교 기준 보완" }],
  tasks: [{ id: "t1", researchId: "r", title: "표 고치기" }],
} as never;

describe("viewingContext (IA v2 06 §2.2)", () => {
  it("열린 미팅·글을 판 번호와 함께 칩으로 만든다", () => {
    expect(viewingContext("/r/r/meetings/m1", "", data, "r")).toEqual({
      kind: "meetings",
      id: "m1",
      title: "제6차 논문 지도",
      revision: 4,
    });
    expect(viewingContext("/r/r/docs/w/d1", "?compare=v", data, "r")).toEqual({
      kind: "documents",
      id: "d1",
      title: "연구계획서",
      revision: 7,
    });
  });

  it("항목 상세가 열려 있으면 그것이 먼저다", () => {
    expect(
      viewingContext("/r/r/meetings/m1", "?detail=feedback:f1", data, "r"),
    ).toMatchObject({ kind: "feedback", id: "f1" });
    expect(
      viewingContext("/r/r/docs/w/d1", "?detail=task:t1", data, "r"),
    ).toMatchObject({ kind: "tasks", id: "t1" });
    // 결정·질문·수정 결과 상세는 칩을 만들지 않는다
    expect(
      viewingContext("/r/r/meetings/m1", "?detail=decision:x", data, "r"),
    ).toBeNull();
  });

  it("보관했거나 없는 대상, 다른 연구, 목록·자료 화면은 칩이 없다", () => {
    expect(viewingContext("/r/r/meetings/m2", "", data, "r")).toBeNull();
    expect(viewingContext("/r/r/meetings/zz", "", data, "r")).toBeNull();
    expect(viewingContext("/r/other/meetings/m1", "", data, "r")).toBeNull();
    expect(viewingContext("/r/r/docs", "", data, "r")).toBeNull();
    expect(viewingContext("/r/r/docs/m/x", "", data, "r")).toBeNull();
    expect(contextKey({ kind: "meetings", id: "m1" })).toBe("meetings:m1");
  });
});
