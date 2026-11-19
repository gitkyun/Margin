import { describe, expect, it } from "vitest";
import {
  newReviewRequest,
  withoutNewReview,
} from "../src/components/reviews/ReviewCreateHost";

describe("그 자리에서 여는 검토 요청 만들기 창(01 §3.3 `new=review`)", () => {
  it("골라 둘 수정 결과를 읽는다", () => {
    expect(newReviewRequest("?new=review")).toEqual([]);
    expect(newReviewRequest("?new=review&result=r1,r2")).toEqual(["r1", "r2"]);
  });

  it("다른 new 값은 건드리지 않는다", () => {
    expect(newReviewRequest("?new=result")).toBeNull();
    expect(newReviewRequest("?new=1")).toBeNull();
    expect(newReviewRequest("?result=r1")).toBeNull();
  });

  it("연 뒤에는 new·result만 지운다", () => {
    expect(withoutNewReview("?type=review&new=review&result=r1")).toBe(
      "?type=review",
    );
  });
});
