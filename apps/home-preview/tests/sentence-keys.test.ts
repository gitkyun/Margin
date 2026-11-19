import { describe, expect, it } from "vitest";
import {
  pickRange,
  sentenceAt,
  sentenceRanges,
  stepSentence,
} from "@/lib/sentence-keys";

const slice = (text: string) =>
  sentenceRanges(text).map(({ start, end }) => text.slice(start, end));

describe("sentenceRanges", () => {
  it("splits on sentence marks followed by a space, a line break or the end", () => {
    expect(slice("첫 문장입니다. 둘째는요? 셋째!  넷째")).toEqual([
      "첫 문장입니다.",
      "둘째는요?",
      "셋째!",
      "넷째",
    ]);
  });

  it("keeps decimals and closing quotes in one sentence", () => {
    expect(slice("효과는 3.5배였어요. “정말요?” 네.")).toEqual([
      "효과는 3.5배였어요.",
      "“정말요?”",
      "네.",
    ]);
  });

  it("splits on line breaks and skips blank lines", () => {
    expect(slice("  첫 줄\n\n둘째 줄  \n")).toEqual(["첫 줄", "둘째 줄"]);
  });

  it("returns nothing for blank text", () => {
    expect(sentenceRanges("  \n ")).toEqual([]);
  });
});

describe("stepSentence", () => {
  it("starts from the first sentence going down and the last going up", () => {
    expect(stepSentence(null, 3, 1, false)).toEqual({ anchor: 0, focus: 0 });
    expect(stepSentence(null, 3, -1, false)).toEqual({ anchor: 2, focus: 2 });
    expect(stepSentence(null, 0, 1, false)).toBeNull();
  });

  it("moves one sentence and stops at the ends", () => {
    expect(stepSentence({ anchor: 0, focus: 0 }, 3, 1, false)).toEqual({
      anchor: 1,
      focus: 1,
    });
    expect(stepSentence({ anchor: 2, focus: 2 }, 3, 1, false)).toEqual({
      anchor: 2,
      focus: 2,
    });
  });

  it("extends and shrinks the range with Shift", () => {
    const wide = stepSentence({ anchor: 1, focus: 1 }, 4, 1, true);
    expect(wide).toEqual({ anchor: 1, focus: 2 });
    expect(stepSentence(wide, 4, -1, true)).toEqual({ anchor: 1, focus: 1 });
    expect(stepSentence({ anchor: 1, focus: 1 }, 4, -1, true)).toEqual({
      anchor: 1,
      focus: 0,
    });
  });
});

describe("pickRange and sentenceAt", () => {
  const text = "가나. 다라. 마바.";
  const ranges = sentenceRanges(text);

  it("covers every picked sentence in either direction", () => {
    const { start, end } = pickRange(ranges, { anchor: 2, focus: 1 });
    expect(text.slice(start, end)).toBe("다라. 마바.");
  });

  it("finds the sentence holding an offset", () => {
    expect(sentenceAt(ranges, 0)).toBe(0);
    expect(sentenceAt(ranges, 3)).toBe(1);
    expect(sentenceAt(ranges, 99)).toBe(2);
  });
});
