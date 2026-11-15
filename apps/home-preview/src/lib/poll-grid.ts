/**
 * 시간 조율 후보를 날짜(열) × 시간대(행) 격자로 묶어요.
 * 데이터 계약(MeetingPoll)은 그대로이고 보기만 바꿔요.
 */
import type { MeetingPoll } from "./domain";

type PollOption = MeetingPoll["options"][number];
type PollParticipant = MeetingPoll["participants"][number];

export interface PollCell {
  option: PollOption;
  /** 가능하다고 고른 참석자 수 */
  count: number;
  /** 0~4. 참석자 대비 가능 비율을 다섯 단계로 나눈 값 */
  level: 0 | 1 | 2 | 3 | 4;
  /** 가장 많은 사람이 가능한 후보(1명 이상일 때만) */
  best: boolean;
}

export interface PollGrid {
  /** 열: 날짜 열쇠(YYYY-MM-DD, 기기 시간대) */
  days: { key: string; date: Date }[];
  /** 행: 시간대 열쇠(HH:MM-HH:MM)와 그 줄의 칸(그 날 후보가 없으면 null) */
  rows: { key: string; start: Date; end: Date; cells: (PollCell | null)[] }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
const clockKey = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export function availableCount(
  participants: readonly PollParticipant[],
  optionId: string,
): number {
  return participants.filter((p) => p.available.includes(optionId)).length;
}

export function pollGrid(
  options: readonly PollOption[],
  participants: readonly PollParticipant[],
): PollGrid {
  const parsed = options
    .map((option) => ({
      option,
      start: new Date(option.start),
      end: new Date(option.end),
    }))
    .filter(
      (item) =>
        !Number.isNaN(item.start.getTime()) &&
        !Number.isNaN(item.end.getTime()),
    );
  const counts = new Map(
    parsed.map(({ option }) => [
      option.id,
      availableCount(participants, option.id),
    ]),
  );
  const top = Math.max(0, ...counts.values());
  const total = participants.length;
  const dayMap = new Map<string, Date>();
  const rowMap = new Map<string, { start: Date; end: Date }>();
  for (const item of parsed) {
    const day = localDayKey(item.start);
    if (!dayMap.has(day)) dayMap.set(day, item.start);
    const row = `${clockKey(item.start)}-${clockKey(item.end)}`;
    if (!rowMap.has(row)) rowMap.set(row, { start: item.start, end: item.end });
  }
  const days = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, date]) => ({ key, date }));
  const rows = [...rowMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, span]) => ({
      key,
      ...span,
      cells: days.map((day) => {
        const hit = parsed.find(
          (item) =>
            localDayKey(item.start) === day.key &&
            `${clockKey(item.start)}-${clockKey(item.end)}` === key,
        );
        if (!hit) return null;
        const count = counts.get(hit.option.id) ?? 0;
        const ratio = total ? count / total : 0;
        return {
          option: hit.option,
          count,
          level: (ratio === 0
            ? 0
            : Math.min(4, Math.ceil(ratio * 4))) as PollCell["level"],
          best: top > 0 && count === top,
        };
      }),
    }));
  return { days, rows };
}
