/**
 * 키보드로 읽기(IA v2 04 §5.1): 커서가 없는 원문(전사문)은 문장 단위로 고릅니다.
 * ↑/↓로 문장을 옮기고 Shift+↑/↓로 범위를 넓힙니다. 글자 위치는 원문(수정문) 기준 [start, end)입니다.
 */
export interface TextRange {
  start: number;
  end: number;
}

/** 키보드로 고른 문장 번호. anchor는 처음 고른 문장, focus는 움직이는 끝이에요. */
export interface SentencePick {
  anchor: number;
  focus: number;
}

const END = /[.?!…。？！]/;
const CLOSE = /[.?!…。？！"'”’)\]」』]/;

/**
 * 문장 끝 부호(. ? ! … 。) 뒤에 빈칸·줄바꿈·글 끝이 오거나 줄이 바뀌면 문장을 나눕니다.
 * "3.5"처럼 부호 뒤에 바로 글자가 오면 나누지 않아요. 앞뒤 빈칸은 범위에 넣지 않습니다.
 */
export function sentenceRanges(text: string): TextRange[] {
  const out: TextRange[] = [];
  let start = -1;
  const push = (end: number) => {
    let last = end;
    while (last > start && /\s/.test(text[last - 1])) last--;
    if (start >= 0 && last > start) out.push({ start, end: last });
    start = -1;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (start < 0) {
      if (/\s/.test(ch)) continue;
      start = i;
    }
    if (ch === "\n") {
      push(i);
      continue;
    }
    if (END.test(ch)) {
      let j = i + 1;
      while (j < text.length && CLOSE.test(text[j])) j++;
      if (j >= text.length || /\s/.test(text[j])) {
        push(j);
        i = j - 1;
      }
    }
  }
  if (start >= 0) push(text.length);
  return out;
}

/** offset이 든 문장 번호. 문장 사이 빈칸이면 바로 뒤 문장, 글 끝 뒤면 마지막 문장 */
export function sentenceAt(ranges: TextRange[], offset: number): number {
  const index = ranges.findIndex((range) => offset < range.end);
  return index < 0 ? ranges.length - 1 : index;
}

/**
 * 한 문장 옮기거나(extend면 범위를 넓히거나 좁혀) 새로 고른 문장 번호.
 * 아직 고른 문장이 없으면 ↓는 첫 문장, ↑는 마지막 문장을 고릅니다.
 */
export function stepSentence(
  pick: SentencePick | null,
  count: number,
  dir: 1 | -1,
  extend: boolean,
): SentencePick | null {
  if (!count) return null;
  if (!pick) {
    const index = dir === 1 ? 0 : count - 1;
    return { anchor: index, focus: index };
  }
  const focus = Math.min(count - 1, Math.max(0, pick.focus + dir));
  return extend ? { anchor: pick.anchor, focus } : { anchor: focus, focus };
}

/** 고른 문장들이 덮는 글자 범위 */
export function pickRange(ranges: TextRange[], pick: SentencePick): TextRange {
  const first = Math.min(pick.anchor, pick.focus),
    last = Math.max(pick.anchor, pick.focus);
  return { start: ranges[first].start, end: ranges[last].end };
}
