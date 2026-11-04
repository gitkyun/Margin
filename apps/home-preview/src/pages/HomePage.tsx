import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import {
  formatDate,
  taskLabels,
  responseLabels,
  type Task,
} from "@/lib/domain";
import { friendlyError } from "@/lib/supabase";
import { toggleDone } from "@/lib/task-status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common";
function HomeTask({ task }: { task: Task }) {
  const { save } = useWorkspace();
  const [pending, setPending] = useState(false);
  return (
    <div className={`home-task ${task.status === "done" ? "is-done" : ""}`}>
      <Checkbox
        aria-label={`${task.title} 완료 상태 변경`}
        disabled={pending}
        checked={task.status === "done"}
        onCheckedChange={async () => {
          setPending(true);
          try {
            await save("tasks", { ...task, status: toggleDone(task.status) });
          } catch (e) {
            toast.error(friendlyError(e));
          } finally {
            setPending(false);
          }
        }}
      />
      <div>
        <strong>
          <Link to={`/r/${task.researchId}/tasks/${task.id}`}>
            {task.title}
          </Link>
        </strong>
        <span>{task.description}</span>
      </div>
      <StatusBadge tone={task.status === "doing" ? "blue" : "neutral"}>
        {taskLabels[task.status]}
      </StatusBadge>
      <span className="task-date">
        {task.dueDate
          ? new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
            })
          : "기한 미정"}
      </span>
    </div>
  );
}
export function HomePage() {
  const { researchId } = useParams();
  const { data, user } = useWorkspace();
  const research = data.researches.find((r) => r.id === researchId);
  const meetings = data.meetings.filter((m) => m.researchId === researchId);
  const next =
    meetings.find(
      (m) =>
        m.id === research?.nextMeetingId &&
        (m.status === "preparing" || m.status === "recording"),
    ) ??
    meetings
      .filter((m) => m.status === "preparing")
      .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))[0];
  const tasks = next
    ? next.taskIds.flatMap((id) =>
        data.tasks.filter((t) => t.id === id && t.researchId === researchId),
      )
    : data.tasks.filter((t) => t.researchId === researchId);
  const recording = meetings.find((m) => m.status === "recording") ?? next;
  const questions = data.questions.filter(
    (q) =>
      q.researchId === researchId &&
      q.status === "open" &&
      (!next || next.questionIds.includes(q.id)),
  );
  const requests = data.reviews.filter((r) => r.researchId === researchId);
  const rounds = data.rounds.filter((r) =>
    requests.some((request) => request.id === r.requestId),
  );
  const responses = data.responses
    .filter((r) => rounds.some((round) => round.id === r.roundId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const previous = meetings
    .filter((m) => m.status === "recorded")
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  const versions = data.versions.filter((v) => next?.versionIds.includes(v.id));
  const base = `/r/${researchId}`;
  if (!research)
    return (
      <EmptyState
        title="연구를 찾을 수 없습니다."
        action={
          <Button asChild>
            <Link to="/r">내 연구 보기</Link>
          </Button>
        }
      />
    );
  return (
    <>
      <PageHeader
        title="연구 홈"
        description="다음 미팅에서 보여줄 결과와 남은 작업을 확인하세요."
        actions={
          <Button variant="outline" asChild>
            <Link
              to={
                recording
                  ? `${base}/meetings/${recording.id}?tab=record`
                  : `${base}/meetings?new=1`
              }
            >
              <Icon name="edit" size={16} />
              {recording ? "미팅 기록하기" : "미팅 추가"}
            </Link>
          </Button>
        }
      />
      <div className="home-bento">
        <section className="surface home-next">
          <div className="section-heading">
            <h2>
              <Icon name="calendar" size={18} />
              다음 미팅
            </h2>
            {next && (
              <StatusBadge tone="blue">
                {next.status === "recording" ? "기록 중" : "준비 중"}
              </StatusBadge>
            )}
          </div>
          {next ? (
            <>
              <div className="home-next-top">
                <div>
                  <div className="meeting-date">
                    {formatDate(next.date)}
                    {next.time && (
                      <>
                        <span className="middle-dot">·</span>
                        {next.time}
                      </>
                    )}
                  </div>
                  <h3>{next.title}</h3>
                </div>
                <span className="meeting-date-symbol">
                  <Icon name="calendar" size={32} />
                </span>
              </div>
              <div className="goal-block">
                <span>보여줄 결과</span>
                <p>{next.goal || "이번 미팅에서 보여줄 결과를 적어 보세요."}</p>
              </div>
              <div className="home-next-bottom">
                <div className="next-counts">
                  <span>
                    <Icon name="tasks" size={15} />
                    준비 작업 <strong>{tasks.length}개</strong>
                  </span>
                  <span>
                    <Icon name="help" size={15} />
                    질문 <strong>{questions.length}개</strong>
                  </span>
                </div>
                <Button asChild>
                  <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                    미팅 준비하기
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              icon="calendar"
              title="다음 미팅을 준비해 보세요."
              description="날짜를 정하기 전에도 작업과 질문을 모아둘 수 있습니다."
              action={
                <Button asChild>
                  <Link to={`${base}/meetings?new=1`}>
                    <Icon name="plus" size={16} />
                    미팅 추가
                  </Link>
                </Button>
              }
            />
          )}
        </section>
        <section className="surface home-responses">
          <div className="section-heading">
            <h2>교수님의 응답</h2>
            <Link
              className="text-button"
              to={`${base}/reviews`}
              aria-label="검토 요청 전체 보기"
            >
              <Icon name="arrow-up-right" size={17} />
            </Link>
          </div>
          {responses.length ? (
            <div className="home-response-list">
              {responses.slice(0, 2).map((response) => {
                const round = rounds.find((r) => r.id === response.roundId)!;
                const unread = !data.reads.some(
                  (read) =>
                    read.roundId === round.id &&
                    read.userId === user.id &&
                    read.lastSeenAt >= response.updatedAt,
                );
                return (
                  <Link
                    key={response.id}
                    to={`/reviews/${round.requestId}?item=${round.itemId}&round=${round.id}`}
                    className="home-response"
                  >
                    <div>
                      <StatusBadge
                        tone={
                          response.result === "changes_requested"
                            ? "amber"
                            : "green"
                        }
                      >
                        {responseLabels[response.result]}
                      </StatusBadge>
                      {unread && (
                        <span
                          className="unread-marker"
                          aria-label="읽지 않은 응답"
                        />
                      )}
                    </div>
                    <h3>{round.title}</h3>
                    <p>{response.comment || "수정한 내용을 확인했습니다."}</p>
                    <span className="meta">
                      {round.number}차 검토
                      {rounds.some(
                        (r) =>
                          r.itemId === round.itemId && r.number > round.number,
                      )
                        ? " · 이전 차수 응답"
                        : ""}
                      <Icon name="chevron-right" size={15} />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="message"
              title="새 응답이 없습니다."
              description="보낸 검토의 응답을 여기에서 확인할 수 있습니다."
            />
          )}
        </section>
        <section className="surface home-work">
          <div className="section-heading">
            <h2>
              미팅 준비 작업
              <span className="heading-count">{tasks.length}</span>
            </h2>
            <Link className="text-button" to={`${base}/tasks`}>
              전체 할 일<Icon name="arrow-right" size={15} />
            </Link>
          </div>
          <div className="small-section-label">
            {next ? "다음 미팅에 포함한 작업" : "현재 연구의 작업"}
          </div>
          {tasks.length ? (
            <div>
              {tasks.slice(0, 5).map((task) => (
                <HomeTask task={task} key={task.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="tasks"
              title="준비에 포함한 작업이 없습니다."
              action={
                <Button variant="outline" asChild>
                  <Link
                    to={
                      next
                        ? `${base}/meetings/${next.id}?tab=prepare`
                        : `${base}/tasks`
                    }
                  >
                    작업 선택하기
                  </Link>
                </Button>
              }
            />
          )}
          <p className="section-footnote">
            작업 기한과 교수의 검토 결과는 각각 기록됩니다.
          </p>
        </section>
        <section className="surface home-preparation">
          <div className="section-heading">
            <h2>함께 챙길 내용</h2>
            <Icon name="paperclip" size={18} />
          </div>
          <div className="small-section-label">미해결 질문</div>
          {questions.length ? (
            <ul className="home-questions">
              {questions.slice(0, 3).map((q) => (
                <li key={q.id}>
                  <Icon name="help" size={16} />
                  <Link
                    to={
                      next
                        ? `${base}/meetings/${next.id}?tab=questions`
                        : `${base}/meetings`
                    }
                  >
                    {q.text}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">아직 준비한 질문이 없습니다.</p>
          )}
          <div className="home-materials">
            <div className="small-section-label">연결한 자료</div>
            {versions.length ? (
              versions.slice(0, 2).map((version) => (
                <Link
                  key={version.id}
                  to={`${base}/materials/${version.materialId}?version=${version.id}`}
                >
                  <span className="file-symbol">
                    <Icon name="file" size={18} />
                  </span>
                  <span>
                    <strong>{version.fileName}</strong>
                    <small>보존 파일 · v{version.number}</small>
                  </span>
                  <Icon name="chevron-right" size={14} />
                </Link>
              ))
            ) : (
              <p className="muted small">
                미팅 준비에서 자료를 연결할 수 있습니다.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="home-previous">
        <div className="section-heading">
          <h2>이전 미팅 이어보기</h2>
          <Link className="text-button" to={`${base}/meetings`}>
            미팅 목록
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>
        {previous ? (
          <Link
            className="previous-record"
            to={`${base}/meetings/${previous.id}?tab=record`}
          >
            <span className="date-square">
              <small>
                {previous.date
                  ? new Date(previous.date).getMonth() + 1 + "월"
                  : "날짜"}
              </small>
              <strong>
                {previous.date ? new Date(previous.date).getDate() : "미정"}
              </strong>
            </span>
            <span>
              <strong>
                {previous.title}
                <StatusBadge>기록 완료</StatusBadge>
              </strong>
              <p>{previous.memo || "저장한 미팅 기록을 확인하세요."}</p>
            </span>
            <Icon name="arrow-up-right" size={18} />
          </Link>
        ) : (
          <p className="muted">기록을 마친 미팅이 여기에 표시됩니다.</p>
        )}
      </section>
    </>
  );
}
