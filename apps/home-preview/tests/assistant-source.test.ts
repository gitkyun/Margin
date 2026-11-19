import { describe, expect, it } from "vitest";
import {
  AIRequestError,
  isSourceChanged,
  refreshSourceContexts,
} from "@/lib/assistant-source";
import type { DocumentRecord, Feedback, Meeting, Task } from "@/lib/domain";

const base = {
  researchId: "r1",
  createdAt: "2026-11-19T00:00:00.000Z",
  updatedAt: "2026-11-19T00:00:00.000Z",
};
const data = {
  meetings: [
    {
      ...base,
      id: "m1",
      title: "제6차",
      memo: "비교 기준 추가",
      memoRevision: 4,
    },
    {
      ...base,
      id: "m2",
      title: "보관",
      memo: "",
      memoRevision: 1,
      archivedAt: "2026-11-19T01:00:00.000Z",
    },
  ] as Meeting[],
  documents: [
    {
      ...base,
      id: "d1",
      title: "서론",
      text: "첫 문단입니다. 둘째 문단입니다.",
      revision: 7,
    },
  ] as DocumentRecord[],
  feedback: [
    { ...base, id: "f1", title: "표", body: "표를 고쳐 주세요" },
  ] as Feedback[],
  tasks: [
    { ...base, id: "t1", title: "표 고치기", description: "기준 넣기" },
  ] as Task[],
};

describe("refreshSourceContexts (06 §2.2 [다시 보내기])", () => {
  it("미팅·글 칩의 판을 지금 판으로 올리고 다른 칩은 그대로 둔다", () => {
    const { contexts, missing } = refreshSourceContexts(
      [
        { kind: "meetings", id: "m1", title: "제6차", revision: 2 },
        { kind: "documents", id: "d1", title: "서론", revision: 5 },
        { kind: "feedback", id: "f1", title: "표" },
        { kind: "versions", id: "v1", title: "PDF", page: 2, text: "쪽" },
      ],
      data,
      "r1",
    );
    expect(missing).toEqual([]);
    expect(contexts.map((c) => c.revision)).toEqual([
      4,
      7,
      undefined,
      undefined,
    ]);
    expect(contexts[3]).toEqual({
      kind: "versions",
      id: "v1",
      title: "PDF",
      page: 2,
      text: "쪽",
    });
  });

  it("고른 문단이 최신 본문에 남아 있으면 쓰고, 사라졌으면 다시 고르게 한다", () => {
    const kept = refreshSourceContexts(
      [
        {
          kind: "documents",
          id: "d1",
          title: "서론",
          revision: 5,
          text: "둘째 문단",
        },
      ],
      data,
      "r1",
    );
    expect(kept.contexts[0]).toMatchObject({ revision: 7, text: "둘째 문단" });
    const gone = refreshSourceContexts(
      [
        {
          kind: "documents",
          id: "d1",
          title: "서론",
          revision: 5,
          text: "지운 문단",
        },
      ],
      data,
      "r1",
    );
    expect(gone.contexts).toEqual([]);
    expect(gone.missing.map((c) => c.id)).toEqual(["d1"]);
  });

  it("보관했거나 없거나 다른 연구의 기록은 missing", () => {
    const { contexts, missing } = refreshSourceContexts(
      [
        { kind: "meetings", id: "m2", title: "보관", revision: 1 },
        { kind: "tasks", id: "없음", title: "없음" },
        { kind: "documents", id: "d1", title: "서론", revision: 5 },
      ],
      data,
      "r2",
    );
    expect(contexts).toEqual([]);
    expect(missing.map((c) => c.id)).toEqual(["m2", "없음", "d1"]);
  });
});

describe("isSourceChanged", () => {
  it("서버 코드가 SOURCE_CHANGED인 오류만", () => {
    expect(isSourceChanged(new AIRequestError("바뀜", "SOURCE_CHANGED"))).toBe(
      true,
    );
    expect(isSourceChanged(new AIRequestError("한도", "RATE_LIMITED"))).toBe(
      false,
    );
    expect(isSourceChanged(new Error("SOURCE_CHANGED"))).toBe(false);
  });
});
