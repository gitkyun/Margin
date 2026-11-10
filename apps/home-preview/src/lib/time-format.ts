/**
 * 시각 표기 기준 하나. 접속한 기기(브라우저)의 시간 표시 방식을 따라
 * 12시간제(오전/오후) 또는 24시간제로 통일하고, 읽지 못하면 24시간제로 씁니다.
 * 저장 값(`HH:mm`, ISO 타임스탬프)은 바꾸지 않고 화면 표기와 입력 칸 모양만 정합니다.
 */
export type HourStyle = "12h" | "24h";

type Resolved = { hourCycle?: string; hour12?: boolean };

/** 기기 설정을 읽어 12시간제인지 24시간제인지 정합니다. 읽지 못하면 24시간제. */
export function detectHourStyle(
  read: () => Resolved = () =>
    new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions(),
): HourStyle {
  try {
    const { hourCycle, hour12 } = read();
    if (hourCycle === "h11" || hourCycle === "h12") return "12h";
    if (hourCycle === "h23" || hourCycle === "h24") return "24h";
    return hour12 === true ? "12h" : "24h";
  } catch {
    return "24h";
  }
}

let cached: HourStyle | undefined;

/** 이 기기의 시각 표기 방식. 한 번 읽어 화면 전체가 같은 값을 씁니다. */
export function hourStyle(): HourStyle {
  cached ??= detectHourStyle();
  return cached;
}

/** `Intl.DateTimeFormat`에 넣는 시·분 옵션. 날짜 옵션과 함께 펼쳐 씁니다. */
export function timeParts(
  style: HourStyle = hourStyle(),
): Intl.DateTimeFormatOptions {
  return style === "12h"
    ? { hour: "numeric", minute: "2-digit", hourCycle: "h12" }
    : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
}

/** 저장된 시각 `HH:mm`을 화면 표기로: ‘오후 2:00’ 또는 ‘14:00’. 형식이 아니면 그대로 돌려줍니다. */
export function formatClock(
  time?: string | null,
  style: HourStyle = hourStyle(),
): string {
  if (!time) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const minute = match[2];
  if (hour > 23) return time;
  if (style === "24h") return `${String(hour).padStart(2, "0")}:${minute}`;
  return `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:${minute}`;
}

/** 시각 입력 칸(Montage TimePicker)의 형식과 빈 칸 안내 */
export function timeFieldFormat(style: HourStyle = hourStyle()): {
  format: string;
  placeholder: string;
} {
  return style === "12h"
    ? { format: "a hh:mm", placeholder: "오전 00:00" }
    : { format: "HH:mm", placeholder: "00:00" };
}
