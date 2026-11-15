/**
 * 전사 문장과 녹음 위치(ms)를 잇는 순수 함수 모음.
 * 브라우저 음성 인식은 단어별 시각을 주지 않아서, 결과가 처음 나타난 때와
 * 확정된 때의 녹음 경과 시간으로 문장 구간을 어림합니다.
 */
import type { SegmentTime } from "./domain";
import type { SpeechSegment } from "./live-speech";

/** 이 값보다 낮고 0보다 큰 신뢰도면 ‘인식이 불확실해요’로 표시해요. */
export const UNCERTAIN_CONFIDENCE = 0.6;

/** Web Speech가 0을 주면 신뢰도를 모르는 것이라 표시하지 않아요. */
export function isUncertain(confidence: number | undefined): boolean {
  return (
    typeof confidence === "number" &&
    confidence > 0 &&
    confidence < UNCERTAIN_CONFIDENCE
  );
}

/** 실시간 문장에서 저장할 위치 목록을 만들어요. 위치가 하나도 없으면 undefined. */
export function segmentTimesFrom(
  segments: readonly SpeechSegment[],
): SegmentTime[] | undefined {
  if (!segments.some((part) => typeof part.startMs === "number"))
    return undefined;
  return segments.map((part) => {
    const startMs = Math.max(0, Math.round(part.startMs ?? 0));
    const endMs = Math.max(startMs, Math.round(part.endMs ?? startMs));
    return typeof part.confidence === "number" && part.confidence > 0
      ? {
          startMs,
          endMs,
          confidence: Math.round(part.confidence * 1000) / 1000,
        }
      : { startMs, endMs };
  });
}

export interface SegmentOffset {
  index: number;
  start: number;
  end: number;
}

/** speechText()가 만드는 글(앞뒤 공백 정리, 빈 문장 제외, 줄바꿈 연결)에서 문장별 위치. */
export function segmentOffsets(
  segments: readonly Pick<SpeechSegment, "text">[],
): SegmentOffset[] {
  const out: SegmentOffset[] = [];
  let at = 0;
  segments.forEach((part, index) => {
    const text = part.text.trim();
    if (!text) return;
    if (out.length) at += 1; // 문장 사이 줄바꿈
    out.push({ index, start: at, end: at + text.length });
    at += text.length;
  });
  return out;
}

export interface TimeRange {
  startMs: number;
  endMs: number;
}

/**
 * 화면 글(displayed)의 [start, end) 선택을 녹음 구간으로 바꿔요.
 * 수정하지 않은 전사문이면 위치 그대로, 고친 전사문이면 고른 글을 원문에서 찾아요.
 * 찾지 못하거나 위치 기록이 없으면 null.
 */
export function timeRangeForSelection(
  segments: readonly Pick<SpeechSegment, "text">[],
  times: readonly SegmentTime[] | undefined,
  displayed: string,
  start: number,
  end: number,
): TimeRange | null {
  if (!times?.length || end <= start) return null;
  const offsets = segmentOffsets(segments);
  const raw = offsets.length
    ? segments
        .map((part) => part.text.trim())
        .filter(Boolean)
        .join("\n")
    : "";
  let from = start,
    to = end;
  if (displayed !== raw) {
    const picked = displayed.slice(start, end).trim();
    const found = picked ? raw.indexOf(picked) : -1;
    if (found < 0) return null;
    from = found;
    to = found + picked.length;
  }
  const hits = offsets
    .filter((item) => item.start < to && item.end > from)
    .map((item) => times[item.index])
    .filter((time): time is SegmentTime => !!time);
  if (!hits.length) return null;
  return {
    startMs: Math.min(...hits.map((time) => time.startMs)),
    endMs: Math.max(...hits.map((time) => time.endMs)),
  };
}

/**
 * 서버(rms_save_live_transcript)는 원문 문장에 text·final만 받아요.
 * 녹음 위치·신뢰도는 녹음 기록(segmentTimes)에 따로 저장하므로 덜어 내요.
 */
export function plainSegments(
  segments: readonly SpeechSegment[],
): SpeechSegment[] {
  return segments.map(({ text, final }) => ({ text, final }));
}

/** 00:00 꼴 경과 시간. 한 시간이 넘으면 1:02:03. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = total % 60;
  const mm = String(m).padStart(2, "0"),
    ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
