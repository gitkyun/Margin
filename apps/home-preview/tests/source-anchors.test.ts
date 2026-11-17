import { describe, expect, it } from "vitest";
import {
  anchorsAt,
  locateSource,
  memoPieces,
  sourceAnchors,
} from "../src/lib/source-anchors";
import { textHash } from "../src/lib/recording-marks";

const memo = "비교 기준을 넣자. 표를 다시 그리자. 비교 기준을 넣자.";

describe("원문 위치(IA v2 08 §4.6)", () => {
  it("판이 같으면 저장한 위치, 다르면 인용의 첫 자리, 없으면 null", () => {
    const quote = "비교 기준을 넣자.";
    const second = memo.lastIndexOf(quote);
    const item = {
      id: "a",
      sourceQuote: quote,
      sourceMemoRevision: 3,
      sourceStart: second,
      sourceEnd: second + quote.length,
    };
    expect(locateSource(item, memo, 3)).toEqual({
      start: second,
      end: second + quote.length,
    });
    expect(locateSource(item, memo, 4)).toEqual({
      start: 0,
      end: quote.length,
    });
    expect(locateSource({ id: "b", sourceQuote: "없는 글" }, memo, 3)).toBe(
      null,
    );
    expect(locateSource({ id: "c" }, memo, 3)).toBe(null);
  });

  it("원문 순서로 번호를 붙이고 형광펜과 함께 조각낸다", () => {
    const anchors = sourceAnchors(memo, 1, [
      { kind: "task", item: { id: "t", sourceQuote: "표를 다시 그리자." } },
      { kind: "feedback", item: { id: "f", sourceQuote: "비교 기준" } },
      { kind: "question", item: { id: "q", sourceQuote: "없음" } },
    ]);
    expect(anchors.map((a) => [a.id, a.number])).toEqual([
      ["f", 1],
      ["t", 2],
    ]);
    const marks = [{ start: 3, end: 8, hash: textHash(memo.slice(3, 8)) }];
    const pieces = memoPieces(memo, marks, anchors);
    expect(pieces.map((p) => p.text).join("")).toBe(memo);
    const first = pieces.find((p) => p.start === 3)!;
    expect(first.marked).toBe(true);
    expect(first.anchors).toEqual(["f"]);
    expect(first.numbers).toEqual([1]);
    expect(anchorsAt(anchors, 0).map((a) => a.id)).toEqual(["f"]);
    expect(anchorsAt(anchors, 9)).toEqual([]);
  });
});
