import { describe, expect, it } from "vitest";
import { normalizeSuggestEdits, validateInput } from "./validation";
import { buildSystemPrompt, buildUserPayload } from "./prompts";

const ids = {
  researchId: "11111111-1111-4111-8111-111111111111",
  clientRunId: "22222222-2222-4222-8222-222222222222",
  documentId: "33333333-3333-4333-8333-333333333333",
  feedback: "44444444-4444-4444-8444-444444444444",
};

describe("suggest_edits input (IA v2 08 §5.3)", () => {
  it("takes the document id and revision, never the text from the screen", () => {
    const input = validateInput({
      mode: "suggest_edits",
      researchId: ids.researchId,
      clientRunId: ids.clientRunId,
      documentId: ids.documentId,
      sourceRevision: 3,
      range: { start: 2, end: 10 },
      question: "더 간결하게",
      contexts: [{ id: ids.feedback, kind: "feedback", title: "피드백" }],
    });
    expect(input).toMatchObject({
      mode: "suggest_edits",
      documentId: ids.documentId,
      sourceRevision: 3,
      range: { start: 2, end: 10 },
      sourceText: "",
      contexts: [{ id: ids.feedback, kind: "feedback", title: "피드백" }],
    });
  });

  it("rejects pasted text, bad ranges, other context kinds and web search", () => {
    const base = {
      mode: "suggest_edits",
      researchId: ids.researchId,
      clientRunId: ids.clientRunId,
      documentId: ids.documentId,
      sourceRevision: 1,
    };
    expect(() =>
      validateInput({ ...base, sourceText: "붙여 넣은 글" }),
    ).toThrow();
    expect(() =>
      validateInput({ ...base, range: { start: 5, end: 5 } }),
    ).toThrow();
    expect(() => validateInput({ ...base, sourceRevision: -1 })).toThrow();
    expect(() =>
      validateInput({
        ...base,
        contexts: [{ id: ids.feedback, kind: "documents", title: "글" }],
      }),
    ).toThrow();
    expect(() => validateInput({ ...base, webSearch: true })).toThrow();
    expect(() => validateInput({ ...base, documentId: "nope" })).toThrow();
  });
});

describe("normalizeSuggestEdits", () => {
  const text = "연구 도구 사용은 늘고 있다. 연구 도구 사용은 중요하다.";

  it("finds each quote in the text and keeps UTF-16 positions in order", () => {
    const result = normalizeSuggestEdits(
      {
        candidates: [
          { title: "강조", sourceQuote: "중요하다", body: "핵심이다" },
          { title: "시제", sourceQuote: "늘고 있다", body: "늘었다" },
        ],
      },
      text,
    );
    expect(result.droppedQuotes).toBe(0);
    expect(result.candidates.map((c) => c.title)).toEqual(["시제", "강조"]);
    for (const c of result.candidates)
      expect(text.slice(c.sourceStart, c.sourceEnd)).toBe(c.sourceQuote);
  });

  it("uses the next free occurrence for repeated text and stays in range", () => {
    const quote = "연구 도구 사용은";
    const result = normalizeSuggestEdits(
      {
        candidates: [
          { title: "a", sourceQuote: quote, body: "도구 사용은" },
          { title: "b", sourceQuote: quote, body: "그 사용은" },
        ],
      },
      text,
    );
    const [first, second] = result.candidates;
    expect(first.sourceStart).toBe(0);
    expect(second.sourceStart).toBe(text.indexOf(quote, 1));

    const ranged = normalizeSuggestEdits(
      { candidates: [{ title: "a", sourceQuote: quote, body: "그것은" }] },
      text,
      { start: 5, end: text.length },
    );
    expect(ranged.candidates[0].sourceStart).toBe(text.indexOf(quote, 5));
  });

  it("drops quotes it cannot find, no-op edits and malformed items, but keeps the rest", () => {
    const result = normalizeSuggestEdits(
      {
        candidates: [
          { title: "없는 글", sourceQuote: "지어낸 문장", body: "x" },
          { title: "같음", sourceQuote: "중요하다", body: "중요하다" },
          { title: "형식", sourceQuote: "중요하다", body: 3 },
          {
            title: "지우기",
            sourceQuote: " 연구 도구 사용은 중요하다.",
            body: "",
          },
        ],
      },
      text,
    );
    expect(result.droppedQuotes).toBe(3);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].body).toBe("");
  });

  it("separates nothing to fix from unverifiable output", () => {
    expect(() => normalizeSuggestEdits({ candidates: [] }, text)).toThrow(
      /고칠 곳을 찾지 못했어요/,
    );
    expect(() =>
      normalizeSuggestEdits(
        { candidates: [{ title: "a", sourceQuote: "없음", body: "b" }] },
        text,
      ),
    ).toThrow(/찾지 못해/);
  });
});

describe("suggest_edits prompt", () => {
  it("asks for exact quotes and replacement text, and allows an empty list", () => {
    const prompt = buildSystemPrompt({ mode: "suggest_edits" });
    expect(prompt).toContain("[고칠 글]");
    expect(prompt).toContain("sourceQuote");
    expect(prompt).toContain("candidates를 빈 배열로 반환한다");
    const payload = JSON.parse(
      buildUserPayload({
        mode: "suggest_edits",
        sourceText: "[고칠 글] 제목\n본문",
        question: "간결하게",
      }),
    );
    expect(payload).toMatchObject({
      task: "suggest_edits",
      question: "간결하게",
    });
  });
});
