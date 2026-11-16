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
describe("research chat without an attached record", () => {
  const free = {
    mode: "ask_research",
    researchId,
    question: "연구 질문을 좁히는 방법은?",
    clientRunId: "0b0c7e1e-5f0a-4c53-9a3e-2f6d1a7b9c10",
    contexts: [],
    sourceText: "",
    history: [],
  };
  it("accepts a question alone and sends no source text", () => {
    const v = validateInput(free);
    expect(v.question).toBe(free.question);
    expect(v.sourceText).toBe("");
    expect(v.contexts).toEqual([]);
  });
  it("still needs a question and a run id", () => {
    expect(() => validateInput({ ...free, question: "  " })).toThrow();
    expect(() => validateInput({ ...free, clientRunId: "x" })).toThrow();
  });
  it("lets other requests go without a record: the server finds it in the research", () => {
    for (const mode of ["organize_meeting", "suggest_revisions"]) {
      const v = validateInput({ ...free, mode });
      expect(v.contexts).toEqual([]);
      expect(v.sourceText).toBe("");
      expect(() =>
        validateInput({ ...free, mode, clientRunId: "x" }),
      ).toThrow();
    }
  });
});
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
