interface CalendarRecord {
  id: string;
  kind: string;
  data: Record<string, unknown>;
}
export interface CalendarContext {
  id: string;
  kind: string;
  title: string;
  text: string;
}
const allowed = new Set(["meetings", "tasks", "milestones", "phases"]);
/** Input rows must already be filtered by the requesting user's RLS token. */
export function calendarContexts(
  rows: CalendarRecord[],
  today: string,
): CalendarContext[] {
  const value = (v: unknown, max = 600) =>
    typeof v === "string" ? v.slice(0, max) : "";
  return rows
    .filter(
      (row) =>
        allowed.has(row.kind) &&
        !row.data.archivedAt &&
        !row.data.deletedAt &&
        row.data.status !== "cancelled",
    )
    .map((row) => {
      const d = row.data,
        date = value(d.date || d.dueDate || d.startDate, 10);
      const fields: Record<string, unknown> = {
        title: value(d.title, 200),
        date: value(d.date, 10),
        time: value(d.time, 10),
        startDate: value(d.startDate, 10),
        dueDate: value(d.dueDate, 10),
        status: value(d.status, 40),
        goal: value(d.goal),
        description: value(d.description),
      };
      return {
        id: row.id,
        kind: row.kind,
        title: value(d.title, 200),
        text: JSON.stringify(
          Object.fromEntries(Object.entries(fields).filter(([, v]) => v)),
        ),
        date,
      };
    })
    .sort((a, b) => {
      const rank = (date: string) => (date >= today ? 0 : !date ? 1 : 2);
      return (
        rank(a.date) - rank(b.date) ||
        (rank(a.date) === 2
          ? b.date.localeCompare(a.date)
          : a.date.localeCompare(b.date))
      );
    })
    .slice(0, 80)
    .map(({ date, ...context }) => context);
}
