// 투고일 기준 로드맵 제안의 입력·출력 검사.
// 서버 함수(index.ts)와 화면(src/lib/roadmap-plan.ts)이 같은 코드를 씁니다.
// 그래서 이 파일은 다른 파일을 불러오지 않고 Deno 전용 기능도 쓰지 않습니다.

export const ROADMAP_MODE = "propose_roadmap";
export const ROADMAP_MAX_STAGES = 12;
export const ROADMAP_MAX_INPUT_STAGES = 20;
export const ROADMAP_MAX_YEARS = 5;
const TITLE_LIMIT = 200;
const REASON_LIMIT = 500;
const ASSUMPTIONS_LIMIT = 2000;
const DAY_MS = 86400000;

export interface RoadmapStageInput {
  /** 1부터 시작하는 번호. 제안의 sourceIndex가 이 번호를 가리킵니다. */
  index: number;
  title: string;
  status: "planned" | "active";
  dueDate?: string;
}
export interface RoadmapPlan {
  today: string;
  submissionDate: string;
  stages: RoadmapStageInput[];
  completedStages: string[];
}
export interface ProposedStage {
  title: string;
  startDate: string;
  endDate: string;
  reason: string;
  /** 0이면 새 단계, 1 이상이면 보낸 단계의 번호 */
  sourceIndex: number;
}
export interface RoadmapProposal {
  stages: ProposedStage[];
  assumptions: string;
}
export type StageDateProblem =
  "missing" | "invalid" | "reversed" | "before_today" | "after_submission";

export class RoadmapError extends Error {
  constructor(
    public code: "INVALID_INPUT" | "INVALID_OUTPUT",
    message: string,
  ) {
    super(message);
    this.name = "RoadmapError";
  }
}

const INPUT_MESSAGE = "투고일과 연구 단계를 확인해 주세요.";
const OUTPUT_MESSAGE =
  "AI가 제안한 계획의 형식을 확인할 수 없습니다. 다시 시도하거나 직접 입력해 주세요.";
const RANGE_MESSAGE =
  "AI가 제안한 날짜가 오늘과 투고일 사이를 벗어나 적용하지 않았습니다. 다시 시도하거나 직접 입력해 주세요.";

/** YYYY-MM-DD이고 실제로 있는 날짜인지 */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
export function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}
export function addYears(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** 투고일이 내일부터 5년 안인지. 문제가 없으면 null */
export function submissionDateProblem(
  today: string,
  submissionDate: string,
): "invalid" | "not_future" | "too_far" | null {
  if (!isDateKey(today) || !isDateKey(submissionDate)) return "invalid";
  if (submissionDate <= today) return "not_future";
  if (submissionDate > addYears(today, ROADMAP_MAX_YEARS)) return "too_far";
  return null;
}

/** 한 단계의 날짜가 오늘~투고일 안에 있고 순서가 맞는지. 문제가 없으면 null */
export function stageDateProblem(
  stage: { startDate: string; endDate: string },
  today: string,
  submissionDate: string,
): StageDateProblem | null {
  if (!stage.startDate || !stage.endDate) return "missing";
  if (!isDateKey(stage.startDate) || !isDateKey(stage.endDate))
    return "invalid";
  if (stage.endDate < stage.startDate) return "reversed";
  if (stage.startDate < today) return "before_today";
  if (stage.endDate > submissionDate) return "after_submission";
  return null;
}

function record(value: unknown, error: RoadmapError): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw error;
  return value as Record<string, unknown>;
}

/**
 * 화면이 보낸 계획 입력을 검사합니다.
 * referenceToday를 주면(서버) 보낸 '오늘'이 그 날짜와 하루 넘게 다를 때 거절합니다(시간대 차이만 허용).
 */
