import { t } from "@/lib/i18n";
import type { WorkspaceData } from "./domain";

/** 온보딩 세 번째 질문(다음 지도 미팅)의 답 */
export type MeetingAnswer =
  | { kind: "dated"; date: string; time: string }
  | { kind: "undated" }
  | { kind: "just_finished" }
  | { kind: "skip" };

export interface OnboardingMeeting {
  title: string;
  date: string | null;
  time: string | null;
}

const MEETING_TITLE = t("지도 미팅");

/** 답을 미팅 한 건으로 바꿉니다. 건너뛰면 만들지 않습니다. */
export function onboardingMeeting(
  answer: MeetingAnswer | null,
  today: string,
  /** 지금 시각(HH:MM). '방금 마친' 미팅은 이 시각으로 남겨 홈에서 '지난 미팅 기록 남기기'가 되게 합니다(IA v2 03 §3). */
  now?: string,
): OnboardingMeeting | null {
  if (!answer || answer.kind === "skip") return null;
  if (answer.kind === "just_finished")
    return { title: MEETING_TITLE, date: today, time: now ?? null };
  if (answer.kind === "dated" && answer.date)
    return {
      title: MEETING_TITLE,
      date: answer.date,
      time: answer.time || null,
    };
  return { title: MEETING_TITLE, date: null, time: null };
}

/** 미리보기에 보여 줄 홈의 주 행동 글자. lib/home-action.ts와 같은 규칙입니다. */
export function onboardingLeadLabel(
  answer: MeetingAnswer | null,
  today: string,
): string {
  const meeting = onboardingMeeting(answer, today);
  if (!meeting) return t("다음 미팅 잡기");
  if (answer?.kind === "just_finished") return t("지난 미팅 기록 남기기");
  return meeting.date === today ? t("녹음 시작") : t("미팅 준비하기");
}

export type ChecklistKey = "record" | "feedback" | "task" | "material";

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export type ChecklistData = Pick<
  WorkspaceData,
  "meetings" | "recordings" | "feedback" | "tasks" | "documents" | "materials"
>;

/**
 * 시작 체크리스트. 새로 저장하는 값 없이 있는 기록에서 완료 여부를 계산합니다.
 * (docs/design/product-design-plan.md 5.6)
 */
export function startChecklist(
  data: ChecklistData,
  researchId: string,
): ChecklistItem[] {
  const base = `/r/${researchId}`;
  const mine = <T extends { researchId: string; archivedAt?: string }>(
    list: T[],
  ) =>
    list.filter((item) => item.researchId === researchId && !item.archivedAt);
  const meetings = mine(data.meetings);
  const recorded = new Set(mine(data.recordings).map((item) => item.meetingId));
  const hasRecord = meetings.some(
    (meeting) => !!meeting.memo?.trim() || recorded.has(meeting.id),
  );
  const firstMeeting = meetings[0];
  return [
    {
      key: "record",
      label: t("미팅 기록 남기기"),
      hint: t("녹음하거나 메모를 붙여 넣어요."),
      href: firstMeeting
        ? `${base}/meetings/${firstMeeting.id}?tab=record#meeting-recording`
        : `${base}/meetings?new=1&intent=record`,
      done: hasRecord,
    },
    {
      key: "feedback",
      label: t("피드백 한 건 정리하기"),
      hint: t("받은 피드백을 원문과 함께 남겨요."),
      href: `${base}/feedback`,
      done: mine(data.feedback).length > 0,
    },
    {
      key: "task",
      label: t("할 일 추가"),
      hint: t("다음 미팅까지 할 일을 적어요."),
      href: `${base}/tasks?new=1`,
      done: mine(data.tasks).length > 0,
    },
    {
      key: "material",
      label: t("원고나 자료 올리기"),
      hint: t("글을 쓰거나 파일을 올려요."),
      href: `${base}/materials`,
      done: mine(data.documents).length > 0 || mine(data.materials).length > 0,
    },
  ];
}
