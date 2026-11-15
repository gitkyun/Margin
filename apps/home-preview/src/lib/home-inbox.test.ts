import { describe, expect, it } from "vitest";
import { reviewDecision } from "./home-inbox";

describe("reviewDecision", () => {
  it("asks the student to decide the next fix for ‘추가 수정 필요’", () => {
    const decision = reviewDecision({
      kind: "response",
      tone: "amber",
      title: "2장 수정",
    });
    expect(decision.openLabel).toBe("응답 보기");
    expect(decision.canMakeTask).toBe(true);
    expect(decision.taskTitle).toBe("‘2장 수정’ 추가 수정");
  });

  it("does not offer a task for a confirmed response", () => {
    const decision = reviewDecision({
      kind: "response",
      tone: "green",
      title: "2장 수정",
    });
    expect(decision.canMakeTask).toBe(false);
  });

  it("offers reply or task for a comment", () => {
    const decision = reviewDecision({
      kind: "comment",
      tone: "blue",
      title: "",
    });
    expect(decision.openLabel).toBe("댓글 보기");
    expect(decision.taskTitle).toBe("‘수정 결과’ 댓글 반영");
  });

  it("sends a reviewer to the review without a task button", () => {
    const decision = reviewDecision({
      kind: "round",
      tone: "blue",
      title: "3장",
    });
    expect(decision.openLabel).toBe("검토하기");
    expect(decision.canMakeTask).toBe(false);
  });
});
