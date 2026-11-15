import { dateLocale, t } from "@/lib/i18n";
import type { MeetingPoll } from "@/lib/domain";
import { timeParts } from "@/lib/time-format";
import { pollGrid } from "@/lib/poll-grid";
import { Icon } from "../icons";
import "./meeting.css";

export interface AvailabilityGridProps {
  poll: MeetingPoll;
  /** 지금 내가 고른 가능한 후보 id(저장 전 선택 포함) */
  available: readonly string[];
  /** 내가 참석자이고 조율 중일 때만 true */
  editable: boolean;
  onToggle(optionId: string, next: boolean): void;
  /** 꺼진 이유 문구의 id(aria-describedby) */
  describedBy?: string;
}

const day = (date: Date) =>
  date.toLocaleDateString(dateLocale(), {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
const clock = (date: Date) =>
  date.toLocaleTimeString(dateLocale(), timeParts());

/**
 * 가능 시간 격자 + 투표 기반 확정 요약(Kokonut AI Schedule 패턴).
 * 캘린더 연동 없이 참여자 투표 수를 바탕으로 가능한 후보를 한눈에 비교해요.
 */
export function AvailabilityGrid({
  poll,
  available,
  editable,
  onToggle,
  describedBy,
}: AvailabilityGridProps) {
  const grid = pollGrid(poll.options, poll.participants);
  const total = poll.participants.length;
  if (!grid.rows.length) return null;

  const ranked = [...poll.options]
    .map((option) => {
      const count = poll.participants.filter((p) =>
        p.available.includes(option.id),
      ).length;
      return { option, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="availability-grid-wrap">
      {ranked.length > 0 && (
        <div
          className="availability-vote-summary"
          aria-label={t("투표 결과 요약")}
        >
          {ranked.map(({ option, count }) => {
            const start = new Date(option.start);
            const confirmed = poll.selectedOptionId === option.id;
            const ratio = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div
                key={option.id}
                className={`availability-vote-card${confirmed ? " is-confirmed" : ""}`}
              >
                <div className="availability-vote-head">
                  <strong>
                    {day(start)} · {clock(start)}
                  </strong>
                  <span>
                    {confirmed
                      ? t("확정됨")
                      : t("{count}/{total}명 가능", { count, total })}
                  </span>
                </div>
                <div className="availability-vote-bar" aria-hidden="true">
                  <i style={{ width: `${ratio}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <table className="availability-grid">
        <caption className="sr-only">
          {t("가능한 시간 격자. 칸을 누르면 내 가능 여부가 바뀌어요.")}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{t("시간대")}</span>
            </th>
            {grid.days.map((d) => (
              <th scope="col" key={d.key}>
                {day(d.date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {clock(row.start)}
                <small>{clock(row.end)}</small>
              </th>
              {row.cells.map((cell, i) => {
                if (!cell)
                  return <td key={grid.days[i].key} className="is-empty" />;
                const mine = available.includes(cell.option.id);
                const confirmed = poll.selectedOptionId === cell.option.id;
                const summary = t("{day} {time}, {count}/{total}명 가능", {
                  day: day(grid.days[i].date),
                  time: clock(row.start),
                  count: cell.count,
                  total,
                });
                return (
                  <td key={cell.option.id}>
                    <button
                      type="button"
                      className="availability-cell"
                      data-level={cell.level}
                      data-best={cell.best || undefined}
                      data-confirmed={confirmed || undefined}
                      aria-pressed={mine}
                      aria-label={`${summary}${mine ? ` · ${t("나 가능")}` : ""}${confirmed ? ` · ${t("확정된 시간")}` : ""}`}
                      aria-describedby={describedBy}
                      disabled={!editable}
                      onClick={() => onToggle(cell.option.id, !mine)}
                    >
                      {mine && <Icon name="check" size={14} />}
                      <span>
                        {cell.count}/{total}
                      </span>
                      {confirmed ? (
                        <small>{t("확정")}</small>
                      ) : (
                        cell.best && <small>{t("가장 많음")}</small>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="availability-legend">
        <span data-level="1" />
        {t("적음")}
        <span data-level="4" />
        {t("많음")}
        <span className="availability-legend-mine">
          <Icon name="check" size={13} />
          {t("내가 가능")}
        </span>
      </p>
    </div>
  );
}
