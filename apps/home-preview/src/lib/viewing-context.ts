import type { AIContext, WorkspaceData } from "@/lib/domain";

/**
 * '지금 보는 기록'(IA v2 06 §2.2): 연 화면의 대상을 연구 도우미 근거 칩 하나로 만듭니다.
 * 항목 상세(`?detail=`)가 열려 있으면 그것이 먼저이고, 아니면 화면 주소의 대상입니다.
 * 서버가 근거로 받는 종류만 칩이 됩니다. 결정·질문·수정 결과 상세와 자료(PDF·링크)는 아직 칩을 만들지 않습니다
 * (PDF는 쪽과 글자를 함께 보내야 해서 자료 창 단계에서 붙입니다).
 * 미팅·글은 서버가 같은 판인지 확인하므로 판 번호를 함께 넣습니다.
 */
export function viewingContext(
  pathname: string,
  search: string,
  data: Pick<WorkspaceData, "meetings" | "documents" | "feedback" | "tasks">,
  researchId: string,
): AIContext | null {
  const detail = new URLSearchParams(search).get("detail");
  if (detail) {
    const [kind, id] = detail.split(":");
    if (kind === "feedback") {
      const item = data.feedback.find(
        (f) => f.id === id && f.researchId === researchId && !f.archivedAt,
      );
      return item ? { kind: "feedback", id: item.id, title: item.title } : null;
    }
    if (kind === "task") {
      const item = data.tasks.find(
        (x) => x.id === id && x.researchId === researchId && !x.archivedAt,
      );
      return item ? { kind: "tasks", id: item.id, title: item.title } : null;
    }
    return null;
  }
  const base = `/r/${researchId}/`;
  if (!pathname.startsWith(base)) return null;
  const [section, sub, id] = pathname.slice(base.length).split("/");
  if (section === "meetings" && sub) {
    const meeting = data.meetings.find(
      (m) => m.id === sub && m.researchId === researchId && !m.archivedAt,
    );
    return meeting
      ? {
          kind: "meetings",
          id: meeting.id,
          title: meeting.title,
          revision: meeting.memoRevision,
        }
      : null;
  }
  if (section === "docs" && sub === "w" && id) {
    const doc = data.documents.find(
      (d) => d.id === id && d.researchId === researchId && !d.archivedAt,
    );
    return doc
      ? {
          kind: "documents",
          id: doc.id,
          title: doc.title,
          revision: doc.revision,
        }
      : null;
  }
  return null;
}

/** 같은 대상인지 비교할 때 쓰는 열쇠 */
export const contextKey = (c: Pick<AIContext, "kind" | "id">) =>
  `${c.kind}:${c.id}`;
