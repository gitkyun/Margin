import type { Meeting } from "./domain";

/** Finished records must never become the home recording/preparation target. */
export function selectNextMeeting(
  meetings: Meeting[],
  preferredId?: string | null,
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
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
