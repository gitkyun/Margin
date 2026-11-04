import { describe, expect, it } from "vitest";
import { emptyWorkspace, type ReviewRound } from "@/lib/domain";
import { isLatestRound } from "./helpers";

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
