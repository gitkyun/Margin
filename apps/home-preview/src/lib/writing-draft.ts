export interface WritingDraft {
  title: string | null;
  content: Record<string, unknown>;
  baseUpdatedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 이 브라우저에 남은 문서 작성본을 읽는다. 저장본과 같거나 형식이 맞지 않으면 null.
 * 편집기를 만들기 전에 호출해 초기 내용으로 넘긴다. 편집기 생성 뒤 setContent로
 * 덮어쓰면 화면이 붙기 전에 실패할 수 있기 때문이다.
 */
export function restoreWritingDraft(
  raw: string | null,
  savedContent: unknown,
  savedTitle?: string,
): WritingDraft | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !isRecord(value.content)) return null;
  if (
    JSON.stringify(value.content) === JSON.stringify(savedContent) &&
    (savedTitle === undefined ||
      typeof value.title !== "string" ||
      value.title === savedTitle)
  )
    return null;
  return {
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title
        : null,
    content: value.content,
    baseUpdatedAt:
      typeof value.baseUpdatedAt === "string" ? value.baseUpdatedAt : null,
  };
}
