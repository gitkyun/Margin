import { t } from "./i18n";
import type { Feedback, Meeting } from "./domain";

export type HomeActionKind =
  | "check_responses"
  | "record_meeting"
  | "prepare_meeting"
  | "sort_feedback"
  | "create_meeting";

export interface HomeAction {
  kind: HomeActionKind;
  label: string;
  href: string;
  icon: string;
}

export interface HomeActionInput {
  /** 연구 경로(`/r/:id`) */
  base: string;
  /** 오늘 날짜(YYYY-MM-DD, 서울 기준) */
  today: string;
  /** 홈의 ‘다음 미팅’(selectNextMeeting 결과) */
  next?: Meeting;
  /** 이 연구의 미팅(휴지통·취소 제외) */
  meetings: Meeting[];
  /** 이 연구의 피드백 */
  feedback: Pick<Feedback, "meetingId" | "archivedAt">[];
  /** 읽지 않은 교수 응답·검토 댓글이 있으면 그중 첫 번째로 가는 경로 */
  updateHref?: string;
}

/**
 * 연구 홈 머리에 올릴 주 행동을 하나만 고릅니다.
 * 순서: 확인할 응답 → 오늘 미팅 기록 → 미팅 준비 → 지난 미팅 피드백 정리 → 미팅 만들기.
 * (docs/design/product-design-plan.md 6절)
 */
export function selectHomeAction({
  base,
  today,
  next,
  meetings,
  feedback,
  updateHref,
}: HomeActionInput): HomeAction {
  if (updateHref) {
    return {
      kind: "check_responses",
      label: t("응답 확인하기"),
      href: updateHref,
      icon: "feedback",
    };
  }
  if (next && (next.status === "recording" || next.date === today)) {
    return {
      kind: "record_meeting",
      label: t("기록 시작"),
      href: `${base}/meetings/${next.id}?tab=record#meeting-recording`,
      icon: "mic",
    };
  }
  if (next) {
    return {
      kind: "prepare_meeting",
      label: t("미팅 준비하기"),
      href: `${base}/meetings/${next.id}?tab=prepare`,
      icon: "calendar",
    };
  }
  const sorted = new Set(
    feedback.filter((item) => !item.archivedAt).map((item) => item.meetingId),
  );
  const unsorted = meetings
    .filter(
      (meeting) =>
        meeting.status === "recorded" &&
        !meeting.archivedAt &&
        !sorted.has(meeting.id),
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  if (unsorted) {
    return {
      kind: "sort_feedback",
      label: t("피드백 정리하기"),
      href: `${base}/meetings/${unsorted.id}?tab=record`,
      icon: "feedback",
    };
  }
  return {
    kind: "create_meeting",
    label: t("미팅 만들기"),
    href: `${base}/meetings?new=1`,
    icon: "plus",
  };
}
