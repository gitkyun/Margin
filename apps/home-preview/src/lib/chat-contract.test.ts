import { describe, it, expect } from "vitest";
import {
  validateInput,
  verifySource,
  normalizeAnswer,
} from "../../supabase/functions/ai-assist/validation";
const researchId = "1606810b-c364-4b30-8bb6-0a4fb23bd079",
  meetingId = "fee011e8-9f75-48f5-87ab-3fa4d617e4b1";
const input = {
  mode: "ask_research",
  researchId,
  meetingId,
  sourceText: "비교 기준을 확인한다.",
  sourceRevision: 2,
  question: "어떤 점을 먼저 볼까?",
  history: [],
};
describe("contextual research chat", () => {
  it("uses one saved source and retains the question", () => {
    const v = validateInput(input);
    expect(v.question).toBe(input.question);
    expect(() =>
      verifySource(v, { memo: input.sourceText, memoRevision: 2 }),
    ).not.toThrow();
  });
  it("rejects mixed sources and excessive history", () => {
    expect(() => validateInput({ ...input, feedbackId: meetingId })).toThrow();
    expect(() =>
      validateInput({
        ...input,
        history: Array(11).fill({ role: "user", text: "질문" }),
      }),
    ).toThrow();
  });
  it("refuses changed saved source", () => {
    expect(() =>
      verifySource(validateInput(input), {
        memo: "다른 원문",
        memoRevision: 2,
      }),
    ).toThrow();
  });
  it("requires a real nonempty answer", () => {
    expect(
      normalizeAnswer({ answer: "원문에서 비교 기준을 먼저 확인하세요." }),
    ).toContain("비교 기준");
    expect(() => normalizeAnswer({ answer: "" })).toThrow();
  });
});
