import type { AIContext } from "@/lib/domain";

/**
 * 사이드 창의 연구 도우미에서 전체 화면(`/r/:id/assistant`)으로 넘길 때 함께 보내는 값(IA v2 02 §4.1).
 * 질문 글은 주소에 남기지 않으려고 history state로만 넘깁니다.
 */
export interface AssistantHandoff {
  /** 바로 보낼 질문 */
  ask?: string;
  /** 이어서 볼 대화 */
  conversationId?: string;
  /** 사이드 창에 놓여 있던 '지금 보는 기록' 칩(IA v2 06 §2.2) */
  contexts?: AIContext[];
}

/** 칩으로 넘길 수 있는 종류(서버가 근거로 받는 것 가운데 화면이 칩으로 만드는 것) */
const CONTEXT_KINDS = new Set(["meetings", "documents", "feedback", "tasks"]);

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
  const { ask, conversationId, contexts } = raw as Record<string, unknown>;
  const result: AssistantHandoff = {};
  if (typeof ask === "string" && ask.trim()) result.ask = ask.trim();
  if (typeof conversationId === "string" && conversationId)
    result.conversationId = conversationId;
  if (Array.isArray(contexts)) {
    const valid = contexts
      .filter(
        (c): c is AIContext =>
          !!c &&
          typeof c === "object" &&
          CONTEXT_KINDS.has((c as AIContext).kind) &&
          typeof (c as AIContext).id === "string" &&
          typeof (c as AIContext).title === "string" &&
          ((c as AIContext).revision === undefined ||
            Number.isInteger((c as AIContext).revision)),
      )
      .slice(0, 1)
      .map(({ kind, id, title, revision }) => ({
        kind,
        id,
        title,
        ...(revision === undefined ? {} : { revision }),
      }));
    if (valid.length) result.contexts = valid;
  }
  return result.ask || result.conversationId || result.contexts ? result : null;
}
