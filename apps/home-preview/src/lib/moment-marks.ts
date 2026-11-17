import type { TranscriptMark } from "./domain";
import { addMark } from "./recording-marks";

interface TimedSegment {
  text: string;
  startMs?: number;
  endMs?: number;
}

/** 늦게 확정되는 문장을 고려해 끝 시각 뒤로 조금 더 봐 줍니다. */
const SLACK_MS = 1500;

/** 누른 시각에 들리던 문장의 번호. 걸치는 문장이 없으면 그 전에 시작한 마지막 문장. */
export function segmentAt(
  segments: readonly TimedSegment[],
  ms: number,
): number {
  let before = -1;
  for (let i = 0; i < segments.length; i++) {
    const { startMs, endMs } = segments[i]!;
    if (typeof startMs !== "number") continue;
    const end = typeof endMs === "number" ? endMs : startMs;
    if (startMs <= ms && ms <= end + SLACK_MS) return i;
    if (startMs <= ms) before = i;
  }
  return before;
}

/**
 * 녹음 줄의 [지금 표시](IA v2 04 §6.2): 누른 시각의 문장에 형광펜을 칠합니다.
 * 형광펜은 전사 수정문 기준이라, 문장 글자를 수정문에서 순서대로 찾아 칠하고
 * 고쳐서 찾을 수 없는 문장은 건너뜁니다.
 */
export function momentMarks(
  edited: string,
  segments: readonly TimedSegment[],
  moments: readonly number[],
  existing?: readonly TranscriptMark[],
): TranscriptMark[] {
  // 문장마다 수정문 안의 자리(앞에서부터 차례로 찾음)
  const places: ({ start: number; end: number } | null)[] = [];
  let cursor = 0;
  for (const segment of segments) {
    const text = segment.text.trim();
    const at = text ? edited.indexOf(text, cursor) : -1;
    if (at === -1) places.push(null);
    else {
      places.push({ start: at, end: at + text.length });
      cursor = at + text.length;
    }
  }
  let marks = [...(existing ?? [])];
  for (const ms of moments) {
    const place = places[segmentAt(segments, ms)];
    if (place) marks = addMark(marks, edited, place.start, place.end);
  }
  return marks;
}
