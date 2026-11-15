const DAY_MS = 86400000;

/** 오늘(YYYY-MM-DD)부터 목표일까지 남은 날. 지난 날이면 음수, 잘못된 날짜면 null */
export function daysUntil(today: string, target: string): number | null {
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${target}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / DAY_MS);
}

/** D-23 · D-Day · D+3 */
export function dDayLabel(days: number): string {
  if (days === 0) return "D-Day";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}
