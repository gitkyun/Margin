import type { AIContext, WorkspaceData } from "@/lib/domain";

/** 서버(ai-assist)가 근거의 판·고른 글이 바뀌었을 때 돌려주는 오류 코드(IA v2 06 §2.2, 09 A7) */
export const SOURCE_CHANGED = "SOURCE_CHANGED";

/** 연구 도우미 서버 오류. 화면이 오류 종류에 따라 다르게 안내하도록 코드를 함께 둡니다. */
export class AIRequestError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "AIRequestError";
    this.code = code;
  }
}

export const isSourceChanged = (error: unknown): boolean =>
  error instanceof AIRequestError && error.code === SOURCE_CHANGED;

/**
 * [다시 보내기]: 보낸 근거 칩을 지금 기록의 최신 판으로 바꿉니다.
 * 미팅·글은 서버가 판 번호를 비교하므로 판을 올리고, 고른 글(`text`)이 있으면 최신 본문에 그대로 남아 있을 때만 씁니다.
 * 기록이 없어졌거나(보관 포함) 고른 글이 사라진 칩은 `missing`으로 돌려주어 사람이 다시 고르게 합니다.
 * 판을 비교하지 않는 종류(파일·자료 쪽·단계 등)는 그대로 둡니다.
 */
export function refreshSourceContexts(
  contexts: AIContext[],
  data: Pick<WorkspaceData, "meetings" | "documents" | "feedback" | "tasks">,
  researchId: string,
): { contexts: AIContext[]; missing: AIContext[] } {
  const out: AIContext[] = [];
  const missing: AIContext[] = [];
  const live = <
    T extends { id: string; researchId: string; archivedAt?: string },
  >(
    items: T[],
    id: string,
  ) =>
    items.find(
      (item) =>
        item.id === id && item.researchId === researchId && !item.archivedAt,
    );
  const keeps = (body: string, c: AIContext) =>
    !c.text || body.includes(c.text);
  for (const c of contexts) {
    if (c.kind === "meetings") {
      const meeting = live(data.meetings, c.id);
      if (meeting && keeps(meeting.memo, c))
        out.push({ ...c, revision: meeting.memoRevision });
      else missing.push(c);
    } else if (c.kind === "documents") {
      const doc = live(data.documents, c.id);
      if (doc && keeps(doc.text, c)) out.push({ ...c, revision: doc.revision });
      else missing.push(c);
    } else if (c.kind === "feedback") {
      const item = live(data.feedback, c.id);
      if (item && keeps(item.body, c)) out.push(c);
      else missing.push(c);
    } else if (c.kind === "tasks") {
      const item = live(data.tasks, c.id);
      if (item && keeps(`${item.title}\n${item.description}`, c)) out.push(c);
      else missing.push(c);
    } else out.push(c);
  }
  return { contexts: out, missing };
}
