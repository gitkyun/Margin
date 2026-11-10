import type { DocumentRecord, Research } from "./domain";

/** 연구 목적 한 칸의 글자 한도. 한두 문장을 적는 자리입니다. */
export const PURPOSE_MAX = 300;
/** 연구 질문 수 한도. 넘는 줄은 버리지 않고 화면에서 막습니다. */
export const QUESTIONS_MAX = 5;
const QUESTION_MAX = 200;

/**
 * 여러 줄 글을 연구 질문 목록으로 바꿉니다. 한 줄에 하나이고,
 * 줄 앞의 번호·글머리("1.", "-", "RQ1:")는 떼어 냅니다.
 */
export function parseQuestions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*•·]|\d+[.)]|RQ\s*\d*\s*[:.)]?)\s*/i, "")
        .slice(0, QUESTION_MAX)
        .trim(),
    )
    .filter(Boolean)
    .slice(0, QUESTIONS_MAX);
}

export function questionsText(questions: string[] | undefined): string {
  return (questions ?? []).join("\n");
}

export function hasDirection(
  research: Pick<Research, "purpose" | "questions">,
): boolean {
  return !!research.purpose?.trim() || !!research.questions?.length;
}

/**
 * 이 연구의 계획서에서 연구 목적으로 가져올 첫 문단.
 * 가장 최근에 고친 계획서의 첫 번째 비어 있지 않은 문단을 한도까지 자릅니다.
 * 계획서가 없거나 비어 있으면 null입니다.
 */
export function planExcerpt(
  documents: Pick<
    DocumentRecord,
    "researchId" | "type" | "text" | "updatedAt" | "archivedAt"
  >[],
  researchId: string,
): string | null {
  const plan = documents
    .filter(
      (doc) =>
        doc.researchId === researchId &&
        doc.type === "plan" &&
        !doc.archivedAt &&
        doc.text.trim(),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!plan) return null;
  const paragraph = plan.text
    .split(/\n+/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!paragraph) return null;
  return paragraph.length > PURPOSE_MAX
    ? `${paragraph.slice(0, PURPOSE_MAX - 1).trimEnd()}…`
    : paragraph;
}
