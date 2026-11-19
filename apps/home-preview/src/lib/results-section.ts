import type { ReviewItem, ReviewRequest, RevisionResult } from "@/lib/domain";

/** 미팅 목록 `type=review`의 수정 결과 구획 보기(IA v2 04 §2.4). 기본은 '요청 전'. */
export type ResultView = "pending" | "requested" | "archived";
export const RESULT_VIEWS: readonly ResultView[] = [
  "pending",
  "requested",
  "archived",
];

export function parseResultView(value: string | null): ResultView {
  return RESULT_VIEWS.includes(value as ResultView)
    ? (value as ResultView)
    : "pending";
}

function viewOf(result: RevisionResult, requested: Set<string>): ResultView {
  if (result.archivedAt) return "archived";
  return requested.has(result.id) ? "requested" : "pending";
}

/**
 * 이 연구의 수정 결과를 보기별로 나눕니다. 검토 요청에 담긴 적이 있으면 '요청에 포함', 아니면 '요청 전',
 * 보관했으면 '보관함'. 찾기는 제목과 수정한 내용에서 하고, 최근 고친 순입니다.
 */
export function resultRows(
  results: RevisionResult[],
  reviewItems: Pick<ReviewItem, "resultId">[],
  researchId: string,
  view: ResultView,
  query = "",
  matches: (text: string, query: string) => boolean = (text, q) =>
    text.toLowerCase().includes(q.toLowerCase()),
): RevisionResult[] {
  const requested = new Set(reviewItems.map((item) => item.resultId));
  return results
    .filter(
      (result) =>
        result.researchId === researchId &&
        viewOf(result, requested) === view &&
        (!query.trim() ||
          matches(`${result.title} ${result.description}`, query.trim())),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 보기마다의 수(찾기와 상관없이) */
export function resultCounts(
  results: RevisionResult[],
  reviewItems: Pick<ReviewItem, "resultId">[],
  researchId: string,
): Record<ResultView, number> {
  const requested = new Set(reviewItems.map((item) => item.resultId));
  const counts: Record<ResultView, number> = {
    pending: 0,
    requested: 0,
    archived: 0,
  };
  for (const result of results)
    if (result.researchId === researchId)
      counts[viewOf(result, requested)] += 1;
  return counts;
}

/** 검토 요청 줄의 보조 필터(04 §2.4): 전체 | 공유 중 | 공유 중지 */
export type ReviewShare = "all" | "shared" | "stopped";
export function parseReviewShare(value: string | null): ReviewShare {
  return value === "shared" || value === "stopped" ? value : "all";
}
export function reviewMatchesShare(
  review: Pick<ReviewRequest, "status">,
  share: ReviewShare,
): boolean {
  return share === "all" || review.status === share;
}
