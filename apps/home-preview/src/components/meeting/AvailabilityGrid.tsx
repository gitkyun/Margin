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
 * 가능 시간 격자. 열은 날짜, 줄은 시간대이고 칸 색이 진할수록 가능한 사람이 많아요.
 * 내 칸은 눌러서 가능/불가를 바꾸고, 가장 많은 사람이 가능한 칸에는 표시가 붙어요.
 * 데이터 계약은 그대로(후보 id 목록)이고 보기만 격자로 바꿔요.
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
  return (
    <div className="availability-grid-wrap">
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
