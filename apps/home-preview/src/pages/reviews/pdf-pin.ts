/** 댓글 맨 앞에 붙는 PDF 위치 표시. 예: `[p.3 @ 42%,18%] 이 표를 고쳐 주세요` */
const PIN_TAG = /\[p\.(\d+)\s*@\s*(\d+)%,(\d+)%\]/;

export interface ParsedPin {
  page: number;
  x: number;
  y: number;
  /** 표시를 뺀 댓글 글 */
  text: string;
}

export function parsePin(body: string): ParsedPin | null {
  const match = body.match(PIN_TAG);
  if (!match) return null;
  return {
    page: Number(match[1]),
    x: Number(match[2]),
    y: Number(match[3]),
    text: body.replace(match[0], "").trim(),
  };
}

/** 댓글 순서대로 PDF 전체에 걸쳐 1, 2, 3… 번호를 줘요. 지운 댓글은 건너뛰어요. */
export function numberPins(
  comments: ReadonlyArray<{ id: string; body: string; deletedAt?: string }>,
): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const comment of comments) {
    if (comment.deletedAt || !parsePin(comment.body)) continue;
    numbers.set(comment.id, numbers.size + 1);
  }
  return numbers;
}
