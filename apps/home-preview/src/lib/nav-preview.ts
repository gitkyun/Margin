import { t } from "./i18n";
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
  if (!next) return t("예정된 미팅이 없어요.");
  if (!next.date) return t("다음 미팅 · 날짜 미정");
  return t("다음 미팅 {date} · {relative}", {
    date: formatDate(next.date),
    relative: relativeDay(next.date, today),
  });
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
      const open = mine(data.tasks).filter((task) => task.status !== "done");
      return summary(t("남은 할 일 {count}개", { count: open.length }));
    }
    case "planning": {
      const planned = mine(data.milestones).filter(
        (m) => m.status === "planned",
      );
      return summary(
        planned.length
          ? t("진행 중인 목표 {count}개", { count: planned.length })
          : t("단계와 주요 목표를 정해 보세요."),
      );
    }
    case "meetings":
      return summary(meetingDetail(mine(data.meetings), today));
    case "writing":
      return summary(
        t("문서 {count}개", { count: mine(data.documents).length }),
      );
    case "feedback": {
      const waiting = mine(data.feedback).filter(
        (f) => f.status === "unprocessed",
      );
      return summary(
        waiting.length
          ? t("아직 정리하지 않은 피드백 {count}개", { count: waiting.length })
          : t("정리할 피드백이 없어요."),
      );
    }
    case "materials":
      return summary(
        t("자료 {count}개", { count: mine(data.materials).length }),
      );
    case "reviews": {
      const shared = mine(data.reviews).filter((r) => r.status === "shared");
      return summary(
        t("공유 중인 검토 요청 {count}개", { count: shared.length }),
      );
    }
    default:
      return null;
  }
}
