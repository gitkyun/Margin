import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { TextSerializer } from "@tiptap/core";

/** TipTap `getTextSerializersFromSchema`가 주는 것(노드 → 평문). 예: hardBreak → "\n" */
export type TextSerializers = Record<string, TextSerializer>;

export interface TextMap {
  /** `editor.getText()`와 같은 평문(문단 사이 "\n\n") */
  text: string;
  /** 평문 글자마다의 편집기 위치. 문단 구분·줄바꿈처럼 글자가 아닌 곳은 -1 */
  pos: number[];
}

/**
 * 글 평문 위치(서버의 `documents.text` 기준, UTF-16)와 편집기 위치를 잇는 표(IA v2 08 §5.3).
 * TipTap `getTextBetween`과 같은 규칙으로 평문을 만들면서 글자마다 위치를 적습니다.
 */
export function textMap(
  doc: ProseMirrorNode,
  serializers: TextSerializers = {},
  blockSeparator = "\n\n",
): TextMap {
  let text = "";
  const pos: number[] = [];
  const push = (chunk: string, at = -1) => {
    text += chunk;
    for (let i = 0; i < chunk.length; i++) pos.push(at < 0 ? -1 : at + i);
  };
  const range = { from: 0, to: doc.content.size };
  doc.nodesBetween(range.from, range.to, (node, at, parent, index) => {
    if (node.isBlock && at > 0) push(blockSeparator);
    const serialize = serializers[node.type.name];
    if (serialize) {
      if (parent) push(serialize({ node, pos: at, parent, index, range }));
      return false;
    }
    if (node.isText) push(node.text ?? "", at);
    return true;
  });
  return { text, pos };
}

/**
 * 평문 [start, end)를 편집기 범위로 옮깁니다. 한 문단 안의 이어진 글자일 때만 옮기고,
 * 문단을 넘거나 줄바꿈이 끼면 null(그 제안은 보이지 않음).
 */
export function toEditorRange(
  map: TextMap,
  start: number,
  end: number,
): { from: number; to: number } | null {
  if (start < 0 || end <= start || end > map.text.length) return null;
  const from = map.pos[start];
  if (from < 0) return null;
  for (let i = start + 1; i < end; i++)
    if (map.pos[i] !== map.pos[i - 1] + 1) return null;
  return { from, to: map.pos[end - 1] + 1 };
}

/** 편집기 위치를 평문 위치로(고른 범위를 서버에 보낼 때). 글자가 아니면 가장 가까운 다음 글자. */
export function toTextOffset(map: TextMap, editorPos: number): number {
  for (let i = 0; i < map.pos.length; i++)
    if (map.pos[i] >= editorPos) return i;
  return map.text.length;
}

export interface PlacedSuggestion {
  id: string;
  start: number;
  end: number;
  from: number;
  to: number;
}

/**
 * 지금 글에서 제안의 원문 자리를 찾습니다. 받은 때의 위치(hint)에 가장 가까운 같은 글자를 쓰고,
 * 앞서 자리를 잡은 제안과 겹치면 다음 자리를 찾습니다. 못 찾으면 그 제안은 빠집니다
 * (사용자가 그 자리를 직접 고쳤거나 글이 다른 곳에서 바뀐 것).
 */
export function placeSuggestions(
  map: TextMap,
  items: { id: string; quote: string; hint: number }[],
): PlacedSuggestion[] {
  const placed: PlacedSuggestion[] = [];
  const overlaps = (start: number, end: number) =>
    placed.some((p) => start < p.end && p.start < end);
  for (const item of items) {
    if (!item.quote) continue;
    const spots: number[] = [];
    for (
      let at = map.text.indexOf(item.quote);
      at >= 0;
      at = map.text.indexOf(item.quote, at + 1)
    )
      spots.push(at);
    spots.sort((a, b) => Math.abs(a - item.hint) - Math.abs(b - item.hint));
    for (const start of spots) {
      const end = start + item.quote.length;
      if (overlaps(start, end)) continue;
      const range = toEditorRange(map, start, end);
      if (!range) continue;
      placed.push({ id: item.id, start, end, ...range });
      break;
    }
  }
  return placed.sort((a, b) => a.start - b.start);
}
