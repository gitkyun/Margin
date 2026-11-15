import { recordBase, type BaseRecord, type ResearchPhase } from "./domain";
import {
  ROADMAP_MAX_INPUT_STAGES,
  type ProposedStage,
  type RoadmapPlan,
} from "../../supabase/functions/ai-assist/roadmap";

export {
  isDateKey,
  stageDateProblem,
  submissionDateProblem,
  type ProposedStage,
  type RoadmapPlan,
  type RoadmapProposal,
  type StageDateProblem,
} from "../../supabase/functions/ai-assist/roadmap";

const DAY_MS = 86400000;

/** 이 기기 시간대의 오늘(YYYY-MM-DD) */
export function todayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * AI에 보낼 계획 입력. 끝나지 않은 단계는 이름·상태·목표일을, 끝난 단계는 이름만 보냅니다.
 * `sent[i]`가 제안의 sourceIndex `i + 1`에 해당합니다.
 */
export function buildRoadmapPlan(
  phases: ResearchPhase[],
  submissionDate: string,
  today: string,
): { plan: RoadmapPlan; sent: ResearchPhase[] } {
  const sent = phases
    .filter((p) => p.status !== "done")
    .slice(0, ROADMAP_MAX_INPUT_STAGES);
  return {
    sent,
    plan: {
      today,
      submissionDate,
      stages: sent.map((p, i) => ({
        index: i + 1,
        title: p.title,
        status: p.status === "active" ? "active" : "planned",
        ...(p.dueDate ? { dueDate: p.dueDate } : {}),
      })),
      completedStages: phases
        .filter((p) => p.status === "done")
        .slice(0, ROADMAP_MAX_INPUT_STAGES)
        .map((p) => p.title),
    },
  };
}

/**
 * 제안을 적용할 때 저장할 단계 목록(바뀐 것과 새 것만).
 * 제안에 든 기존 단계는 이름·시작일·목표일을 바꾸고, 새 단계는 '예정'으로 만듭니다.
 * 제안에 없는 단계는 그대로 두고 앞 순서에, 제안 단계는 그 뒤에 시작일 순으로 놓습니다.
 */
export function planPhaseChanges(
  phases: ResearchPhase[],
  sent: ResearchPhase[],
  stages: ProposedStage[],
  researchId: string,
  create: (researchId: string) => BaseRecord = recordBase,
): ResearchPhase[] {
  const targets = stages.map((stage) =>
    stage.sourceIndex > 0 ? sent[stage.sourceIndex - 1] : undefined,
  );
  const targetIds = new Set(targets.flatMap((p) => (p ? [p.id] : [])));
  const untouched = phases.filter((p) => !targetIds.has(p.id));
  const reordered = untouched.flatMap((p, order) =>
    p.order === order ? [] : [{ ...p, order }],
  );
  const proposed = stages.map((stage, i): ResearchPhase => {
    const order = untouched.length + i;
    const dates = { startDate: stage.startDate, dueDate: stage.endDate };
    const existing = targets[i];
    return existing
      ? { ...existing, title: stage.title.trim(), order, ...dates }
      : {
          ...create(researchId),
          title: stage.title.trim(),
          order,
          status: "planned",
          dependsOn: [],
          visibility: "shared",
          ...dates,
        };
  });
  return [
    ...reordered,
    ...proposed.filter((next, i) => {
      const before = targets[i];
      return (
        !before ||
        before.title !== next.title ||
        before.order !== next.order ||
        (before.startDate ?? null) !== next.startDate ||
        before.dueDate !== next.dueDate
      );
    }),
  ];
}

export interface TimelineMonth {
  /** YYYY-MM */
  key: string;
  year: number;
  /** 1~12 */
  month: number;
  days: number;
}

/** start가 든 달부터 end가 든 달까지 */
export function timelineMonths(start: string, end: string): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  let year = Number(start.slice(0, 4)),
    month = Number(start.slice(5, 7));
  const last = end.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > last) break;
    months.push({
      key,
      year,
      month,
      days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * 날짜가 월 눈금 전체에서 차지하는 위치(0~1).
 * `edge`가 "end"면 그날의 끝(다음 날 0시)을 가리켜, 하루짜리 막대도 너비가 생깁니다.
 */
export function timelineOffset(
  date: string,
  months: TimelineMonth[],
  edge: "start" | "end" = "start",
): number {
  if (!months.length) return 0;
  const origin = Date.parse(`${months[0].key}-01T00:00:00Z`);
  const total = months.reduce((sum, m) => sum + m.days, 0);
  const day =
    Math.round((Date.parse(`${date}T00:00:00Z`) - origin) / DAY_MS) +
    (edge === "end" ? 1 : 0);
  return Math.min(1, Math.max(0, day / total));
}

/** YYYY-MM-DD에 날짜 수를 더합니다(시간대 영향이 없게 UTC로 계산). */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * AI를 쓸 수 없을 때의 ‘자동 계산 초안’. 오늘부터 투고일까지(둘 다 포함)를
 * 보낼 단계(`sent`, buildRoadmapPlan과 같은 순서) 수로 똑같이 나눕니다.
 * 단계끼리 겹치지 않고 빈 날도 없게 잇습니다. 하루씩도 나눌 수 없으면 null.
 * AI 결과가 아니므로 reason은 비워 둡니다.
 */
export function evenRoadmapDraft(
  sent: Pick<ResearchPhase, "title">[],
  today: string,
  submissionDate: string,
): ProposedStage[] | null {
  const total =
    Math.round(
      (Date.parse(`${submissionDate}T00:00:00Z`) -
        Date.parse(`${today}T00:00:00Z`)) /
        DAY_MS,
    ) + 1;
  if (!sent.length || !Number.isFinite(total) || total < sent.length)
    return null;
  return sent.map((phase, i) => ({
    title: phase.title,
    startDate: addDays(today, Math.floor((i * total) / sent.length)),
    endDate: addDays(today, Math.floor(((i + 1) * total) / sent.length) - 1),
    reason: "",
    sourceIndex: i + 1,
  }));
}
