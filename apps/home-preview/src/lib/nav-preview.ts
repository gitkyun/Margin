import { formatDate, relativeDay, type WorkspaceData } from "./domain";
import { selectNextMeeting } from "./home-meeting";

export type NavPreview = { title: string; detail: string };

export type PreviewData = Pick<
  WorkspaceData,
  | "meetings"
  | "tasks"
  | "feedback"
  | "documents"
  | "materials"
  | "reviews"
  | "milestones"
>;

type Scoped = { researchId: string; deletedAt?: string };

const inResearch =
  (researchId: string) =>
  <T extends Scoped>(items: T[]): T[] =>
    items.filter((item) => item.researchId === researchId && !item.deletedAt);

function meetingDetail(
  meetings: WorkspaceData["meetings"],
  today: Date,
): string {
  const todayKey = today.toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
  const next = selectNextMeeting(meetings, null, todayKey);
  if (!next) return "예정된 미팅이 없어요.";
  if (!next.date) return "다음 미팅 · 날짜 미정";
  return `다음 미팅 ${formatDate(next.date)} · ${relativeDay(next.date, today)}`;
}

/**
 * 사이드바 메뉴에 올렸을 때 보여 줄 한 줄 요약. 숫자는 지금 연구의 기록에서만 셉니다.
 * 요약할 것이 없는 메뉴는 null을 돌려주고, 이때는 메뉴 이름만 보여 줍니다.
 */
export function navPreview(
  path: string,
  label: string,
  data: PreviewData,
  researchId: string,
  today: Date = new Date(),
): NavPreview | null {
  const mine = inResearch(researchId);
  const summary = (detail: string): NavPreview => ({ title: label, detail });
  switch (path) {
    case "": {
      const open = mine(data.tasks).filter((t) => t.status !== "done");
      return summary(`남은 할 일 ${open.length}개`);
    }
    case "planning": {
      const planned = mine(data.milestones).filter(
        (m) => m.status === "planned",
      );
      return summary(
        planned.length
          ? `진행 중인 목표 ${planned.length}개`
          : "단계와 주요 목표를 정해 보세요.",
      );
    }
    case "meetings":
      return summary(meetingDetail(mine(data.meetings), today));
    case "writing":
      return summary(`문서 ${mine(data.documents).length}개`);
    case "feedback": {
      const waiting = mine(data.feedback).filter(
        (f) => f.status === "unprocessed",
      );
      return summary(
        waiting.length
          ? `아직 정리하지 않은 피드백 ${waiting.length}개`
          : "정리할 피드백이 없어요.",
      );
    }
    case "materials":
      return summary(`자료 ${mine(data.materials).length}개`);
    case "reviews": {
      const shared = mine(data.reviews).filter((r) => r.status === "shared");
      return summary(`공유 중인 검토 요청 ${shared.length}개`);
    }
    default:
      return null;
  }
}
