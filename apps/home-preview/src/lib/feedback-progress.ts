import {
  feedbackLabels,
  type Feedback,
  type ReviewItem,
  type ReviewResponse,
  type ReviewRound,
  type RevisionPlan,
  type RevisionResult,
  type Task,
} from "./domain";
import { t } from "@/lib/i18n";

export type ProgressKey = "feedback" | "plans" | "tasks" | "results" | "review";

export interface ProgressStep {
  key: ProgressKey;
  label: string;
  /** 이 칸 자신의 상태. 다른 칸의 상태와 합치지 않습니다. */
  value: string;
  /** 이 칸에 기록이 있는지. 전체 완료율을 뜻하지 않습니다. */
  filled: boolean;
}

export interface FeedbackProgressInput {
  feedback: Feedback;
  /** 이 피드백의 수정 방법 */
  plans: RevisionPlan[];
  /** 이 피드백에 연결한 할 일 */
  tasks: Task[];
  /** 이 피드백의 수정 결과 */
  results: RevisionResult[];
  reviewItems: ReviewItem[];
  rounds: ReviewRound[];
  responses: ReviewResponse[];
}

const NONE = t("아직 없음");

/** 수정 결과 가운데 가장 최근 차수의 교수 응답 상태 */
function reviewStep(input: FeedbackProgressInput): ProgressStep {
  const resultIds = new Set(input.results.map((result) => result.id));
  const itemIds = new Set(
    input.reviewItems
      .filter((item) => resultIds.has(item.resultId))
      .map((item) => item.id),
  );
  const rounds = input.rounds.filter((round) => itemIds.has(round.itemId));
  const step = (value: string, filled: boolean): ProgressStep => ({
    key: "review",
    label: t("교수 확인"),
    value,
    filled,
  });
  if (!itemIds.size) return step(t("요청 전"), false);
  // 검토 항목마다 최신 차수의 응답을 봅니다.
  const latestResponses = [...itemIds].map((itemId) => {
    const latest = rounds
      .filter((round) => round.itemId === itemId)
      .sort((a, b) => b.number - a.number)[0];
    if (!latest) return undefined;
    return input.responses
      .filter((response) => response.roundId === latest.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  });
  if (latestResponses.some((response) => !response))
    return step(t("응답 기다리는 중"), false);
  if (
    latestResponses.some((response) => response?.result === "changes_requested")
  )
    return step(t("추가 수정 필요"), true);
  return step(t("수정 내용 확인"), true);
}

/**
 * 피드백 상세의 진행 줄. 받은 피드백 → 수정 방법 → 할 일 → 수정 결과 → 교수 확인.
 * 칸마다 자기 상태만 보여 주고 전체 완료율은 만들지 않습니다
 * (작업 완료·학생 반영 기록·교수 결과를 합치지 않는다는 제품 조건).
 */
export function feedbackProgress(input: FeedbackProgressInput): ProgressStep[] {
  const plans = input.plans.filter((plan) => plan.status !== "cancelled");
  const done = input.tasks.filter((task) => task.status === "done").length;
  return [
    {
      key: "feedback",
      label: t("받은 피드백"),
      value: feedbackLabels[input.feedback.status],
      filled: true,
    },
    {
      key: "plans",
      label: t("수정 방법"),
      value: plans.length ? t("{count}개", { count: plans.length }) : NONE,
      filled: plans.length > 0,
    },
    {
      key: "tasks",
      label: t("할 일"),
      value: input.tasks.length
        ? t("완료 {done} / {total}", { done, total: input.tasks.length })
        : NONE,
      filled: input.tasks.length > 0,
    },
    {
      key: "results",
      label: t("수정 결과"),
      value: input.results.length
        ? t("{count}건", { count: input.results.length })
        : NONE,
      filled: input.results.length > 0,
    },
    reviewStep(input),
  ];
}
