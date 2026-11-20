/**
 * 전사 수정문의 형광펜 범위. 원문·수정문 글자는 바꾸지 않고 위치만 따로 저장해요.
 * 녹음 기록은 음성 공유 때 함께 보일 수 있어 글자 대신 위치와 해시만 둡니다.
 */
import type { TranscriptMark } from "./domain";
import {
  DEFAULT_MARK_KIND,
  readMarkKind,
  storedKind,
  type MarkKind,
} from "./mark-kinds";

/** 한 전사문에 칠할 수 있는 형광펜 수(기록 용량 보호) */
export const MARK_LIMIT = 200;

/** FNV-1a 32비트. 범위의 글자가 그대로인지 확인하는 용도라 암호 강도는 필요 없어요. */
export function textHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function markOf(
  text: string,
  start: number,
  end: number,
  kind: MarkKind,
): TranscriptMark {
  return {
    start,
    end,
    hash: textHash(text.slice(start, end)),
    ...storedKind(kind),
  };
}

/** 지금 글자와 해시가 맞는 범위만 위치순으로 돌려줘요. */
export function validMarks(
  marks: readonly TranscriptMark[] | undefined,
  text: string,
): TranscriptMark[] {
  return (marks ?? [])
    .filter(
      (mark) =>
        Number.isInteger(mark.start) &&
        Number.isInteger(mark.end) &&
        mark.start >= 0 &&
        mark.end <= text.length &&
        mark.start < mark.end &&
        textHash(text.slice(mark.start, mark.end)) === mark.hash,
    )
    .sort((a, b) => a.start - b.start);
}

/**
 * 선택 범위를 칠해요. 겹치거나 맞닿은 기존 범위는 하나로 합쳐 고른 종류로 칠해요
 * (이미 칠한 곳을 다른 종류로 다시 칠하면 종류가 바뀌어요).
 */
export function addMark(
  marks: readonly TranscriptMark[] | undefined,
  text: string,
  start: number,
  end: number,
  kind: MarkKind = DEFAULT_MARK_KIND,
): TranscriptMark[] {
  const valid = validMarks(marks, text);
  const from = Math.max(0, Math.min(start, end)),
    to = Math.min(text.length, Math.max(start, end));
  if (from >= to || !text.slice(from, to).trim()) return valid;
  let lo = from,
    hi = to;
  const rest: TranscriptMark[] = [];
  for (const mark of valid) {
    if (mark.start <= hi && mark.end >= lo) {
      lo = Math.min(lo, mark.start);
      hi = Math.max(hi, mark.end);
    } else rest.push(mark);
  }
  return [...rest, markOf(text, lo, hi, kind)]
    .sort((a, b) => a.start - b.start)
    .slice(0, MARK_LIMIT);
}

/** 선택 범위와 겹치는 형광펜을 지워요. */
export function removeMarks(
  marks: readonly TranscriptMark[] | undefined,
  text: string,
  start: number,
  end: number,
): TranscriptMark[] {
  return validMarks(marks, text).filter(
    (mark) => !(mark.start < end && mark.end > start),
  );
}

/** 선택 범위가 이미 칠한 곳과 겹치는지 */
export function overlapsMark(
  marks: readonly TranscriptMark[] | undefined,
  text: string,
  start: number,
  end: number,
): boolean {
  return validMarks(marks, text).some(
    (mark) => mark.start < end && mark.end > start,
  );
}

export interface MarkedPiece {
  text: string;
  start: number;
  marked: boolean;
  /** 칠한 조각의 종류(칠하지 않은 조각은 기본값) */
  kind: MarkKind;
}

/** 선택 범위와 겹치는 첫 형광펜의 종류. 겹치는 것이 없으면 null */
export function kindAt(
  marks: readonly TranscriptMark[] | undefined,
  text: string,
  start: number,
  end: number,
): MarkKind | null {
  const mark = validMarks(marks, text).find(
    (item) => item.start < end && item.end > start,
  );
  return mark ? readMarkKind(mark.kind) : null;
}

/** 화면에 그리기 좋게 글을 칠한 조각과 아닌 조각으로 나눠요. 이어 붙이면 원래 글이에요. */
export function markedPieces(
  text: string,
  marks: readonly TranscriptMark[] | undefined,
): MarkedPiece[] {
  const out: MarkedPiece[] = [];
  let at = 0;
  for (const mark of validMarks(marks, text)) {
    if (mark.start < at) continue;
    if (mark.start > at)
      out.push({
        text: text.slice(at, mark.start),
        start: at,
        marked: false,
        kind: DEFAULT_MARK_KIND,
      });
    out.push({
      text: text.slice(mark.start, mark.end),
      start: mark.start,
      marked: true,
      kind: readMarkKind(mark.kind),
    });
    at = mark.end;
  }
  if (at < text.length)
    out.push({
      text: text.slice(at),
      start: at,
      marked: false,
      kind: DEFAULT_MARK_KIND,
    });
  return out;
}
