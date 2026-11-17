import { t } from "@/lib/i18n";
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
  일: t("일요일"),
  월: t("월요일"),
  화: t("화요일"),
  수: t("수요일"),
  목: t("목요일"),
  금: t("금요일"),
  토: t("토요일"),
};
const WEEKDAY_SHORT: Record<WeekDay["weekday"], string> = {
  일: t("일"),
  월: t("월"),
  화: t("화"),
  수: t("수"),
  목: t("목"),
  금: t("금"),
  토: t("토"),
};

function rangeLabel(days: WeekDay[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  const end =
    first.month === last.month
      ? t("{day}일", { day: last.day })
      : t("{month}월 {day}일", { month: last.month, day: last.day });
  return t("{month}월 {day}일 – {end}", {
    month: first.month,
    day: first.day,
    end,
  });
}

function timeLabel(time: string): string {
  return formatClock(time);
}

function countLabel(items: WeekItem[]): string {
  const meetings = items.filter((i) => i.kind === "meeting").length;
  const tasks = items.length - meetings;
  const parts = [
    meetings ? t("미팅 {count}개", { count: meetings }) : "",
    tasks ? t("마감 {count}개", { count: tasks }) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : t("일정 없음");
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
  /**
   * 할 일 화면(T1)에서 쓰는 거르기 모드. 주면 아래 일정 목록 대신 날짜를 눌러 그날로 거르고,
   * 같은 날을 다시 누르면 풉니다(IA v2 06 §3.1).
   */
  filterDay?: string | null;
  onFilterDay?(key: string | null): void;
}

/**
 * 홈 ‘다음 미팅’ 위 주간 띠. 일요일부터 7일, 오늘은 브랜드 원, 미팅(파랑)·마감(주황) 점은
 * 최대 3개. 날짜를 누르거나 방향키로 옮기면 아래에 그날 일정이 보입니다.
 * 색은 계획·일정 큰 캘린더와 같은 규칙입니다.
 */
export function WeekStrip({
  data,
  researchId,
  filterDay,
  onFilterDay,
}: WeekStripProps) {
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
            {t("오늘")}
          </Button>
        )}
        <div className="rh-week-nav">
          <IconButton
            label={t("지난주")}
            onClick={() => setSelected((key) => shiftDay(key, -WEEK))}
          >
            <Icon name="chevron-left" size={18} />
          </IconButton>
          <IconButton
            label={t("다음 주")}
            onClick={() => setSelected((key) => shiftDay(key, WEEK))}
          >
            <Icon name="chevron-right" size={18} />
          </IconButton>
        </div>
      </div>
      <div className="rh-week-days" role="group" aria-label={t("날짜 고르기")}>
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
            aria-pressed={
              onFilterDay ? d.key === filterDay : d.key === selected
            }
            aria-current={d.isToday ? "date" : undefined}
            aria-label={`${t("{month}월 {day}일 {weekday}", { month: d.month, day: d.day, weekday: WEEKDAY_NAMES[d.weekday] })}${d.isToday ? `, ${t("오늘")}` : ""}, ${countLabel(d.items)}`}
            onClick={() => {
              setSelected(d.key);
              onFilterDay?.(filterDay === d.key ? null : d.key);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="rh-week-weekday">{WEEKDAY_SHORT[d.weekday]}</span>
            <span className="rh-week-number">{d.day}</span>
            <span className="rh-week-dots" aria-hidden="true">
              {d.items.slice(0, MAX_DOTS).map((item) => (
                <i key={item.kind + item.id} className={`is-${item.kind}`} />
              ))}
            </span>
          </button>
        ))}
      </div>
      {!onFilterDay && (
        <div className="rh-week-agenda" aria-live="polite">
          <p className="rh-week-agenda-date">
            {t("{month}월 {day}일 {weekday}", {
              month: day.month,
              day: day.day,
              weekday: WEEKDAY_NAMES[day.weekday],
            })}
            {day.isToday && <span>{t("오늘")}</span>}
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
                          : t("미팅")
                        : t("마감")}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rh-week-empty">{t("이날은 미팅도 마감도 없어요.")}</p>
          )}
        </div>
      )}
    </section>
  );
}
