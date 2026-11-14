import { t } from "./i18n";
import type { Feedback, Meeting } from "./domain";

export type HomeActionKind =
  | "record_meeting"
  | "prepare_meeting"
  | "record_past_meeting"
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
}

/**
 * 연구 홈 머리에 올릴 주 행동을 하나만 고릅니다.
 * 순서: 오늘 미팅 기록 → 미팅 준비 → 지난 미팅 피드백 정리 → 미팅 만들기.
 * 읽지 않은 교수 응답은 '확인할 내용' 카드가 맡아서 여기서 고르지 않습니다(감사 C5·결정 D4).
 * (docs/design/product-design-plan.md 6절)
 */
export function selectHomeAction({
  base,
  today,
  next,
  meetings,
  feedback,
}: HomeActionInput): HomeAction {
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
  // 날짜가 지났는데 기록하지 않은 미팅은 '준비 중'에 머물러 홈에서 사라졌어요(감사 A10).
  const unrecorded = meetings
    .filter(
      (meeting) =>
        meeting.status === "preparing" &&
        !meeting.archivedAt &&
        !!meeting.date &&
        meeting.date < today,
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  if (unrecorded) {
    return {
      kind: "record_past_meeting",
      label: t("지난 미팅 기록 남기기"),
      href: `${base}/meetings/${unrecorded.id}?tab=record`,
      icon: "edit",
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
