import type { DocumentVersion, Meeting, Task } from "./domain";

const DAY_MS = 86_400_000;
const MAX_SEGMENTS = 8;
const SOON_DAYS = 2;

export type KpiTone = "blue" | "green" | "amber" | "red" | "gray";

export interface HomeKpi {
  label: string;
  value: string;
  context: string;
  tone: KpiTone;
  to: string;
  bar: boolean[];
}

export interface HomeKpiInput {
  base: string;
  next: Pick<Meeting, "id" | "date" | "taskIds"> | undefined;
  tasks: readonly Pick<Task, "id" | "status">[];
  docs: readonly { id: string }[];
  versions: readonly Pick<DocumentVersion, "documentId">[];
  attention: number;
  attentionHref: string;
  today?: Date;
}

/** 오늘(자정 기준)에서 날짜까지 남은 일수. 날짜가 없거나 잘못되면 null. */
export function daysUntil(
  date: string | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.round((target - start.getTime()) / DAY_MS);
}

/** 완료 비율만큼 채운 칸 목록. 최대 8칸, 측정할 대상이 없으면 빈 목록. */
export function segmentBar(done: number, total: number): boolean[] {
  if (total <= 0) return [];
  const size = Math.min(total, MAX_SEGMENTS);
  const filled = Math.round((done / total) * size);
  return Array.from({ length: size }, (_, i) => i < filled);
}

function meetingKpi(input: HomeKpiInput): HomeKpi {
  const { base, next, tasks, today } = input;
  if (!next)
    return {
      label: "다음 미팅",
      value: "미정",
      context: "일정 없음",
      tone: "gray",
      to: `${base}/meetings`,
      bar: [],
    };
  const days = daysUntil(next.date, today);
  const ready = next.taskIds.filter(
    (id) => tasks.find((t) => t.id === id)?.status === "done",
  ).length;
  const value =
    days === null
      ? "미정"
      : days === 0
        ? "오늘"
        : days > 0
          ? `D-${days}`
          : `${-days}일 지남`;
  const tone: KpiTone =
    days === null
      ? "gray"
      : days < 0
        ? "red"
        : days <= SOON_DAYS
          ? "amber"
          : "blue";
  return {
    label: "다음 미팅",
    value,
    context: `준비 ${ready}/${next.taskIds.length}`,
    tone,
    to: `${base}/meetings/${next.id}?tab=prepare`,
    bar: segmentBar(ready, next.taskIds.length),
  };
}

/** 연구 홈 상단 지표 묶음. 실제 기록 수만 쓰고 추정값을 만들지 않는다. */
export function homeKpis(input: HomeKpiInput): HomeKpi[] {
  const { base, tasks, docs, versions, attention, attentionHref } = input;
  const done = tasks.filter((t) => t.status === "done").length;
  const open = tasks.length - done;
  const docIds = new Set(docs.map((d) => d.id));
  const versionCount = versions.filter((v) => docIds.has(v.documentId)).length;
  return [
    meetingKpi(input),
    {
      label: "열린 작업",
      value: String(open),
      context: `전체 ${tasks.length}개`,
      tone: open ? "blue" : "green",
      to: `${base}/tasks`,
      bar: segmentBar(done, tasks.length),
    },
    {
      label: "확인할 내용",
      value: String(attention),
      context: attention ? "교수 의견·AI 결과" : "모두 확인",
      tone: attention ? "red" : "gray",
      to: attention ? attentionHref : `${base}/reviews`,
      bar: [],
    },
    {
      label: "작성 중인 문서",
      value: String(docs.length),
      context: `버전 ${versionCount}개`,
      tone: "gray",
      to: `${base}/writing`,
      bar: [],
    },
  ];
}
