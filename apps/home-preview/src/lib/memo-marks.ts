import type { TextMark } from "./domain";
import { textHash, validMarks } from "./recording-marks";

/**
 * 메모 형광펜의 자리 옮기기(IA v2 08 §3.1). 메모는 자주 저장되므로 앞부분을 고치면 뒤 표시가 어긋납니다.
 * 저장할 때 옛 메모에서 맞던 표시의 글자를 새 메모에서 찾아(원래 자리에서 가장 가까운 곳) 옮기고,
 * 찾지 못한 표시는 그리지 않은 채 남겨 둡니다(지우지 않음).
 */
export function relocateMarks(
  marks: readonly TextMark[] | undefined,
  before: string,
  after: string,
): TextMark[] {
  if (!marks?.length) return [];
  if (before === after) return [...marks];
  const valid = new Set(validMarks(marks, before));
  return marks.map((mark) => {
    if (!valid.has(mark)) return mark;
    const snippet = before.slice(mark.start, mark.end);
    if (after.slice(mark.start, mark.end) === snippet) return mark;
    let best = -1;
    for (
      let at = after.indexOf(snippet);
      at !== -1;
      at = after.indexOf(snippet, at + 1)
    ) {
      if (
        best === -1 ||
        Math.abs(at - mark.start) < Math.abs(best - mark.start)
      )
        best = at;
    }
    if (best === -1) return mark;
    return {
      start: best,
      end: best + snippet.length,
      hash: textHash(snippet),
    };
  });
}
