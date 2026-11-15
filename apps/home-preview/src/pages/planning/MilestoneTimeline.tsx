import { t } from "@/lib/i18n";
import { Fragment } from "react";
import { formatDate, type Milestone } from "@/lib/domain";
import { milestoneTimeline, todayLineIndex } from "@/lib/milestone-timeline";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/common";
import "./planning.css";

function whenLabel(when: string, days: number | null): string {
  if (days === null) return t("날짜 미정");
  if (when === "today") return t("오늘");
  return days > 0
    ? t("{count}일 남음", { count: days })
    : t("{count}일 지남", { count: -days });
}

/**
 * 주요 목표를 세로 타임라인 카드로 보여 줍니다(지난 것 · 오늘 · 다가올 것).
 * 카드를 누르면 목표 편집 창을 열어요. 완료 여부는 날짜와 따로 표시해요.
 */
export function MilestoneTimeline({
  milestones,
  today,
  onOpen,
}: {
  milestones: Milestone[];
  /** YYYY-MM-DD */
  today: string;
  onOpen(milestone: Milestone): void;
}) {
  const items = milestoneTimeline(milestones, today);
  const line = todayLineIndex(items);
  const todayLine = (
    <li className="milestone-today-line">
      <span>
        {t("오늘")} · {formatDate(today)}
      </span>
    </li>
  );
  return (
    <ol className="milestone-timeline" aria-label={t("주요 목표 시간순")}>
      {items.map(({ milestone, when, days, overdue }, index) => {
        const done = milestone.status === "done";
        return (
          <Fragment key={milestone.id}>
            {index === line && todayLine}
            <li
              className={`milestone-card is-${when}${done ? " is-done" : ""}${overdue ? " is-overdue" : ""}`}
            >
              <span className="milestone-dot" aria-hidden="true">
                <Icon name={done ? "check" : "flag"} size={12} />
              </span>
              <button
                type="button"
                className="milestone-card-body"
                onClick={() => onOpen(milestone)}
              >
                <span className="milestone-card-text">
                  <small className="milestone-when">
                    {whenLabel(when, days)}
                  </small>
                  <strong>{milestone.title}</strong>
                  <small>{formatDate(milestone.dueDate)}</small>
                </span>
                <StatusBadge
                  tone={done ? "green" : overdue ? "amber" : "neutral"}
                >
                  {done ? t("완료") : overdue ? t("기한 지남") : t("예정")}
                </StatusBadge>
              </button>
            </li>
          </Fragment>
        );
      })}
      {line === items.length && todayLine}
    </ol>
  );
}
