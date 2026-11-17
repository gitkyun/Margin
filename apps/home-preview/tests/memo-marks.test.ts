import { describe, expect, it } from "vitest";
import { relocateMarks } from "../src/lib/memo-marks";
import { addMark, validMarks } from "../src/lib/recording-marks";

describe("메모 형광펜 자리 옮기기(IA v2 08 §3.1)", () => {
  const before = "서론. 비교 기준을 넣자. 끝.";
  const marks = addMark([], before, 4, 13);

  it("앞부분을 고치면 같은 글자를 찾아 옮긴다", () => {
    const after = "새 서론 문단. 비교 기준을 넣자. 끝.";
    const moved = relocateMarks(marks, before, after);
    expect(validMarks(moved, after)).toHaveLength(1);
    expect(after.slice(moved[0]!.start, moved[0]!.end)).toBe(
      before.slice(4, 13),
    );
  });

  it("같은 글자가 여럿이면 원래 자리에서 가장 가까운 곳으로", () => {
    const text = "가나다 가나다";
    const m = addMark([], text, 4, 7);
    const after = "X가나다 가나다";
    expect(relocateMarks(m, text, after)[0]!.start).toBe(5);
  });

  it("글자를 지웠으면 그리지 않지만 표시는 남긴다", () => {
    const after = "서론. 끝.";
    const kept = relocateMarks(marks, before, after);
    expect(kept).toHaveLength(1);
    expect(validMarks(kept, after)).toHaveLength(0);
  });
});
