import type {
  AICandidate,
  BaseRecord,
  Feedback,
  RevisionPlan,
  Task,
} from "@/lib/domain";

/**
 * 항목 상세의 수정 방법(IA v2 06 §6.2). 직접 쓰기·AI 제안 고쳐 쓰기·제안 고르기가 같은 모양의 방법을 만들고,
 * 방법에서 [할 일 추가]는 제안된 할 일을 미리 채운 할 일을 그 피드백과 방법에 이어 만듭니다.
 * 선택은 완료가 아닙니다(상태는 사람이 바꿈).
 */

/** [직접 쓰기]: 빈 방법 */
export function emptyPlan(base: BaseRecord, feedbackId: string): RevisionPlan {
  return {
    ...base,
    origin: "manual",
    feedbackId,
    title: "",
    method: "",
    expectedResult: "",
    assumptions: "",
    requiredMaterials: "",
    suggestedTasks: [],
    status: "saved",
  };
}

/**
 * AI 제안 카드에서 고르거나 고쳐 쓸 방법. 원문 인용은 그 피드백 본문(또는 저장된 원문 인용)에 실제로 있을 때만 남깁니다.
 */
export function planFromCandidate(
  candidate: AICandidate,
  base: BaseRecord,
  feedback: Pick<Feedback, "id" | "body" | "sourceQuote">,
): RevisionPlan {
  const quote = candidate.sourceQuote;
  const quoteInSource =
    !!quote &&
    (feedback.body.includes(quote) || feedback.sourceQuote === quote);
  return {
    ...base,
    origin: "ai",
    feedbackId: feedback.id,
    title: candidate.title.trim(),
    method: candidate.method ?? candidate.body ?? "",
    expectedResult: candidate.expectedResult ?? "",
    assumptions: candidate.assumptions ?? "",
    requiredMaterials: candidate.requiredMaterials ?? "",
    suggestedTasks: candidate.suggestedTasks ?? [],
    status: "saved",
    ...(quoteInSource ? { sourceQuote: quote } : {}),
  };
}

/** 방법에서 [할 일 추가]: 제안된 첫 할 일(없으면 방법 제목)을 제목으로, 방법 내용을 설명으로 */
export function taskFromPlan(plan: RevisionPlan, base: BaseRecord): Task {
  return {
    ...base,
    origin: plan.origin ?? "manual",
    title: (plan.suggestedTasks[0]?.trim() || plan.title).slice(0, 200),
    description: plan.method,
    status: "todo",
    dueDate: null,
    priority: "normal",
    visibility: "private",
    feedbackIds: [plan.feedbackId],
    planId: plan.id,
  } as Task;
}
