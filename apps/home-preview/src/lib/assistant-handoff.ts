/**
 * 사이드 창의 연구 도우미에서 전체 화면(`/r/:id/assistant`)으로 넘길 때 함께 보내는 값(IA v2 02 §4.1).
 * 질문 글은 주소에 남기지 않으려고 history state로만 넘깁니다.
 */
export interface AssistantHandoff {
  /** 바로 보낼 질문 */
  ask?: string;
  /** 이어서 볼 대화 */
  conversationId?: string;
}

const KEY = "assistantHandoff";

export function handoffState(
  handoff: AssistantHandoff,
): Record<string, AssistantHandoff> {
  return { [KEY]: handoff };
}

/** history state에서 넘겨받은 값을 꺼냅니다. 모양이 틀리면 버립니다. */
export function readHandoff(state: unknown): AssistantHandoff | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as Record<string, unknown>)[KEY];
  if (!raw || typeof raw !== "object") return null;
  const { ask, conversationId } = raw as Record<string, unknown>;
  const result: AssistantHandoff = {};
  if (typeof ask === "string" && ask.trim()) result.ask = ask.trim();
  if (typeof conversationId === "string" && conversationId)
    result.conversationId = conversationId;
  return result.ask || result.conversationId ? result : null;
}
