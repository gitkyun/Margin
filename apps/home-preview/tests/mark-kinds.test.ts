import { describe, expect, it } from "vitest";
import { readMarkKind, storedKind } from "../src/lib/mark-kinds";
import {
  addMark,
  kindAt,
  markedPieces,
  removeMarks,
} from "../src/lib/recording-marks";
import { relocateMarks } from "../src/lib/memo-marks";
import { memoPieces } from "../src/lib/source-anchors";

const TEXT = "표본 크기를 늘리기로 했어요. 선행연구 기준을 다시 봐요.";

describe("mark kinds (IA v2 6단계 형광펜 종류)", () => {
  it("reads unknown or missing kinds as the default '중요'", () => {
    expect(readMarkKind(undefined)).toBe("key");
    expect(readMarkKind("nope")).toBe("key");
    expect(readMarkKind("check")).toBe("check");
    expect(storedKind("key")).toEqual({});
    expect(storedKind("cite")).toEqual({ kind: "cite" });
  });

  it("stores the default kind without a kind field, like older marks", () => {
    const [mark] = addMark([], TEXT, 0, 5);
    expect(mark).not.toHaveProperty("kind");
  });

  it("paints a kind and repainting an overlapping range changes the kind", () => {
    const checked = addMark([], TEXT, 0, 5, "check");
    expect(kindAt(checked, TEXT, 1, 2)).toBe("check");
    const cited = addMark(checked, TEXT, 3, 8, "cite");
    expect(cited).toHaveLength(1);
    expect(cited[0]).toMatchObject({ start: 0, end: 8, kind: "cite" });
    expect(kindAt(cited, TEXT, 20, 22)).toBeNull();
    expect(removeMarks(cited, TEXT, 0, 8)).toEqual([]);
  });

  it("gives each drawn piece its kind", () => {
    const marks = addMark(addMark([], TEXT, 0, 5), TEXT, 17, 21, "check");
    const pieces = markedPieces(TEXT, marks).filter((piece) => piece.marked);
    expect(pieces.map((piece) => piece.kind)).toEqual(["key", "check"]);
    expect(
      memoPieces(TEXT, marks, [])
        .filter((piece) => piece.marked)
        .map((piece) => piece.kind),
    ).toEqual(["key", "check"]);
  });

  it("keeps the kind when a memo mark moves", () => {
    const marks = addMark([], TEXT, 17, 21, "cite");
    const moved = relocateMarks(marks, TEXT, `앞에 더함. ${TEXT}`);
    expect(moved[0]).toMatchObject({ start: 24, end: 28, kind: "cite" });
  });
});
