import type { TextMark } from "./domain";
import { validMarks } from "./recording-marks";
import { DEFAULT_MARK_KIND, readMarkKind, type MarkKind } from "./mark-kinds";

export type AnchorKind = "feedback" | "decision" | "question" | "task";

export interface SourceItem {
  id: string;
  sourceQuote?: string;
  sourceMemoRevision?: number;
  sourceStart?: number;
  sourceEnd?: number;
}

export interface SourceAnchor {
  kind: AnchorKind;
  id: string;
  start: number;
  end: number;
  /** 원문에 나오는 순서대로 1부터 */
  number: number;
}

/**
 * 메모에서 만든 항목의 원문 위치(IA v2 08 §4.6). 판이 같으면 저장한 위치,
 * 다르면 인용 글자의 첫 자리. 못 찾으면 원문에 표시하지 않습니다.
 */
export function locateSource(
  item: SourceItem,
  memo: string,
  memoRevision: number,
): { start: number; end: number } | null {
  const quote = item.sourceQuote;
  if (!quote) return null;
  const { sourceStart: start, sourceEnd: end } = item;
  if (
    item.sourceMemoRevision === memoRevision &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    memo.slice(start, end) === quote
  )
    return { start: start!, end: end! };
  const at = memo.indexOf(quote);
  return at === -1 ? null : { start: at, end: at + quote.length };
}

/** 원문 위치를 찾은 항목에 원문 순서대로 번호를 붙입니다. */
export function sourceAnchors(
  memo: string,
  memoRevision: number,
  items: { kind: AnchorKind; item: SourceItem }[],
): SourceAnchor[] {
  return items
    .flatMap(({ kind, item }) => {
      const found = locateSource(item, memo, memoRevision);
      return found ? [{ kind, id: item.id, ...found }] : [];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((anchor, index) => ({ ...anchor, number: index + 1 }));
}

export interface MemoPiece {
  text: string;
  start: number;
  marked: boolean;
  /** 칠한 조각의 종류(칠하지 않은 조각은 기본값) */
  kind: MarkKind;
  /** 이 조각을 덮는 항목 id */
  anchors: string[];
  /** 이 조각 끝에서 끝나는 항목의 번호 */
  numbers: number[];
}

/** 형광펜과 원문 표시를 함께 그리도록 글을 조각냅니다. 이어 붙이면 원래 글이에요. */
export function memoPieces(
  text: string,
  marks: readonly TextMark[] | undefined,
  anchors: readonly SourceAnchor[],
): MemoPiece[] {
  const valid = validMarks(marks, text);
  const cuts = new Set([0, text.length]);
  for (const range of [...valid, ...anchors]) {
    cuts.add(range.start);
    cuts.add(range.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: MemoPiece[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!,
      to = points[i + 1]!;
    if (from >= to) continue;
    const mark = valid.find((item) => item.start < to && item.end > from);
    out.push({
      text: text.slice(from, to),
      start: from,
      marked: !!mark,
      kind: mark ? readMarkKind(mark.kind) : DEFAULT_MARK_KIND,
      anchors: anchors
        .filter((anchor) => anchor.start < to && anchor.end > from)
        .map((anchor) => anchor.id),
      numbers: anchors
        .filter((anchor) => anchor.end === to)
        .map((anchor) => anchor.number),
    });
  }
  return out;
}

/** 원문 위치를 덮는 항목(번호 순). 커서가 놓인 자리로 상세를 열 때 씁니다. */
export function anchorsAt(
  anchors: readonly SourceAnchor[],
  at: number,
): SourceAnchor[] {
  return anchors.filter((anchor) => anchor.start <= at && at <= anchor.end);
}
