import { describe, expect, it } from "vitest";
import {
  addMark,
  markedPieces,
  overlapsMark,
  removeMarks,
  textHash,
  validMarks,
} from "./recording-marks";

const text = "표본 수를 늘리고 비교표를 다시 그려요.";

describe("transcript marks", () => {
  it("adds a mark with a hash of the marked text only", () => {
    const marks = addMark([], text, 0, 5);
    expect(marks).toEqual([{ start: 0, end: 5, hash: textHash("표본 수를") }]);
    expect(JSON.stringify(marks)).not.toContain("표본");
  });

  it("merges overlapping or touching marks", () => {
    const first = addMark([], text, 0, 5);
    const merged = addMark(first, text, 3, 9);
    expect(merged).toHaveLength(1);
    expect(text.slice(merged[0].start, merged[0].end)).toBe(text.slice(0, 9));
    const touching = addMark(merged, text, 9, 12);
    expect(touching).toHaveLength(1);
  });

  it("ignores blank selections and keeps the input untouched", () => {
    const original = addMark([], text, 0, 2);
    const copy = JSON.parse(JSON.stringify(original));
    addMark(original, text, 10, 11);
    expect(original).toEqual(copy);
    expect(addMark(original, "가  나", 1, 3)).toEqual(
      validMarks(original, "가  나"),
    );
  });

  it("drops marks whose text changed after editing", () => {
    const marks = addMark([], text, 0, 5);
    expect(validMarks(marks, `앞에 ${text}`)).toEqual([]);
    expect(validMarks(marks, text)).toHaveLength(1);
  });

  it("removes overlapping marks and reports overlap", () => {
    const marks = addMark(addMark([], text, 0, 2), text, 10, 15);
    expect(overlapsMark(marks, text, 1, 3)).toBe(true);
    expect(overlapsMark(marks, text, 5, 8)).toBe(false);
    expect(removeMarks(marks, text, 1, 3)).toEqual([marks[1]]);
  });

  it("splits text into pieces that join back to the original", () => {
    const marks = addMark([], text, 3, 5);
    const pieces = markedPieces(text, marks);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    expect(pieces.filter((p) => p.marked).map((p) => p.text)).toEqual(["수를"]);
    expect(markedPieces("", marks)).toEqual([]);
  });
});
