import type { AIConversation, SavedAICandidate } from "@/lib/domain";

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
