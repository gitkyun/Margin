import { t } from "@/lib/i18n";
import { formatClock } from "@/lib/time-format";
import { useRef } from "react";
import { BrandMark } from "@/components/brand/Brand";
import { useZoomInto } from "@/lib/use-zoom-into";
import { Icon } from "@/components/icons";
import { formatDate, relativeDay } from "@/lib/domain";
import type { OnboardingMeeting } from "@/lib/onboarding";

/** 상단 줄 메뉴 넷(IA v2 02 §3). 홈이 켜져 있습니다. */
const MENUS = [t("홈"), t("미팅"), t("할 일"), t("글·자료")];

export interface HomePreviewProps {
  name: string;
  description: string;
  /** 고른 단계 이름. 아직 답하지 않았으면 undefined, ‘나중에’면 null */
  phaseTitle?: string | null;
  /** 세 번째 질문에 답했는지와 그 결과(건너뛰면 null) */
  meeting?: OnboardingMeeting | null;
  leadLabel?: string;
  /** 지금 묻는 질문이 채우는 자리. 전체 화면에서 그 자리로 확대해 들어갑니다. */
  focus?: "name" | "phase" | "meeting";
  /** 첫 질문에서 적은 지도교수 수. 0이면 줄을 내지 않습니다. */
  advisorCount?: number;
}

/**
 * 온보딩 오른쪽의 연구 홈 미리보기(IA v2 07 §3): 상단 줄 + 머리 + 다음 미팅 카드 + 할 일 세 줄.
 * 답한 것만 글자로 채우고 나머지는 뼈대로 둡니다.
 * 누를 수 없는 그림이라 보조 기술에서는 숨기고, 반영된 내용은 온보딩 화면이 따로 읽어 줍니다.
 */
export function HomePreview({
  name,
  description,
  phaseTitle,
  meeting,
  leadLabel,
  focus,
  advisorCount = 0,
}: HomePreviewProps) {
  const title = name.trim();
  const frame = useRef<HTMLDivElement>(null);
  // 지금 묻는 질문이 채우는 자리로 전체 화면에서 확대해 들어갑니다.
  useZoomInto(frame, focus && `[data-part="${focus}"]`, focus ?? "whole", {
    zoomedValue: focus,
    // 답이 들어와 그 자리의 크기가 바뀌면 물러나지 않고 자리만 다시 맞춥니다.
    refitKey: [
      title,
      description.trim(),
      advisorCount,
      phaseTitle,
      meeting?.date,
      meeting?.title,
    ].join("|"),
  });
  return (
    <div className="ob-window" ref={frame} aria-hidden="true" inert>
      <div className="ob-window-canvas" data-zoom-canvas>
        <div className="ob-topbar">
          <BrandMark className="ob-rail-mark" />
          <span className={`ob-topbar-research ${title ? "ob-filled" : ""}`}>
            {title || <i className="ob-skel" />}
          </span>
          <span className="ob-topbar-menus">
            {MENUS.map((label, index) => (
              <span
                key={label}
                className={index === 0 ? "ob-topbar-current" : undefined}
              >
                {label}
              </span>
            ))}
          </span>
          <i className="ob-skel ob-topbar-search" />
        </div>
        <div className="ob-main">
          <div className="ob-head">
            <div className="ob-head-copy" data-part="name">
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
            </div>
            <div className="ob-chips">
              {phaseTitle ? (
                <span className="ob-chip ob-filled" data-part="phase">
                  <Icon name="flag" size={12} />
                  {t("현재 단계 {title}", { title: phaseTitle })}
                </span>
              ) : (
                (phaseTitle === undefined || focus === "phase") && (
                  <i className="ob-skel ob-skel-chip" data-part="phase" />
                )
              )}
              {advisorCount > 0 && (
                <span className="ob-chip ob-filled">
                  <Icon name="users" size={12} />
                  {t("지도교수 {count}명", { count: advisorCount })}
                </span>
              )}
            </div>
          </div>
          <div className="ob-card ob-card-meeting">
            <div className="ob-meeting-block" data-part="meeting">
              <span className="ob-card-label">
                <Icon name="calendar" size={12} />
                {t("다음 미팅")}
              </span>
              {meeting ? (
                <div className="ob-meeting ob-filled">
                  <span className="ob-meeting-copy">
                    <small>
                      {meeting.date ? formatDate(meeting.date) : t("날짜 미정")}
                      {meeting.time && ` · ${formatClock(meeting.time)}`}
                      {relativeDay(meeting.date) && (
                        <em>{relativeDay(meeting.date)}</em>
                      )}
                    </small>
                    <strong>{meeting.title}</strong>
                  </span>
                </div>
              ) : meeting === null ? (
                <span className="ob-empty ob-filled">
                  {t("다음 미팅이 아직 없어요")}
                </span>
              ) : (
                <>
                  <i className="ob-skel ob-skel-line" />
                  <i className="ob-skel ob-skel-short" />
                </>
              )}
            </div>
            {leadLabel ? (
              <span className="ob-lead ob-filled">{leadLabel}</span>
            ) : (
              <i className="ob-skel ob-skel-button" />
            )}
          </div>
          <div className="ob-card ob-card-list">
            <span className="ob-tabs">
              <b>{t("할 일")}</b>
              <span>{t("알림")}</span>
              <span>{t("최근 미팅")}</span>
            </span>
            {[0, 1, 2].map((row) => (
              <span className="ob-task" key={row}>
                <i className="ob-check" />
                <i className="ob-skel ob-skel-row" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
