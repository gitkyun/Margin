/**
 * 검토 댓글 본문 다루기: 페이지 표기 찾기, 첫 줄 요약.
 * 화면 코드와 떼어 두어 단위 테스트로 확인합니다.
 */

export type CommentSegment =
  { kind: "text"; text: string } | { kind: "page"; text: string; page: number };

/** 너무 큰 숫자(연도·쪽수 범위 밖)는 페이지로 보지 않아요. */
const MAX_PAGE = 9999;

// p.4 · p. 4 · P.12 · 4쪽 · 4 쪽 · 4페이지 · 4 페이지
// 앞뒤가 글자·숫자에 붙은 경우(예: ‘step.4’, ‘14쪽’ 안의 ‘4쪽’)는 고르지 않아요.
const PAGE_PATTERN =
  /(?<![\p{L}\p{N}])(?:[pP]\.\s?(\d{1,4})(?!\d)|(\d{1,4})\s?(?:쪽|페이지))/gu;

/** 댓글 본문을 글자 조각과 페이지 표기 조각으로 나눠요. 페이지 표기가 없으면 조각 하나. */
export function splitPageReferences(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(PAGE_PATTERN)) {
    const page = Number(match[1] ?? match[2]);
    if (!page || page > MAX_PAGE) continue;
    const start = match.index ?? 0;
    if (start > last)
      segments.push({ kind: "text", text: body.slice(last, start) });
    segments.push({ kind: "page", text: match[0], page });
    last = start + match[0].length;
  }
  if (last < body.length)
    segments.push({ kind: "text", text: body.slice(last) });
  return segments.length ? segments : [{ kind: "text", text: body }];
}

/** 접힌 머리에 보여 줄 첫 줄. 공백만 있는 줄은 건너뛰고 길면 줄여요. */
export function firstLine(body: string, max = 40): string {
  const line =
    body
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
