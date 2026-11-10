import { formatClock } from "@/lib/time-format";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { Icon } from "../icons";
import { IconButton } from "../common";
import { Button } from "../ui/button";
import type { WorkspaceData } from "@/lib/domain";
import {
  buildWeek,
  seoulTodayKey,
  shiftDay,
  weekKeys,
  type WeekDay,
  type WeekItem,
} from "@/lib/week-strip";
import "./week-strip.css";

const MAX_DOTS = 3;
const WEEK = 7;
const WEEKDAY_NAMES: Record<WeekDay["weekday"], string> = {
  일: "일요일",
  월: "월요일",
  화: "화요일",
  수: "수요일",
  목: "목요일",
  금: "금요일",
  토: "토요일",
};

function rangeLabel(days: WeekDay[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  const end =
    first.month === last.month
      ? `${last.day}일`
      : `${last.month}월 ${last.day}일`;
  return `${first.month}월 ${first.day}일 – ${end}`;
}

function timeLabel(time: string): string {
  return formatClock(time);
}

function countLabel(items: WeekItem[]): string {
  const meetings = items.filter((i) => i.kind === "meeting").length;
  const tasks = items.length - meetings;
  const parts = [
    meetings ? `미팅 ${meetings}개` : "",
    tasks ? `마감 ${tasks}개` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "일정 없음";
}

/** 키보드로 날짜를 옮길 때 몇 칸 갈지. 해당 키가 아니면 null */
function keyDelta(key: string, index: number): number | null {
  switch (key) {
    case "ArrowLeft":
      return -1;
    case "ArrowRight":
      return 1;
    case "PageUp":
      return -WEEK;
    case "PageDown":
      return WEEK;
    case "Home":
      return -index;
    case "End":
      return WEEK - 1 - index;
    default:
      return null;
  }
}

interface WeekStripProps {
  data: Pick<WorkspaceData, "meetings" | "tasks">;
  researchId: string;
}

/**
 * 홈 ‘다음 미팅’ 위 주간 띠. 일요일부터 7일, 오늘은 브랜드 원, 미팅(파랑)·마감(주황) 점은
 * 최대 3개. 날짜를 누르거나 방향키로 옮기면 아래에 그날 일정이 보입니다.
 * 색은 계획·일정 큰 캘린더와 같은 규칙입니다.
 */
export function WeekStrip({ data, researchId }: WeekStripProps) {
  const today = seoulTodayKey();
  const [selected, setSelected] = useState(today);
  const moved = useRef(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const days = useMemo(
    () => buildWeek({ data, researchId, anchorKey: selected, todayKey: today }),
    [data, researchId, selected, today],
  );
  const day = days.find((d) => d.key === selected) ?? days[0];
  const showsToday = weekKeys(selected).includes(today);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    buttons.current.get(selected)?.focus();
  }, [selected]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = keyDelta(event.key, index);
    if (delta === null) return;
    event.preventDefault();
    moved.current = true;
    setSelected((key) => shiftDay(key, delta));
  }

  return (
    <section className="rh-week" aria-labelledby="rh-week-heading">
      <div className="rh-week-head">
        <h2 id="rh-week-heading">{rangeLabel(days)}</h2>
        {!showsToday && (
          <Button variant="link" size="sm" onClick={() => setSelected(today)}>
            오늘
          </Button>
        )}
        <div className="rh-week-nav">
          <IconButton
            label="지난주"
            onClick={() => setSelected((key) => shiftDay(key, -WEEK))}
          >
            <Icon name="chevron-left" size={18} />
          </IconButton>
          <IconButton
            label="다음 주"
            onClick={() => setSelected((key) => shiftDay(key, WEEK))}
          >
            <Icon name="chevron-right" size={18} />
          </IconButton>
        </div>
      </div>
      <div className="rh-week-days" role="group" aria-label="날짜 고르기">
        {days.map((d, index) => (
          <button
            key={d.key}
            type="button"
            ref={(node) => {
              if (node) buttons.current.set(d.key, node);
              else buttons.current.delete(d.key);
            }}
            className="rh-week-day"
            tabIndex={d.key === selected ? 0 : -1}
            aria-pressed={d.key === selected}
            aria-current={d.isToday ? "date" : undefined}
            aria-label={`${d.month}월 ${d.day}일 ${WEEKDAY_NAMES[d.weekday]}${d.isToday ? ", 오늘" : ""}, ${countLabel(d.items)}`}
            onClick={() => setSelected(d.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="rh-week-weekday">{d.weekday}</span>
            <span className="rh-week-number">{d.day}</span>
            <span className="rh-week-dots" aria-hidden="true">
              {d.items.slice(0, MAX_DOTS).map((item) => (
                <i key={item.kind + item.id} className={`is-${item.kind}`} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="rh-week-agenda" aria-live="polite">
        <p className="rh-week-agenda-date">
          {day.month}월 {day.day}일 {WEEKDAY_NAMES[day.weekday]}
          {day.isToday && <span>오늘</span>}
        </p>
        {day.items.length ? (
          <ul>
            {day.items.map((item) => (
              <li key={item.kind + item.id}>
                <Link className="rh-week-item" to={item.href}>
                  <i className={`is-${item.kind}`} aria-hidden="true" />
                  <strong>{item.title}</strong>
                  <small>
                    {item.kind === "meeting"
                      ? item.time
                        ? timeLabel(item.time)
                        : "미팅"
                      : "마감"}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rh-week-empty">이날은 미팅도 마감도 없어요.</p>
        )}
      </div>
    </section>
  );
}
