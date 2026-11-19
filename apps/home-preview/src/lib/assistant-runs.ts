import type { AIConversation, SavedAICandidate } from "@/lib/domain";
import { t } from "@/lib/i18n";
import { formatCredits, runCreditUsage, type AICredits } from "@/lib/ai-usage";

/** 실행 내역의 한 줄을 누르면 갈 곳(IA v2 06 §2.8) */
export type RunTarget =
  { kind: "message"; conversationId: string } | { kind: "suggestions" };

/**
 * 실행 내역 줄의 갈 곳: 그 실행의 답이 남은 대화가 먼저이고, 없으면 아직 고르지 않은 그 실행의 제안입니다.
 * 둘 다 없으면 누를 수 없습니다(실행 기록에는 대화·기록 연결이 따로 없어서 `runId`로만 찾음).
 */
export function runTarget(
  runId: string,
  conversations: Pick<AIConversation, "id" | "messages">[],
  pending: Pick<SavedAICandidate, "runId">[],
): RunTarget | null {
  if (!runId) return null;
  const conversation = conversations.find((c) =>
    c.messages.some((m) => m.role === "assistant" && m.runId === runId),
  );
  if (conversation) return { kind: "message", conversationId: conversation.id };
  if (pending.some((c) => c.runId === runId)) return { kind: "suggestions" };
  return null;
}

/**
 * 실행 내역 줄의 쓴 크레딧(06 §2.8). 정산된 크레딧 이력(최근 50건)에 그 실행이 있을 때만 글자를 만들고,
 * 없으면(정산 전, 오래된 실행, 미리보기·서버 미연결) 비웁니다. 예약은 실제 사용이 아니라 세지 않습니다.
 */
export function runCreditsLabel(
  credits: AICredits | undefined,
  runId: string,
): string | undefined {
  const used = runCreditUsage(credits, runId);
  return used === undefined
    ? undefined
    : t("{credits}크레딧", { credits: formatCredits(used) });
}
