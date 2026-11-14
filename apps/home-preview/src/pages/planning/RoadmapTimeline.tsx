import { dateLocale, t } from "@/lib/i18n";
import type { CSSProperties } from "react";
import { formatDate } from "@/lib/domain";
import {
  isDateKey,
  timelineMonths,
  timelineOffset,
  todayKey,
} from "@/lib/roadmap-plan";

export interface TimelineBar {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  tone?: "proposal" | "planned" | "active" | "done";
}
export interface TimelineMarker {
  id: string;
  label: string;
  date: string;
}
interface RoadmapTimelineProps {
  /** 표의 접근성 이름 */
  label: string;
  bars: TimelineBar[];
  markers?: TimelineMarker[];
}

const percent = (value: number) => `${(value * 100).toFixed(3)}%`;

/**
 * 월 눈금 위에 단계 기간을 막대로 보여 줍니다.
 * 좁은 화면에서는 표 안에서만 가로로 넘겨 보고, 단계 이름과 날짜는 글자로도 읽을 수 있어요.
 */
export function RoadmapTimeline({
  label,
  bars,
  markers = [],
}: RoadmapTimelineProps) {
  const valid = bars.filter(
    (bar) =>
      isDateKey(bar.startDate) &&
      isDateKey(bar.endDate) &&
      bar.startDate <= bar.endDate,
  );
  const points = markers.filter((marker) => isDateKey(marker.date));
  if (!valid.length) return null;
  const dates = [
    ...valid.flatMap((bar) => [bar.startDate, bar.endDate]),
    ...points.map((marker) => marker.date),
  ].sort();
  const months = timelineMonths(dates[0], dates[dates.length - 1]);
  const today = todayKey();
  const showToday =
    today >= `${months[0].key}-01` &&
    today.slice(0, 7) <= months[months.length - 1].key;
  const monthLabel = (year: number, month: number, withYear: boolean) =>
    new Intl.DateTimeFormat(dateLocale(), {
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  return (
    <div
      className="roadmap-chart"
      role="group"
      aria-label={label}
      // 키보드로도 가로로 넘겨 볼 수 있게 합니다.
      tabIndex={0}
    >
      <div
        className="roadmap-chart-grid"
        style={{ "--roadmap-months": months.length } as CSSProperties}
      >
        <div className="roadmap-chart-lines" aria-hidden="true">
          {months.map((m) => (
            <span key={m.key} style={{ flexGrow: m.days }} />
          ))}
          {showToday && (
            <i
              className="roadmap-chart-today"
              style={{ left: percent(timelineOffset(today, months)) }}
            />
          )}
          {points.map((marker) => (
            <i
              key={marker.id}
              className="roadmap-chart-marker-line"
              style={{ left: percent(timelineOffset(marker.date, months)) }}
            />
          ))}
        </div>
        <div className="roadmap-chart-months" aria-hidden="true">
          {months.map((m, i) => (
            <span key={m.key} style={{ flexGrow: m.days }}>
              {monthLabel(m.year, m.month, i === 0 || m.month === 1)}
            </span>
          ))}
        </div>
        <ol className="roadmap-chart-rows">
          {valid.map((bar) => {
            const left = timelineOffset(bar.startDate, months);
            const right = timelineOffset(bar.endDate, months, "end");
            return (
              <li key={bar.id}>
                <p className="roadmap-chart-label">
                  <strong>{bar.title}</strong>
                  <span>
                    {t("{start} ~ {end}", {
                      start: formatDate(bar.startDate),
                      end: formatDate(bar.endDate),
                    })}
                  </span>
                </p>
                <div className="roadmap-chart-track" aria-hidden="true">
                  <span
                    className="roadmap-chart-bar"
                    data-tone={bar.tone ?? "planned"}
                    style={{
                      left: percent(left),
                      width: percent(right - left),
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        {(showToday || points.length > 0) && (
          <ul className="roadmap-chart-legend">
            {showToday && (
              <li data-kind="today">
                {t("오늘 · {date}", { date: formatDate(today) })}
              </li>
            )}
            {points.map((marker) => (
              <li key={marker.id} data-kind="marker">
                {t("{label} · {date}", {
                  label: marker.label,
                  date: formatDate(marker.date),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
