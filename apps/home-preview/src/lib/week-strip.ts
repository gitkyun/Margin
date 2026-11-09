import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { WorkspaceData } from "./domain";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DAYS_IN_WEEK = 7;
const DATE_KEY = "yyyy-MM-dd";

export interface WeekItem {
  id: string;
  kind: "meeting" | "task";
  title: string;
  /** 미팅 시작 시간(HH:mm). 마감은 없음 */
  time: string | null;
  href: string;
}

export interface WeekDay {
  key: string;
  weekday: (typeof WEEKDAYS)[number];
  day: number;
  month: number;
  isToday: boolean;
  items: WeekItem[];
}

/** 서울 기준 오늘(YYYY-MM-DD). 다른 화면의 ‘기한 지남’ 판단과 같은 기준입니다. */
export function seoulTodayKey(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 날짜 키를 하루 단위로 옮깁니다. 현지 자정으로 읽고 써서 시간대 밀림이 없습니다. */
export function shiftDay(key: string, delta: number): string {
  return format(addDays(parseISO(key), delta), DATE_KEY);
}

/** 그날이 든 주(일요일 시작, 큰 캘린더와 같음)의 7일 키 */
export function weekKeys(anchorKey: string): string[] {
  const sunday = startOfWeek(parseISO(anchorKey), { weekStartsOn: 0 });
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) =>
    format(addDays(sunday, i), DATE_KEY),
  );
}

function itemsByDay(
  data: Pick<WorkspaceData, "meetings" | "tasks">,
  researchId: string,
): Map<string, WeekItem[]> {
  const meetings = data.meetings
    .filter(
      (m) =>
        m.researchId === researchId &&
        !m.archivedAt &&
        m.status !== "cancelled" &&
        m.date,
    )
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"))
    .map((m) => ({
      date: m.date as string,
      item: {
        id: m.id,
        kind: "meeting" as const,
        title: m.title,
        time: m.time,
        href: `/r/${researchId}/meetings/${m.id}`,
      },
    }));
  const deadlines = data.tasks
    .filter(
      (t) =>
        t.researchId === researchId &&
        !t.archivedAt &&
        t.status !== "done" &&
        t.dueDate,
    )
    .map((t) => ({
      date: t.dueDate as string,
      item: {
        id: t.id,
        kind: "task" as const,
        title: t.title,
        time: null,
        href: `/r/${researchId}/tasks/${t.id}`,
      },
    }));
  const byDay = new Map<string, WeekItem[]>();
  for (const { date, item } of [...meetings, ...deadlines]) {
    byDay.set(date, [...(byDay.get(date) ?? []), item]);
  }
  return byDay;
}

/** 홈 주간 띠: 그 주 7일과 날마다의 미팅(시간순) → 남은 할 일 마감 */
export function buildWeek({
  data,
  researchId,
  anchorKey,
  todayKey,
}: {
  data: Pick<WorkspaceData, "meetings" | "tasks">;
  researchId: string;
  anchorKey: string;
  todayKey: string;
}): WeekDay[] {
  const byDay = itemsByDay(data, researchId);
  return weekKeys(anchorKey).map((key) => {
    const date = parseISO(key);
    return {
      key,
      weekday: WEEKDAYS[date.getDay()],
      day: date.getDate(),
      month: date.getMonth() + 1,
      isToday: key === todayKey,
      items: byDay.get(key) ?? [],
    };
  });
}
