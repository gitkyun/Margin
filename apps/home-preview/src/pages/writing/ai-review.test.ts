import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Node as ProseNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import {
  AIReviewHighlight,
  aiReviewKey,
  findQuoteRange,
  isReviewStale,
  rangeText,
  suggestedSentence,
} from "./ai-review";

const schema = getSchema([StarterKit, AIReviewHighlight]);
const doc = (...paragraphs: (string | "BR")[][]) =>
  ProseNode.fromJSON(schema, {
    type: "doc",
    content: paragraphs.map((parts) => ({
      type: "paragraph",
      content: parts.map((part) =>
        part === "BR" ? { type: "hardBreak" } : { type: "text", text: part },
      ),
    })),
  });

describe("findQuoteRange", () => {
  const sample = doc(
    ["첫 문단이에요."],
    ["연구 대상은 대학생이에요. 표본은 30명이에요."],
  );
  const whole = { from: 0, to: sample.content.size };

  it("finds the exact position of a quote inside one paragraph", () => {
    const range = findQuoteRange(sample, "표본은 30명이에요.", whole)!;
    expect(sample.textBetween(range.from, range.to)).toBe("표본은 30명이에요.");
  });

  it("keeps positions right after a hard break", () => {
    const withBreak = doc(["앞줄", "BR", "뒷줄 문장이에요."]);
    const range = findQuoteRange(withBreak, "뒷줄 문장", {
      from: 0,
      to: withBreak.content.size,
    })!;
    expect(withBreak.textBetween(range.from, range.to)).toBe("뒷줄 문장");
  });

  it("ignores matches outside the reviewed range and quotes across paragraphs", () => {
    const second = findQuoteRange(sample, "첫 문단", {
      from: 12,
      to: whole.to,
    });
    expect(second).toBeNull();
    expect(findQuoteRange(sample, "이에요.\n\n연구", whole)).toBeNull();
    expect(findQuoteRange(sample, "  ", whole)).toBeNull();
  });
});

describe("review range tracking", () => {
  function start(text: string, from: number, to: number) {
    const state = EditorState.create({
      schema,
      doc: doc([text]),
      plugins: AIReviewHighlight.config.addProseMirrorPlugins!.call({
        name: "marginAIReview",
        options: {},
        storage: {},
        editor: undefined as never,
        type: undefined as never,
        parent: undefined as never,
      }),
    });
    return state.apply(
      state.tr.setMeta(aiReviewKey, { type: "start", range: { from, to } }),
    );
  }

  it("becomes stale when the user edits inside the range", () => {
    const state = start("가나다라마바사", 2, 6);
    expect(isReviewStale(state)).toBe(false);
    const edited = state.apply(state.tr.insertText("X", 3));
    expect(isReviewStale(edited)).toBe(true);
  });

  it("follows edits outside the range without going stale", () => {
    const state = start("가나다라마바사", 3, 6);
    const edited = state.apply(state.tr.insertText("앞", 1));
    const value = aiReviewKey.getState(edited)!;
    expect(rangeText(edited.doc, value.range!)).toBe("다라마");
    expect(isReviewStale(edited)).toBe(false);
  });

  it("accepts its own applied change as the new baseline", () => {
    const state = start("가나다라마바사", 2, 6);
    const tr = state.tr.insertText("고친", 3, 5);
    tr.setMeta(aiReviewKey, { type: "applied" });
    const applied = state.apply(tr);
    expect(isReviewStale(applied)).toBe(false);
  });
});

describe("suggestedSentence", () => {
  it("takes the last quoted example that differs from the original", () => {
    const result = suggestedSentence(
      "‘표본은 30명이에요.’를 “표본은 대학생 30명으로, 모집 방법은 3장에 적었어요.”처럼 고치면 근거가 분명해져요.",
      "표본은 30명이에요.",
    );
    expect(result).toEqual({
      text: "표본은 대학생 30명으로, 모집 방법은 3장에 적었어요.",
      fromAI: true,
    });
  });

  it("falls back to the original when there is no example", () => {
    expect(suggestedSentence("여기에 근거가 필요해요.", "원문 문장")).toEqual({
      text: "원문 문장",
      fromAI: false,
    });
  });
});
