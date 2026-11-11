import { describe, expect, it } from "vitest";
import { emptyWorkspace, type WorkspaceData } from "../src/lib/domain";
import { incomingSummary } from "../src/pages/reviews/helpers";

const REQUEST = "req1";

function fixture(): WorkspaceData {
  const round = (id: string, itemId: string, number: number, name?: string) =>
    ({
      id,
      requestId: REQUEST,
      itemId,
      number,
      createdByName: name,
      createdAt: `2026-11-0${number}`,
    }) as unknown as WorkspaceData["rounds"][number];
  return {
    ...emptyWorkspace(),
    reviewItems: [
      { id: "a", requestId: REQUEST, resultId: "ra", title: "비교표" },
      { id: "b", requestId: REQUEST, resultId: "rb", title: "연구 질문" },
      { id: "x", requestId: "other", resultId: "rx", title: "다른 요청" },
    ],
    rounds: [
      round("a1", "a", 1, "김학생"),
      round("a2", "a", 2, "김학생"),
      round("b1", "b", 1, "김학생"),
    ],
    responses: [
      // a의 지난 회차에만 응답했고, 다시 온 최신 회차(a2)는 아직입니다.
      {
        roundId: "a1",
        updatedAt: "2026-11-01",
      } as WorkspaceData["responses"][number],
      {
        roundId: "b1",
        updatedAt: "2026-11-01",
      } as WorkspaceData["responses"][number],
    ],
  };
}

describe("incomingSummary", () => {
  it("counts items whose latest round has no response yet", () => {
    expect(incomingSummary(fixture(), REQUEST)).toEqual({
      studentName: "김학생",
      total: 2,
      pending: 1,
    });
  });

  it("reports nothing pending once every latest round is answered", () => {
    const data = fixture();
    const answered = {
      ...data,
      responses: [
        ...data.responses,
        {
          roundId: "a2",
          updatedAt: "2026-11-02",
        } as WorkspaceData["responses"][number],
      ],
    };
    expect(incomingSummary(answered, REQUEST).pending).toBe(0);
  });

  it("leaves the student name empty when no round carries one", () => {
    const data = fixture();
    const unnamed = {
      ...data,
      rounds: data.rounds.map((round) => ({
        ...round,
        createdByName: undefined,
      })),
    };
    expect(incomingSummary(unnamed, REQUEST).studentName).toBe("");
  });
});
