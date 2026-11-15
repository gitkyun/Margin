import { describe, expect, it } from "vitest";
import {
  clockText,
  isUncertain,
  plainSegments,
  segmentOffsets,
  segmentTimesFrom,
  timeRangeForSelection,
} from "./recording-timeline";

const segments = [
  { text: " 연구 계획 ", final: true },
  { text: "  ", final: true },
  { text: "선행 연구 보완", final: true },
  { text: "표본 수 확인", final: false },
];
const times = [
  { startMs: 1000, endMs: 3000 },
  { startMs: 3000, endMs: 3100 },
  { startMs: 4000, endMs: 7000, confidence: 0.4 },
  { startMs: 8000, endMs: 9500 },
];
const raw = "연구 계획\n선행 연구 보완\n표본 수 확인";

describe("recording timeline", () => {
  it("marks only confidence between 0 and 0.6 as uncertain", () => {
    expect(isUncertain(undefined)).toBe(false);
    expect(isUncertain(0)).toBe(false);
    expect(isUncertain(0.59)).toBe(true);
    expect(isUncertain(0.6)).toBe(false);
  });

  it("computes offsets the same way speechText joins segments", () => {
    expect(segmentOffsets(segments)).toEqual([
      { index: 0, start: 0, end: 5 },
      { index: 2, start: 6, end: 14 },
      { index: 3, start: 15, end: 22 },
    ]);
  });

  it("maps a selection in the unedited transcript to its recording span", () => {
    const start = raw.indexOf("보완"),
      end = raw.indexOf("수") + 1;
    expect(timeRangeForSelection(segments, times, raw, start, end)).toEqual({
      startMs: 4000,
      endMs: 9500,
    });
  });

  it("finds an edited transcript selection in the original text", () => {
    const edited = "회의 시작\n연구 계획\n선행 연구 보완 필요";
    const start = edited.indexOf("선행"),
      end = start + "선행 연구".length;
    expect(timeRangeForSelection(segments, times, edited, start, end)).toEqual({
      startMs: 4000,
      endMs: 7000,
    });
  });

  it("returns null when the selection is new text or times are missing", () => {
    const edited = "직접 쓴 문장";
    expect(timeRangeForSelection(segments, times, edited, 0, 5)).toBeNull();
    expect(timeRangeForSelection(segments, undefined, raw, 0, 5)).toBeNull();
    expect(timeRangeForSelection(segments, times, raw, 3, 3)).toBeNull();
  });

  it("keeps only rounded numbers and positive confidence when saving", () => {
    expect(
      segmentTimesFrom([
        { text: "가", final: true, startMs: 10.4, endMs: 900.6, confidence: 0 },
        {
          text: "나",
          final: true,
          startMs: 1000,
          endMs: 900,
          confidence: 0.81234,
        },
      ]),
    ).toEqual([
      { startMs: 10, endMs: 901 },
      { startMs: 1000, endMs: 1000, confidence: 0.812 },
    ]);
    expect(segmentTimesFrom([{ text: "가", final: true }])).toBeUndefined();
  });

  it("formats elapsed clocks", () => {
    expect(clockText(65_000)).toBe("01:05");
    expect(clockText(3_723_000)).toBe("1:02:03");
    expect(clockText(-5)).toBe("00:00");
  });
  it("strips timing and confidence before the strict transcript RPC", () => {
    expect(
      plainSegments([
        { text: "가", final: true, startMs: 1, endMs: 2, confidence: 0.3 },
      ]),
    ).toEqual([{ text: "가", final: true }]);
  });
});