export function validateRoadmapPlan(
  value: unknown,
  referenceToday?: string,
): RoadmapPlan {
  const error = new RoadmapError("INVALID_INPUT", INPUT_MESSAGE);
  const plan = record(value, error);
  const { today, submissionDate } = plan;
  if (!isDateKey(today) || !isDateKey(submissionDate)) throw error;
  if (
    referenceToday !== undefined &&
    (!isDateKey(referenceToday) ||
      Math.abs(dayNumber(today) - dayNumber(referenceToday)) > 1)
  )
    throw error;
  if (submissionDateProblem(today, submissionDate)) throw error;
  if (
    !Array.isArray(plan.stages) ||
    plan.stages.length > ROADMAP_MAX_INPUT_STAGES ||
    !Array.isArray(plan.completedStages) ||
    plan.completedStages.length > ROADMAP_MAX_INPUT_STAGES
  )
    throw error;
  const stages = plan.stages.map((item, i): RoadmapStageInput => {
    const stage = record(item, error);
    if (
      typeof stage.title !== "string" ||
      !stage.title.trim() ||
      stage.title.length > TITLE_LIMIT ||
      (stage.status !== "planned" && stage.status !== "active") ||
      (stage.dueDate !== undefined &&
        stage.dueDate !== null &&
        !isDateKey(stage.dueDate))
    )
      throw error;
    return {
      index: i + 1,
      title: stage.title.trim(),
      status: stage.status,
      ...(isDateKey(stage.dueDate) ? { dueDate: stage.dueDate } : {}),
    };
  });
  const completedStages = plan.completedStages.map((title) => {
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > TITLE_LIMIT
    )
      throw error;
    return title.trim();
  });
  return { today, submissionDate, stages, completedStages };
}

/**
 * 모델이 돌려준 계획을 검사합니다. 날짜가 오늘~투고일을 벗어나거나 순서가 뒤집힌 제안은
 * 고쳐 쓰지 않고 거절합니다. 보낸 단계의 이름은 모델이 바꿔도 원래 이름으로 되돌립니다.
 */
export function normalizeRoadmap(
  value: unknown,
  plan: RoadmapPlan,
): RoadmapProposal {
  const error = new RoadmapError("INVALID_OUTPUT", OUTPUT_MESSAGE);
  const output = record(value, error);
  if (
    !Array.isArray(output.stages) ||
    output.stages.length < 1 ||
    output.stages.length > ROADMAP_MAX_STAGES ||
    (output.assumptions !== undefined &&
      (typeof output.assumptions !== "string" ||
        output.assumptions.length > ASSUMPTIONS_LIMIT))
  )
    throw error;
  const used = new Set<number>();
  const stages = output.stages.map((item): ProposedStage => {
    const stage = record(item, error);
    const sourceIndex = stage.sourceIndex ?? 0;
    if (
      typeof stage.title !== "string" ||
      !stage.title.trim() ||
      stage.title.length > TITLE_LIMIT ||
      (stage.reason !== undefined &&
        (typeof stage.reason !== "string" ||
          stage.reason.length > REASON_LIMIT)) ||
      typeof sourceIndex !== "number" ||
      !Number.isInteger(sourceIndex) ||
      sourceIndex < 0 ||
      sourceIndex > plan.stages.length ||
      (sourceIndex > 0 && used.has(sourceIndex)) ||
      typeof stage.startDate !== "string" ||
      typeof stage.endDate !== "string"
    )
      throw error;
    used.add(sourceIndex);
    const dates = { startDate: stage.startDate, endDate: stage.endDate };
    const problem = stageDateProblem(dates, plan.today, plan.submissionDate);
    if (problem === "before_today" || problem === "after_submission")
      throw new RoadmapError("INVALID_OUTPUT", RANGE_MESSAGE);
    if (problem) throw error;
    return {
      title:
        sourceIndex > 0
          ? plan.stages[sourceIndex - 1].title
          : stage.title.trim(),
      ...dates,
      reason: typeof stage.reason === "string" ? stage.reason.trim() : "",
      sourceIndex,
    };
  });
  return {
    // 시작일 순으로 맞춥니다(같으면 받은 순서 유지).
    stages: stages
      .map((stage, i) => ({ stage, i }))
      .sort(
        (a, b) =>
          a.stage.startDate.localeCompare(b.stage.startDate) || a.i - b.i,
      )
      .map(({ stage }) => stage),
    assumptions:
      typeof output.assumptions === "string" ? output.assumptions.trim() : "",
  };
}

/** Gemini 응답 스키마 */
export const roadmapSchema = {
  type: "OBJECT",
  properties: {
    stages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          startDate: { type: "STRING" },
          endDate: { type: "STRING" },
          reason: { type: "STRING" },
          sourceIndex: { type: "INTEGER" },
        },
        required: ["title", "startDate", "endDate", "reason", "sourceIndex"],
      },
    },
    assumptions: { type: "STRING" },
  },
  required: ["stages", "assumptions"],
};
