import type { Decision, Meeting } from "./domain";

/** 결정의 이유 한 칸의 글자 한도 */
export const REASON_MAX = 500;

export interface DecisionEntry {
  decision: Decision;
  /** 결정을 내린 미팅. 지워졌거나 볼 수 없으면 없습니다. */
  meeting?: Pick<Meeting, "id" | "title" | "date">;
  /** 이 결정이 바꾼 이전 결정 */
  replaces?: Decision;
  /** 이 결정을 나중에 바꾼 결정. 있으면 지금은 유효하지 않습니다. */
  replacedBy?: Decision;
}

type MeetingRef = Pick<Meeting, "id" | "title" | "date">;

function decidedAt(decision: Decision, meeting?: MeetingRef): string {
  return meeting?.date ?? decision.createdAt.slice(0, 10);
}

/**
 * 한 연구의 결정을 최근 것부터 늘어놓고, 어느 결정이 어느 결정을 바꿨는지 이어 줍니다.
 * 보관한 결정은 빼지만, 보관한 결정이 가리키던 연결은 남은 결정끼리만 잇습니다.
 */
export function decisionLog(
  decisions: Decision[],
  meetings: MeetingRef[],
  researchId: string,
): DecisionEntry[] {
  const active = decisions.filter(
    (item) => item.researchId === researchId && !item.archivedAt,
  );
  const byId = new Map(active.map((item) => [item.id, item]));
  const meetingById = new Map(meetings.map((item) => [item.id, item]));
  const replacedBy = new Map<string, Decision>();
  for (const item of active)
    if (item.replacesId && byId.has(item.replacesId))
      replacedBy.set(item.replacesId, item);
  return active
    .map((decision) => ({
      decision,
      meeting: meetingById.get(decision.meetingId),
      replaces: decision.replacesId ? byId.get(decision.replacesId) : undefined,
      replacedBy: replacedBy.get(decision.id),
    }))
    .sort((a, b) => {
      const byDate = decidedAt(b.decision, b.meeting).localeCompare(
        decidedAt(a.decision, a.meeting),
      );
      return byDate || b.decision.createdAt.localeCompare(a.decision.createdAt);
    });
}

/**
 * '이전 결정을 바꿈'에서 고를 수 있는 결정: 아직 다른 결정으로 바뀌지 않았고
 * 지금 고치는 결정 자신이 아닌 것. 지금 고치는 결정이 이미 가리키는 것은 남겨 둡니다.
 */
export function replaceableDecisions(
  entries: DecisionEntry[],
  editing?: Pick<Decision, "id" | "replacesId">,
): Decision[] {
  return entries
    .filter(
      (entry) =>
        entry.decision.id !== editing?.id &&
        (!entry.replacedBy || entry.replacedBy.id === editing?.id),
    )
    .map((entry) => entry.decision);
}
