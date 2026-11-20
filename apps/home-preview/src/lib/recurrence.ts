import type { Meeting } from "./domain";
import { t } from "./i18n";
import { seoulToday } from "./home-meeting";
import { isMeetingRecord } from "./record-view";

/**
 * 미팅 주기(IA v2 07 §1.3, Q7 2026-11-16 '넣는다'). 연구(`Research.meetingCadence`)에 저장하고,
 * '다음 미팅 잡기'를 열 때 날짜·시각을 미리 채우는 데만 씁니다. 미팅을 자동으로 만들지 않습니다.
 */
export interface MeetingCadence {
  /** 0(일)~6(토). `Date#getUTCDay`와 같은 번호 */
  weekday: number;
  /** `HH:mm`(24시간) */
  time: string;
  /** 몇 주마다(1~4) */
  every: number;
}

export const CADENCE_EVERY = [1, 2, 3, 4] as const;
/** 화면에 늘어놓는 요일 순서(월~일) */
export const CADENCE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

/** 요일 이름(0=일요일) */
export function weekdayName(weekday: number): string {
  return [
    t("일요일"),
    t("월요일"),
    t("화요일"),
    t("수요일"),
    t("목요일"),
    t("금요일"),
    t("토요일"),
  ][weekday];
}

export function everyLabel(every: number): string {
  return every === 1 ? t("매주") : t("{count}주마다", { count: every });
}

/** "매주 수요일"처럼 주기를 한 마디로 */
export function cadenceRule(cadence: MeetingCadence): string {
  return `${everyLabel(cadence.every)} ${weekdayName(cadence.weekday)}`;
}

/** 저장된 값을 확인해 쓸 수 있는 주기로. 모양이 틀리면 null(꺼진 것으로 봄) */
export function readCadence(value: unknown): MeetingCadence | null {
  if (!value || typeof value !== "object") return null;
  const { weekday, time, every } = value as Record<string, unknown>;
  if (
    !Number.isInteger(weekday) ||
    (weekday as number) < 0 ||
    (weekday as number) > 6
  )
    return null;
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return null;
  if (!CADENCE_EVERY.includes(every as (typeof CADENCE_EVERY)[number]))
    return null;
  return { weekday: weekday as number, time, every: every as number };
}

function toDay(key: string): Date {
  return new Date(`${key.slice(0, 10)}T00:00:00Z`);
}
function toKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}
function addDays(day: Date, count: number): Date {
  return new Date(day.getTime() + count * 86_400_000);
}

/**
 * 다음 차례 날짜(YYYY-MM-DD, 서울 기준). 07 §1.3:
 * 1. 기준일 = 날짜가 있는 미팅(서면 피드백·취소·휴지통 제외) 가운데 가장 늦은 날짜, 없으면 오늘.
 *    이미 잡힌 다음 미팅도 여기 들어가 같은 날을 두 번 권하지 않습니다(4).
 * 2. 후보 = 기준일 다음 날부터 처음 오는 설정 요일 + (간격 − 1)주.
 * 3. 후보가 오늘보다 이르면 간격만큼 더해 오늘 이후로.
 */
export function nextCadenceDate(
  cadence: MeetingCadence,
  meetings: readonly Pick<
    Meeting,
    "date" | "status" | "recordType" | "archivedAt"
  >[],
  today = seoulToday(),
): string {
  const dated = meetings
    .filter(
      (m) =>
        !!m.date &&
        !m.archivedAt &&
        m.status !== "cancelled" &&
        isMeetingRecord(m),
    )
    .map((m) => m.date!.slice(0, 10));
  const base = dated.length ? dated.reduce((a, b) => (a > b ? a : b)) : today;
  const start = addDays(toDay(base), 1);
  const ahead = (cadence.weekday - start.getUTCDay() + 7) % 7;
  let candidate = addDays(start, ahead + (cadence.every - 1) * 7);
  const floor = toDay(today);
  while (candidate < floor) candidate = addDays(candidate, 7 * cadence.every);
  return toKey(candidate);
}
