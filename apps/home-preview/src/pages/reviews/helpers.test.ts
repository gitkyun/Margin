import { describe, expect, it } from "vitest";
import { emptyWorkspace, type ReviewRound } from "@/lib/domain";
import {
  commentLink,
  isLatestRound,
  knownProfessorEmails,
  splitResolvedThreads,
} from "./helpers";

function round(id: string, itemId: string, number: number): ReviewRound {
  return { id, itemId, number } as ReviewRound;
}

describe("교수 응답 가능한 차수", () => {
  const data = {
    ...emptyWorkspace(),
    rounds: [
      round("a1", "item-a", 1),
      round("a2", "item-a", 2),
      round("b1", "item-b", 1),
    ],
  };

  it("재확인으로 새 차수가 생긴 항목은 이전 차수에서 응답할 수 없다", () => {
    expect(isLatestRound(data, data.rounds[0])).toBe(false);
  });

  it("항목의 최신 차수에서는 응답할 수 있다", () => {
    expect(isLatestRound(data, data.rounds[1])).toBe(true);
  });

  it("다른 항목의 재확인은 이 항목의 최신 차수에 영향을 주지 않는다", () => {
    expect(isLatestRound(data, data.rounds[2])).toBe(true);
  });
});

describe("knownProfessorEmails", () => {
  const review = (
    researchId: string,
    professorEmail: string,
    createdAt: string,
  ) => ({
    researchId,
    professorEmail,
    createdAt,
  });

  it("lists this research's professor emails once, most recent first", () => {
    const reviews = [
      review("r1", "kim@univ.ac.kr", "2026-10-01T00:00:00Z"),
      review("r1", "Lee@univ.ac.kr ", "2026-11-01T00:00:00Z"),
      review("r1", "kim@univ.ac.kr", "2026-11-05T00:00:00Z"),
      review("r2", "park@univ.ac.kr", "2026-11-09T00:00:00Z"),
    ];
    expect(knownProfessorEmails(reviews, "r1")).toEqual([
      "kim@univ.ac.kr",
      "lee@univ.ac.kr",
    ]);
  });

  it("returns nothing when the research has no review requests", () => {
    expect(knownProfessorEmails([], "r1")).toEqual([]);
  });
});

describe("댓글 링크와 해결한 댓글 접기", () => {
  it("지금 주소의 검토 항목·차수를 유지하고 #조각만 댓글로 바꾼다", () => {
    const href = "https://example.test/reviews/req?item=i1&round=r2#old";
    expect(commentLink(href, "c9")).toBe(
      "https://example.test/reviews/req?item=i1&round=r2#comment-c9",
    );
  });

  it("해결한 댓글만 따로 모으고 원래 순서를 지킨다", () => {
    const threads = [
      { id: "a", resolved: false },
      { id: "b", resolved: true },
      { id: "c", resolved: false },
      { id: "d", resolved: true },
    ];
    const { open, resolved } = splitResolvedThreads(threads);
    expect(open.map((x) => x.id)).toEqual(["a", "c"]);
    expect(resolved.map((x) => x.id)).toEqual(["b", "d"]);
  });
});
