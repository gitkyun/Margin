import { describe, expect, it } from "vitest";
import {
  newFeedbackRequest,
  withoutNewFeedback,
} from "@/components/feedback/FeedbackCreateHost";

describe("그 자리에서 여는 피드백 직접 추가 창(01 §3.3 `new=feedback`)", () => {
  it("new=feedback일 때만 연다", () => {
    expect(newFeedbackRequest("?new=feedback")).toBe(true);
    expect(newFeedbackRequest("?view=feedback&new=feedback")).toBe(true);
    expect(newFeedbackRequest("?new=1")).toBe(false);
    expect(newFeedbackRequest("?new=result")).toBe(false);
    expect(newFeedbackRequest("")).toBe(false);
  });

  it("창을 연 뒤 new만 지우고 보기·필터는 남긴다", () => {
    expect(withoutNewFeedback("?view=feedback&new=feedback&status=held")).toBe(
      "?view=feedback&status=held",
    );
    expect(withoutNewFeedback("?new=feedback")).toBe("");
  });
});
