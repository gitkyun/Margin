import { BrandMark } from "@/components/brand/Brand";
import { Icon } from "@/components/icons";
import { formatDate, relativeDay } from "@/lib/domain";
import type { OnboardingMeeting } from "@/lib/onboarding";

const NAV_ICONS = ["home", "flag", "calendar", "edit", "feedback", "tasks"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export interface HomePreviewProps {
  name: string;
  description: string;
  /** 고른 단계 이름. 아직 답하지 않았으면 undefined, ‘나중에’면 null */
  phaseTitle?: string | null;
  /** 세 번째 질문에 답했는지와 그 결과(건너뛰면 null) */
  meeting?: OnboardingMeeting | null;
  leadLabel?: string;
  today: string;
}

/** 오늘이 든 주(일~토)의 날짜 문자열 일곱 개 */
function weekOf(today: string): string[] {
  const start = new Date(`${today}T12:00:00`);
  start.setDate(start.getDate() - start.getDay());
  return WEEKDAYS.map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const month = String(day.getMonth() + 1).padStart(2, "0");
    const date = String(day.getDate()).padStart(2, "0");
    return `${day.getFullYear()}-${month}-${date}`;
  });
}

/**
 * 온보딩 오른쪽의 연구 홈 미리보기. 답한 것만 글자로 채우고 나머지는 뼈대로 둡니다.
 * 누를 수 없는 그림이라 보조 기술에서는 숨기고, 반영된 내용은 온보딩 화면이 따로 읽어 줍니다.
 */
export function HomePreview({
  name,
  description,
  phaseTitle,
  meeting,
  leadLabel,
  today,
}: HomePreviewProps) {
  const title = name.trim();
  const week = weekOf(today);
  return (
    <div className="ob-window" aria-hidden="true" inert>
      <div className="ob-rail">
        <BrandMark className="ob-rail-mark" />
        <span className={`ob-rail-research ${title ? "ob-filled" : ""}`}>
          {title || <i className="ob-skel" />}
        </span>
        {NAV_ICONS.map((icon, index) => (
          <span
            className={`ob-rail-item ${index === 0 ? "ob-rail-current" : ""}`}
            key={icon}
          >
            <Icon name={icon} size={14} />
            <i className="ob-skel" />
          </span>
        ))}
      </div>
      <div className="ob-main">
        <div className="ob-head">
          <div className="ob-head-copy">
            {title ? (
              <strong className="ob-title ob-filled">{title}</strong>
            ) : (
              <i className="ob-skel ob-skel-title" />
            )}
            {description.trim() ? (
              <span className="ob-description ob-filled">
                {description.trim()}
              </span>
            ) : (
              <i className="ob-skel ob-skel-line" />
            )}
            {phaseTitle ? (
              <span className="ob-phase ob-filled">
                <Icon name="flag" size={12} />
                현재 단계 · {phaseTitle}
              </span>
            ) : (
              phaseTitle === undefined && (
                <i className="ob-skel ob-skel-short" />
              )
            )}
          </div>
          {leadLabel ? (
            <span className="ob-lead ob-filled">{leadLabel}</span>
          ) : (
            <i className="ob-skel ob-skel-button" />
          )}
        </div>
        <div className="ob-columns">
          <div className="ob-card ob-card-meeting">
            <span className="ob-card-label">
              <Icon name="calendar" size={12} />
              다음 미팅
            </span>
            {meeting ? (
              <div className="ob-meeting ob-filled">
                <span className="ob-date">
                  {meeting.date ? (
                    <>
                      <small>{Number(meeting.date.slice(5, 7))}월</small>
                      <strong>{Number(meeting.date.slice(8, 10))}</strong>
                    </>
                  ) : (
                    <>
                      <small>날짜</small>
                      <strong>미정</strong>
                    </>
                  )}
                </span>
                <span className="ob-meeting-copy">
                  <small>
                    {formatDate(meeting.date)}
                    {meeting.time && ` · ${meeting.time}`}
                    {relativeDay(meeting.date) && (
                      <em>{relativeDay(meeting.date)}</em>
                    )}
                  </small>
                  <strong>{meeting.title}</strong>
                </span>
              </div>
            ) : meeting === null ? (
              <span className="ob-empty ob-filled">
                다음 미팅이 아직 없어요
              </span>
            ) : (
              <>
                <i className="ob-skel ob-skel-line" />
                <i className="ob-skel ob-skel-short" />
              </>
            )}
            <i className="ob-skel ob-skel-row" />
            <i className="ob-skel ob-skel-row" />
          </div>
          <div className="ob-side">
            <div className="ob-card">
              <span className="ob-card-label">이번 주</span>
              <div className="ob-week">
                {week.map((date, index) => (
                  <span
                    key={date}
                    className={date === today ? "ob-week-today" : ""}
                  >
                    <small>{WEEKDAYS[index]}</small>
                    <b>{Number(date.slice(8, 10))}</b>
                    <i
                      className={
                        meeting?.date === date ? "ob-week-dot ob-filled" : ""
                      }
                    />
                  </span>
                ))}
              </div>
            </div>
            <div className="ob-card">
              <span className="ob-card-label">남은 할 일</span>
              <i className="ob-skel ob-skel-row" />
              <i className="ob-skel ob-skel-row" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
