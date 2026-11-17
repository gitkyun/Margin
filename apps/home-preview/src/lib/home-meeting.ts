import type { Meeting } from "./domain";

/** 오늘 날짜(YYYY-MM-DD, 서울 기준). 미팅 날짜 문자열과 그대로 비교합니다. */
export function seoulToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 지금 시각(HH:MM, 서울 기준). 미팅 시각 문자열과 그대로 비교합니다. */
export function seoulNowTime(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

/** Finished records must never become the home recording/preparation target. */
export function selectNextMeeting(
  meetings: Meeting[],
  preferredId?: string | null,
  today = seoulToday(),
) {
  const active = meetings.filter(
    (m) =>
      !m.archivedAt &&
      (m.status === "recording" ||
        (m.status === "preparing" && (!m.date || m.date >= today))),
  );
  return (
    active.find((m) => m.status === "recording") ??
    active.find((m) => m.id === preferredId) ??
    [...active].sort((a, b) =>
      `${a.date ?? "9999"} ${a.time ?? ""}`.localeCompare(
        `${b.date ?? "9999"} ${b.time ?? ""}`,
      ),
    )[0]
  );
}
