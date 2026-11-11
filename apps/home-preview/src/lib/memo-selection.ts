/** 메모에서 고른 문장으로 만든 제목의 최대 글자 수 */
export const TITLE_FROM_MEMO_MAX = 40;

/** 줄 앞의 목록 기호(-, *, •, 숫자.)와 📌 같은 표시를 뺍니다. */
const LEADING_MARKER = /^(?:[-*•·]|\d+[.)])?\s*(?:📌\s*)?/u;

export interface EntryDraft {
  title: string;
  body: string;
}

/**
 * 미팅 메모에서 고른 문장으로 피드백·결정·질문의 초안을 만듭니다.
 * 내용은 고른 문장 그대로(앞뒤 공백만 정리), 제목은 첫 줄을 짧게 씁니다.
 * 고른 문장이 없으면 null을 돌려줘 빈 칸으로 엽니다.
 */
export function entryFromSelection(selected: string): EntryDraft | null {
  const body = selected.trim();
  if (!body) return null;
  const firstLine = body.split(/\r?\n/)[0].replace(LEADING_MARKER, "").trim();
  const title =
    firstLine.length > TITLE_FROM_MEMO_MAX
      ? `${firstLine.slice(0, TITLE_FROM_MEMO_MAX)}…`
      : firstLine;
  return { title, body };
}
