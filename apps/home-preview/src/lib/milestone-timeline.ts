import type { Milestone } from "./domain";

const DAY_MS = 86_400_000;

/** 오늘을 기준으로 본 목표의 자리. 날짜가 없으면 undated. */
export type MilestoneWhen = "past" | "today" | "upcoming" | "undated";

export interface MilestoneTimelineItem<T> {
  milestone: T;
  when: MilestoneWhen;
  /** 오늘에서 목표일까지 남은 날(지났으면 음수). 날짜가 없으면 null */
  days: number | null;
  /** 날짜가 지났는데 아직 끝내지 않은 목표 */
  overdue: boolean;
}

type TimelineInput = Pick<Milestone, "dueDate" | "status">;

/**
 * 주요 목표를 세로 타임라인 순서(날짜 순, 날짜 없는 것은 끝)로 놓고
 * 지난 것·오늘·다가올 것으로 나눕니다. 완료 여부(status)는 날짜와 따로 둡니다.
 */
export function milestoneTimeline<T extends TimelineInput>(
  milestones: readonly T[],
  today: string,
): MilestoneTimelineItem<T>[] {
  const origin = Date.parse(`${today}T00:00:00Z`);
  return milestones
    .map((milestone, index) => {
      const due = milestone.dueDate
        ? Date.parse(`${milestone.dueDate.slice(0, 10)}T00:00:00Z`)
        : NaN;
      const days = Number.isFinite(due)
        ? Math.round((due - origin) / DAY_MS)
        : null;
      const when: MilestoneWhen =
        days === null
          ? "undated"
          : days < 0
            ? "past"
            : days === 0
              ? "today"
              : "upcoming";
      return {
        index,
        item: {
          milestone,
          when,
          days,
          overdue: when === "past" && milestone.status !== "done",
        },
      };
    })
    .sort(
      (a, b) =>
        (a.item.days ?? Infinity) - (b.item.days ?? Infinity) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

/**
 * ‘오늘’ 선을 넣을 자리: 오늘 이후(오늘 포함) 첫 항목의 번호.
 * 모두 지났으면 날짜 있는 항목 끝, 날짜 있는 항목이 없으면 -1.
 */
export function todayLineIndex(
  items: readonly Pick<MilestoneTimelineItem<unknown>, "when">[],
): number {
  const dated = items.filter((item) => item.when !== "undated").length;
  if (!dated) return -1;
  const next = items.findIndex(
    (item) => item.when === "today" || item.when === "upcoming",
  );
  return next === -1 ? dated : next;
}
