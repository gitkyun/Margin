/**
 * 시각 표기 기준 하나. 기본은 24시간제이고, 계정 설정에서 12시간제(오전/오후)나
 * ‘기기 설정 따르기’로 바꿀 수 있습니다. 기기 설정을 읽지 못하면 24시간제로 씁니다.
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

/** 계정 설정에서 고르는 값. 24시간제가 기본입니다(2026-11-11 결정). */
export type HourPreference = "auto" | HourStyle;

const PREFERENCE_KEY = "margin-hour-style";
const DEFAULT_PREFERENCE: HourPreference = "24h";

/** 이 브라우저에 저장한 선택. 없거나 읽지 못하면 기본값인 24시간제. */
export function readHourPreference(): HourPreference {
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    return saved === "12h" || saved === "auto" ? saved : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** 선택을 이 브라우저에만 저장합니다(서버에 저장하지 않음). 다음에 그리는 화면부터 적용됩니다. */
export function saveHourPreference(preference: HourPreference): void {
  cached = undefined;
  try {
    if (preference === DEFAULT_PREFERENCE)
      localStorage.removeItem(PREFERENCE_KEY);
    else localStorage.setItem(PREFERENCE_KEY, preference);
  } catch {
    // 저장소를 쓸 수 없으면 기본값(24시간제)을 씁니다.
  }
}

let cached: HourStyle | undefined;

/**
 * 지금 쓰는 시각 표기 방식. 고른 값이 없으면 24시간제, ‘기기 설정 따르기’를 고르면 기기 값을 씁니다.
 * 브라우저에 따라 운영체제의 24시간제 설정을 알려 주지 않아(크롬 등) 직접 고를 수 있게 했습니다.
 */
export function hourStyle(): HourStyle {
  if (cached) return cached;
  const preference = readHourPreference();
  cached = preference === "auto" ? detectHourStyle() : preference;
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
