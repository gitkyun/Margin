import { t } from "./i18n";
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
      label: t("다음 미팅"),
      value: t("미정"),
      context: t("일정 없음"),
      tone: "gray",
      to: `${base}/meetings`,
      bar: [],
    };
  const days = daysUntil(next.date, today);
  const ready = next.taskIds.filter(
    (id) => tasks.find((task) => task.id === id)?.status === "done",
  ).length;
  const value =
    days === null
      ? t("미정")
      : days === 0
        ? t("오늘")
        : days > 0
          ? `D-${days}`
          : t("{days}일 지남", { days: -days });
  const tone: KpiTone =
    days === null
      ? "gray"
      : days < 0
        ? "red"
        : days <= SOON_DAYS
          ? "amber"
          : "blue";
  return {
    label: t("다음 미팅"),
    value,
    context: t("준비 {ready}/{total}", { ready, total: next.taskIds.length }),
    tone,
    to: `${base}/meetings/${next.id}?tab=prepare`,
    bar: segmentBar(ready, next.taskIds.length),
  };
}

/** 연구 홈 상단 지표 묶음. 실제 기록 수만 쓰고 추정값을 만들지 않는다. */
export function homeKpis(input: HomeKpiInput): HomeKpi[] {
  const { base, tasks, docs, versions, attention, attentionHref } = input;
  const done = tasks.filter((task) => task.status === "done").length;
  const open = tasks.length - done;
  const docIds = new Set(docs.map((d) => d.id));
  const versionCount = versions.filter((v) => docIds.has(v.documentId)).length;
  return [
    meetingKpi(input),
    {
      label: t("남은 할 일"),
      value: String(open),
      context: t("전체 {count}개", { count: tasks.length }),
      tone: open ? "blue" : "green",
      to: `${base}/tasks`,
      bar: segmentBar(done, tasks.length),
    },
    {
      label: t("확인할 내용"),
      value: String(attention),
      context: attention ? t("검토 알림·AI 제안") : t("새 알림 없음"),
      tone: attention ? "red" : "gray",
      to: attention ? attentionHref : `${base}/reviews`,
      bar: [],
    },
    {
      label: t("문서"),
      value: String(docs.length),
      context: t("버전 {count}개", { count: versionCount }),
      tone: "gray",
      to: `${base}/writing`,
      bar: [],
    },
  ];
}
