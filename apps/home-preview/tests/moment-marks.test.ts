import { describe, expect, it } from "vitest";
import { momentMarks, segmentAt } from "../src/lib/moment-marks";

const segments = [
  { text: "선행연구 표는", startMs: 0, endMs: 3000 },
  { text: "비교 기준을 넣자.", startMs: 4000, endMs: 7000 },
  { text: "다음 주에 보자.", startMs: 12000, endMs: 15000 },
];

describe("녹음 [지금 표시](IA v2 04 §6.2)", () => {
  it("누른 시각의 문장, 사이면 앞 문장", () => {
    expect(segmentAt(segments, 5000)).toBe(1);
    expect(segmentAt(segments, 8000)).toBe(1); // 끝 뒤 1.5초까지
    expect(segmentAt(segments, 10000)).toBe(1); // 사이: 앞 문장
    expect(segmentAt(segments, 13000)).toBe(2);
    expect(segmentAt([{ text: "x" }], 100)).toBe(-1);
  });

  it("수정문에서 문장을 찾아 칠하고, 고친 문장은 건너뛴다", () => {
    const edited = "선행연구 표는 비교 기준을 넣자. 다음 주에 다시 보자.";
    const marks = momentMarks(edited, segments, [5000, 13000, 5100]);
    expect(marks).toHaveLength(1);
    expect(edited.slice(marks[0]!.start, marks[0]!.end)).toBe(
      "비교 기준을 넣자.",
    );
    expect(momentMarks(edited, segments, [])).toEqual([]);
  });
});
