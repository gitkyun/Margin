import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { formatDate, relativeDay, type Meeting } from "@/lib/domain";
import { formatClock } from "@/lib/time-format";
import { selectNextMeeting, seoulToday } from "@/lib/home-meeting";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

function when(meeting: Meeting): string {
  if (!meeting.date) return t("날짜 미정");
  const time = meeting.time ? formatClock(meeting.time) : "";
  if (meeting.date === seoulToday())
    return time ? t("오늘 {time}", { time }) : t("오늘");
  const day = formatDate(meeting.date);
  return [time ? `${day} ${time}` : day, relativeDay(meeting.date)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 미팅 화면에서 아무 기록도 고르지 않았을 때 오른쪽에 보여 주는 다음 미팅 미리보기.
 * 빈 안내 대신 바로 준비로 이어지게 해요. 다음 미팅이 없으면 짧은 안내만.
 */
export function NextMeetingPreview({ researchId }: { researchId: string }) {
  const { data } = useWorkspace();
  const research = data.researches.find((r) => r.id === researchId);
  const meetings = data.meetings.filter(
    (m) =>
      m.researchId === researchId && !m.archivedAt && m.status !== "cancelled",
  );
  const next = selectNextMeeting(meetings, research?.nextMeetingId);
  const base = `/r/${researchId}`;
  if (!next)
    return (
      <p className="meetings-placeholder">
        {t("왼쪽 목록에서 기록을 고르거나 새 기록을 추가해 주세요.")}
      </p>
    );
  const tasks = data.tasks.filter(
    (task) => next.taskIds.includes(task.id) && !task.archivedAt,
  );
  const done = tasks.filter((task) => task.status === "done").length;
  const questions = data.questions.filter(
    (q) => next.questionIds.includes(q.id) && !q.archivedAt,
  ).length;
  const summary = [
    tasks.length
      ? t("가져갈 할 일 {done}/{total} 끝냄", { done, total: tasks.length })
      : "",
    next.versionIds.length
      ? t("보여 줄 글·자료 {count}개", { count: next.versionIds.length })
      : "",
    questions ? t("질문 {count}개", { count: questions }) : "",
  ].filter(Boolean);
  return (
    <section className="meetings-next" aria-labelledby="meetings-next-heading">
      <h2 id="meetings-next-heading">{t("다음 미팅")}</h2>
      <p className="meetings-next-when">{when(next)}</p>
      <p className="meetings-next-title">{next.title}</p>
      <p className="meetings-next-summary">
        {summary.length ? summary.join(" · ") : t("아직 준비한 내용이 없어요.")}
      </p>
      <div className="meetings-next-actions">
        <Button asChild>
          <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
            {t("미팅 준비하기")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={`${base}/meetings/${next.id}`}>{t("기록 열기")}</Link>
        </Button>
      </div>
    </section>
  );
}
