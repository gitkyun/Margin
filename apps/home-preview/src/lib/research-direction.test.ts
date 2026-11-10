import { describe, expect, it } from "vitest";
import {
  PURPOSE_MAX,
  QUESTIONS_MAX,
  hasDirection,
  parseQuestions,
  planExcerpt,
} from "./research-direction";

describe("parseQuestions", () => {
  it("reads one question per line and strips numbering and bullets", () => {
    expect(
      parseQuestions(
        "1. 미팅 기록은 어떻게 쓰이는가?\n- 피드백은 어디서 사라지는가?\n\nRQ3: 교수는 무엇을 확인하는가?",
      ),
    ).toEqual([
      "미팅 기록은 어떻게 쓰이는가?",
      "피드백은 어디서 사라지는가?",
      "교수는 무엇을 확인하는가?",
    ]);
  });

  it("keeps at most the allowed number of questions", () => {
    const text = Array.from({ length: 9 }, (_, i) => `질문 ${i}`).join("\n");
    expect(parseQuestions(text)).toHaveLength(QUESTIONS_MAX);
  });

  it("returns an empty list for blank text", () => {
    expect(parseQuestions("  \n ")).toEqual([]);
  });
});

describe("hasDirection", () => {
  it("is true when a purpose or at least one question is written", () => {
    expect(hasDirection({ purpose: "지도 기록의 쓰임을 밝힌다" })).toBe(true);
    expect(hasDirection({ questions: ["무엇이 사라지는가?"] })).toBe(true);
  });

  it("is false when both are empty", () => {
    expect(hasDirection({ purpose: "  ", questions: [] })).toBe(false);
    expect(hasDirection({})).toBe(false);
  });
});

describe("planExcerpt", () => {
  const doc = (over: Partial<Parameters<typeof planExcerpt>[0][number]>) => ({
    researchId: "r1",
    type: "plan" as const,
    text: "",
    updatedAt: "2026-11-01T00:00:00Z",
    ...over,
  });

  it("takes the first non-empty paragraph of the most recently edited plan", () => {
    const documents = [
      doc({ text: "오래된 계획서", updatedAt: "2026-10-01T00:00:00Z" }),
      doc({ text: "\n\n이 연구는 지도 기록의 쓰임을 밝힌다.\n둘째 문단" }),
      doc({
        type: "manuscript",
        text: "원고",
        updatedAt: "2026-11-09T00:00:00Z",
      }),
      doc({
        researchId: "r2",
        text: "다른 연구",
        updatedAt: "2026-11-09T00:00:00Z",
      }),
    ];
    expect(planExcerpt(documents, "r1")).toBe(
      "이 연구는 지도 기록의 쓰임을 밝힌다.",
    );
  });

  it("cuts a long paragraph at the purpose limit", () => {
    const excerpt = planExcerpt([doc({ text: "가".repeat(500) })], "r1");
    expect(excerpt).toHaveLength(PURPOSE_MAX);
    expect(excerpt?.endsWith("…")).toBe(true);
  });

  it("returns null without a plan or when the plan is empty or archived", () => {
    expect(planExcerpt([], "r1")).toBeNull();
    expect(planExcerpt([doc({ text: "   " })], "r1")).toBeNull();
    expect(
      planExcerpt(
        [doc({ text: "보관됨", archivedAt: "2026-11-02T00:00:00Z" })],
        "r1",
      ),
    ).toBeNull();
  });
});
