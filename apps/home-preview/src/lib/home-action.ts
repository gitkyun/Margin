import { t } from "./i18n";
import { kstDateKey, type Feedback, type Meeting } from "./domain";

export type HomeActionKind =
  | "return_to_recording"
  | "record_meeting"
  | "open_review_response"
  | "record_past_meeting"
  | "sort_feedback"
  | "prepare_meeting"
  | "create_meeting";

export interface HomeAction {
  kind: HomeActionKind;
  label: string;
  href: string;
  icon: string;
  /**
   * 알림 줄에 둘 문장(IA v2 03 §3의 1·3·4·5번). 있으면 파란 버튼은 알림 줄에 가고
   * 다음 미팅 카드의 버튼은 테두리 버튼이 됩니다. 없으면 버튼은 다음 미팅 카드에 있습니다.
   */
  notice?: string;
}

/** 내가 안 읽은 교수 응답 가운데 '추가 수정 필요'인 것(lib/notifications.ts에서 고름). */
export interface UnreadChangesRequest {
  title: string;
  href: string;
  createdAt: string;
}

export interface HomeActionInput {
  /** 연구 경로(`/r/:id`) */
  base: string;
  /** 오늘 날짜(YYYY-MM-DD, 서울 기준) */
  today: string;
  /** 지금 시각(HH:MM, 서울 기준). 오늘 미팅의 시각이 지났는지 볼 때 씁니다. */
  now: string;
  /** 이 탭에서 녹음 중인 기록(RecordingProvider). 녹음 중은 저장하지 않습니다(08 §7). */
  recordingMeetingId?: string | null;
  /** 홈의 ‘다음 미팅’(selectNextMeeting 결과) */
  next?: Meeting;
  /** 이 연구의 미팅(휴지통·취소 제외) */
  meetings: Meeting[];
  /** 이 연구의 피드백 */
  feedback: Pick<Feedback, "meetingId" | "archivedAt">[];
  /** 내가 안 읽은 '추가 수정 필요' 교수 응답 */
  unreadChangesRequested?: UnreadChangesRequest[];
}

const DAY = 24 * 60 * 60 * 1000;

function daysBefore(today: string, days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - days * DAY)
    .toISOString()
    .slice(0, 10);
}

/** 날짜·시각이 지금보다 앞인 미팅. 시각이 없는 오늘 미팅은 아직 지나지 않은 것으로 봅니다. */
function isPast(meeting: Meeting, today: string, now: string): boolean {
  if (!meeting.date) return false;
  if (meeting.date < today) return true;
  return meeting.date === today && !!meeting.time && meeting.time < now;
}

function hasPreparation(meeting: Meeting): boolean {
  return (
    !!meeting.goal.trim() ||
    meeting.taskIds.length > 0 ||
    meeting.versionIds.length > 0 ||
    meeting.questionIds.length > 0
  );
}

const byLatest = (a: Meeting, b: Meeting) =>
  `${b.date ?? ""} ${b.time ?? ""}`.localeCompare(
    `${a.date ?? ""} ${a.time ?? ""}`,
  );

/**
 * 연구 홈의 주 행동을 하나만 고릅니다(IA v2 03 §3). 위에서부터 처음 맞는 것이
 * 화면의 유일한 파란 채움 버튼이 됩니다. 저장된 기록만 보고, AI는 부르지 않습니다.
 *
 * 1 녹음 중 → 2 오늘 아직 안 한 미팅 → 3 안 읽은 '추가 수정 필요' → 4 최근 14일 기록 없는
 * 지난 미팅 → 5 최근 7일 기록했지만 피드백이 없는 기록 → 6 다음 미팅 준비 → 7 다음 미팅 잡기
 */
export function selectHomeAction({
  base,
  today,
  now,
  recordingMeetingId,
  next,
  meetings,
  feedback,
  unreadChangesRequested = [],
}: HomeActionInput): HomeAction {
  const live = meetings.filter((meeting) => !meeting.archivedAt);

  // 1. 녹음 중인 기록
  const recording = recordingMeetingId
    ? live.find((meeting) => meeting.id === recordingMeetingId)
    : undefined;
  if (recording) {
    return {
      kind: "return_to_recording",
      label: t("기록으로 돌아가기"),
      href: `${base}/meetings/${recording.id}?tab=record#meeting-recording`,
      icon: "mic",
      notice: t("지금 녹음 중이에요."),
    };
  }

  // 2. 오늘이고 시각이 지금 이후이거나 없는 준비 중 미팅
  const todayMeeting = live
    .filter(
      (meeting) =>
        meeting.status === "preparing" &&
        meeting.date === today &&
        !isPast(meeting, today, now),
    )
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))[0];
  if (todayMeeting) {
    return {
      kind: "record_meeting",
      label: t("녹음 시작"),
      href: `${base}/meetings/${todayMeeting.id}?tab=record#meeting-recording`,
      icon: "mic",
    };
  }

  // 3. 안 읽은 '추가 수정 필요' 교수 응답(가장 최근 것)
  const changes = [...unreadChangesRequested].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  if (changes) {
    return {
      kind: "open_review_response",
      label: t("교수 응답 보기"),
      href: changes.href,
      icon: "feedback",
      notice: t("교수님이 ‘{title}’에 추가 수정 필요를 남겼어요.", {
        title: changes.title,
      }),
    };
  }

  // 4. 최근 14일 안에 날짜·시각이 지났는데 기록이 없는 미팅
  const since14 = daysBefore(today, 14);
  const unrecorded = live
    .filter(
      (meeting) =>
        meeting.status === "preparing" &&
        isPast(meeting, today, now) &&
        (meeting.date ?? "") >= since14,
    )
    .sort(byLatest)[0];
  if (unrecorded?.date) {
    const [, month, day] = unrecorded.date.split("-").map(Number);
    return {
      kind: "record_past_meeting",
      label: t("지난 미팅 기록 남기기"),
      href: `${base}/meetings/${unrecorded.id}?tab=record`,
      icon: "edit",
      notice: t("{month}월 {day}일 미팅 기록이 아직 없어요.", { month, day }),
    };
  }

  // 5. 최근 7일 안에 기록했는데 피드백이 하나도 없는 기록
  const since7 = daysBefore(today, 7);
  const sorted = new Set(
    feedback.filter((item) => !item.archivedAt).map((item) => item.meetingId),
  );
  const unsorted = live
    .filter(
      (meeting) =>
        meeting.status === "recorded" &&
        kstDateKey(meeting.updatedAt) >= since7 &&
        !sorted.has(meeting.id),
    )
    .sort(byLatest)[0];
  if (unsorted) {
    return {
      kind: "sort_feedback",
      label: t("기록 정리하기"),
      href: `${base}/meetings/${unsorted.id}?tab=record`,
      icon: "feedback",
      notice: t("지난 미팅에서 나온 할 일을 아직 정리하지 않았어요."),
    };
  }

  // 6. 다음 미팅이 있음
  if (next) {
    return {
      kind: "prepare_meeting",
      label: hasPreparation(next) ? t("준비 이어하기") : t("미팅 준비하기"),
      href: `${base}/meetings/${next.id}?tab=prepare`,
      icon: "calendar",
    };
  }

  // 7. 다음 미팅이 없음
  return {
    kind: "create_meeting",
    label: t("다음 미팅 잡기"),
    href: `${base}/meetings?new=1`,
    icon: "plus",
  };
}
