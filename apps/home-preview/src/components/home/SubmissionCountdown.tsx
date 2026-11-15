import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { todayKey } from "@/lib/roadmap-plan";
import { dDayLabel, daysUntil } from "@/lib/submission-countdown";

interface SubmissionCountdownProps {
  /** 연구의 투고·제출 목표일(YYYY-MM-DD). 없으면 그리지 않아요. */
  date?: string;
  /** 누르면 갈 곳(일정) */
  href: string;
}

/** 연구 이름 옆 D-Day 칩. 목표일만 보여 주고 다른 계산은 하지 않아요. */
export function SubmissionCountdown({ date, href }: SubmissionCountdownProps) {
  if (!date) return null;
  const days = daysUntil(todayKey(), date);
  if (days === null) return null;
  const label = dDayLabel(days);
  return (
    <Link
      to={href}
      className="rh-countdown"
      data-past={days < 0 || undefined}
      aria-label={
        days < 0
          ? t("투고 목표일이 {days}일 지났어요. 일정 보기", { days: -days })
          : t("투고 목표일까지 {label}. 일정 보기", { label })
      }
    >
      <span>{days < 0 ? t("투고일 지남") : t("투고까지")}</span>
      <strong>{label}</strong>
    </Link>
  );
}
