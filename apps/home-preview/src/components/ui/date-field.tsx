import { DatePicker, TimePicker } from "@montage-ui/core";

/**
 * 날짜·시각 입력. 달력과 시각 목록은 Montage DatePicker·TimePicker가 맡습니다.
 * 값은 지금까지와 같은 문자열(날짜 `YYYY-MM-DD`, 시각 `HH:mm`)로 주고받아
 * 저장 형식과 DB 필드가 바뀌지 않습니다. 날짜는 현지 날짜 그대로 다룹니다(시간대 변환 없음).
 */
const pad = (n: number) => String(n).padStart(2, "0");

type PickerValue = Date | string | null | undefined;

function toDate(value: PickerValue): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateKey(value: PickerValue): string {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeKey(value: PickerValue): string {
  const date = toDate(value);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
}

/** `YYYY-MM-DD`를 그날 0시(현지)로 */
export function fromDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
}

/** `HH:mm`을 오늘 그 시각(현지)으로 */
export function fromTimeKey(key: string): Date | null {
  const match = /^(\d{2}):(\d{2})/.exec(key);
  if (!match) return null;
  const date = new Date();
  date.setHours(+match[1], +match[2], 0, 0);
  return date;
}

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  size?: "large" | "medium";
};

export function DateField({
  value,
  onChange,
  size = "large",
  ...props
}: FieldProps) {
  return (
    <DatePicker
      {...props}
      size={size}
      width="100%"
      format="YYYY.MM.DD"
      placeholder="YYYY.MM.DD"
      value={fromDateKey(value)}
      onChange={(date) => onChange(toDateKey(date))}
    />
  );
}

export function TimeField({
  value,
  onChange,
  size = "large",
  ...props
}: FieldProps) {
  return (
    <TimePicker
      {...props}
      size={size}
      width="100%"
      format="a hh:mm"
      placeholder="오전 00:00"
      value={fromTimeKey(value)}
      onChange={(date) => onChange(toTimeKey(date))}
    />
  );
}

/** `YYYY-MM-DDTHH:mm`(예전 datetime-local 값)을 날짜·시각 두 칸으로 */
export function DateTimeField({
  value,
  onChange,
  label,
  required,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [date = "", time = ""] = value.split("T");
  const join = (nextDate: string, nextTime: string) =>
    nextDate ? `${nextDate}T${nextTime || "00:00"}` : "";
  return (
    <span className="margin-date-time">
      <DateField
        aria-label={`${label} 날짜`}
        value={date}
        required={required}
        disabled={disabled}
        size="medium"
        onChange={(next) => onChange(join(next, time))}
      />
      <TimeField
        aria-label={`${label} 시각`}
        value={time}
        required={required}
        disabled={disabled || !date}
        size="medium"
        onChange={(next) => onChange(join(date, next))}
      />
    </span>
  );
}
