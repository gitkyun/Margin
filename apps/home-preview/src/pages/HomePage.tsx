import { AssistantMascot } from "@/components/brand/Brand";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import {
  formatDate,
  meetingLabels,
  relativeDay,
  taskLabels,
} from "@/lib/domain";
import {
  unreadReviewNotifications,
  notificationHref,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/common";
import { selectNextMeeting } from "@/lib/home-meeting";
import "./research-home.css";
import { toggleDone } from "@/lib/task-status";
import { Segments } from "@/components/experience";
import { Checkbox } from "@montage-ui/core";

export function HomePage() {
  const { researchId = "" } = useParams();
  const { data, user, save } = useWorkspace();
  const [scope, setScope] = useState("mine");
  const [busy, setBusy] = useState("");
  const research = data.researches.find((item) => item.id === researchId);
  if (!research) return <EmptyState title="연구를 찾을 수 없어요" />;
  const base = `/r/${researchId}`;
  const meetings = data.meetings.filter(
    (m) =>
      m.researchId === researchId && !m.archivedAt && m.status !== "cancelled",
  );
  const next = selectNextMeeting(meetings, research.nextMeetingId);
  const tasks = data.tasks.filter(
    (task) => task.researchId === researchId && !task.archivedAt,
  );
  const members = data.members.filter(
    (member) => member.researchId === researchId && member.status === "active",
  );
  const isCollaborative = members.some(
    (member) => member.userId !== research.ownerId,
  );
  const work = tasks
    .filter(
      (task) =>
        !isCollaborative ||
        scope === "all" ||
        !task.assigneeId ||
        task.assigneeId === user.id,
    )
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        Number(b.priority === "high") - Number(a.priority === "high") ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    );
  const phases = data.phases
    .filter((phase) => phase.researchId === researchId && !phase.archivedAt)
    .sort((a, b) => a.order - b.order);
  const current =
    phases.find((phase) => phase.id === research.currentPhaseId) ??
    phases.find((phase) => phase.status === "active");
  const docs = data.documents
    .filter(
      (document) => document.researchId === researchId && !document.archivedAt,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const updates = unreadReviewNotifications(data, user, researchId);
  const pending = data.aiCandidates.filter(
    (candidate) =>
      candidate.researchId === researchId && candidate.status === "pending",
  );
  const events = data.events
    .filter((event) => event.researchId === researchId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const milestone = data.milestones
    .filter(
      (item) =>
        item.researchId === researchId &&
        item.status === "planned" &&
        !item.archivedAt,
    )
    .sort((a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    )[0];
  const preparation = next
    ? tasks.filter((task) => next.taskIds.includes(task.id))
    : [];
  const prepared = preparation.filter((task) => task.status === "done").length;
  const materials = next
    ? data.versions.filter((version) => next.versionIds.includes(version.id))
    : [];
  const questions = next
    ? data.questions.filter(
        (question) =>
          next.questionIds.includes(question.id) && !question.archivedAt,
      )
    : [];
  const attentionCount = updates.length + pending.length;
  const openCount = work.filter((task) => task.status !== "done").length;
  const completedCount = work.filter((task) => task.status === "done").length;
  async function toggle(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setBusy(id);
    try {
      await save("tasks", {
        ...task,
        status: toggleDone(task.status),
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="rh-home">
      <header className="rh-intro">
        <div className="rh-intro-copy">
          <h1>{research.name}</h1>
          <p>{research.description || "아직 연구 설명이 없어요."}</p>
          <Link className="rh-people" to={`${base}/settings?tab=members`}>
            {isCollaborative ? (
              <>
                <span className="rh-avatars" aria-hidden="true">
                  {members.slice(0, 3).map((member) => (
                    <span key={member.userId}>{member.name.slice(0, 1)}</span>
                  ))}
                </span>
                <span>연구자 {members.length}명</span>
              </>
            ) : (
              <>
                <Icon name="users" size={16} />
                <span>공동연구자 초대</span>
              </>
            )}
            <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      </header>
      <section className="rh-quick-start" aria-labelledby="rh-start-heading">
        <div className="rh-section-heading">
          <h2 id="rh-start-heading">바로 시작</h2>
        </div>
        <div className="rh-quick-actions">
          <Link
            className="rh-quick-action rh-quick-record"
            to={
              next
                ? `${base}/meetings/${next.id}?tab=record#meeting-recording`
                : `${base}/meetings?new=1&intent=record`
            }
          >
            <span className="rh-quick-icon">
              <Icon name="mic" size={22} />
            </span>
            <span className="rh-quick-text">
              <strong>피드백 기록하기</strong>
              <small>
                {next
                  ? `${next.title} · 녹음·전사 또는 메모`
                  : "새 미팅을 만들어 녹음·메모"}
              </small>
            </span>
            <Icon name="arrow-up-right" size={18} />
          </Link>
          <Link
            className="rh-quick-action"
            to={
              next
                ? `${base}/meetings/${next.id}?tab=prepare`
                : `${base}/meetings?new=1`
            }
          >
            <span className="rh-quick-icon">
              <Icon name="calendar" size={22} />
            </span>
            <span className="rh-quick-text">
              <strong>미팅 준비하기</strong>
              <small>할 일·자료·질문 모으기</small>
            </span>
            <Icon name="arrow-up-right" size={18} />
          </Link>
          <Link className="rh-quick-action" to={`${base}/writing?new=1`}>
            <span className="rh-quick-icon">
              <Icon name="edit" size={22} />
            </span>
            <span className="rh-quick-text">
              <strong>연구 글 쓰기</strong>
              <small>새 연구 계획서 만들기</small>
            </span>
            <Icon name="arrow-up-right" size={18} />
          </Link>
        </div>
      </section>
      <section className="rh-phases" aria-labelledby="rh-phase-heading">
        <div className="rh-section-heading">
          <h2 id="rh-phase-heading">연구 단계</h2>
          {current && (
            <span className="rh-current-label">
              현재 단계 · {current.title}
            </span>
          )}
          <Link className="rh-text-link" to={`${base}/planning`}>
            계획·일정 <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
        {phases.length ? (
          <ol className="rh-phase-track">
            {phases.map((phase, index) => (
              <li
                key={phase.id}
                className={
                  phase.id === current?.id
                    ? "rh-phase-current"
                    : phase.status === "done"
                      ? "rh-phase-done"
                      : ""
                }
              >
                <Link
                  to={`${base}/planning?phase=${phase.id}`}
                  aria-current={phase.id === current?.id ? "step" : undefined}
                >
                  <span className="rh-phase-number" aria-hidden="true">
                    {phase.status === "done" ? (
                      <Icon name="check" size={13} />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span>{phase.title}</span>
                  {phase.id === current?.id && (
                    <span className="rh-sr-only">현재 단계</span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Link className="rh-phase-start" to={`${base}/planning`}>
            <Icon name="flag" size={18} />
            <span>단계와 주요 목표 정하기</span>
            <Icon name="arrow-right" size={16} />
          </Link>
        )}
      </section>
      <div className="rh-columns">
        <div className="rh-main-column">
          <section className="rh-meeting" aria-labelledby="rh-meeting-heading">
            <div className="rh-section-heading">
              <h2 id="rh-meeting-heading">
                <Icon name="calendar" size={18} />
                다음 미팅
              </h2>
              <Link className="rh-text-link" to={`${base}/meetings`}>
                미팅 목록 <Icon name="chevron-right" size={14} />
              </Link>
            </div>
            {next ? (
              <>
                <div className="rh-meeting-title">
                  <div className="rh-date-tile" aria-hidden="true">
                    {next.date ? (
                      <>
                        <span className="rh-date-month">
                          {Number(next.date.slice(5, 7))}월
                        </span>
                        <strong>{Number(next.date.slice(8, 10))}</strong>
                        <small>
                          {formatDate(next.date, { weekday: "short" })}
                        </small>
                      </>
                    ) : (
                      <>
                        <span className="rh-date-month">날짜</span>
                        <Icon name="calendar" size={20} />
                        <small>미정</small>
                      </>
                    )}
                  </div>
                  <div className="rh-meeting-title-copy">
                    <p>
                      {formatDate(next.date)}
                      {next.time && ` · ${next.time}`}
                      {relativeDay(next.date) && (
                        <span className="rh-dday">
                          {relativeDay(next.date)}
                        </span>
                      )}
                    </p>
                    <h3>
                      <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                        {next.title}
                      </Link>
                    </h3>
                    <span className="rh-badge rh-badge-blue">
                      {meetingLabels[next.status]}
                    </span>
                  </div>
                </div>
                <p className="rh-meeting-goal">
                  {next.goal || "보여줄 결과를 아직 정하지 않았어요."}
                </p>
                <div className="rh-preparation-heading">
                  <h4>미팅까지 준비할 일</h4>
                  <span>
                    {prepared}
                    <span className="rh-muted">
                      {" "}
                      / {preparation.length}개 완료
                    </span>
                  </span>
                </div>
                {preparation.length > 0 && (
                  <div
                    className="rh-progress"
                    role="progressbar"
                    aria-label="미팅까지 준비할 일"
                    aria-valuemin={0}
                    aria-valuemax={preparation.length}
                    aria-valuenow={prepared}
                  >
                    <span
                      style={{
                        width: `${(prepared / preparation.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
                <div className="rh-preparation-list">
                  {preparation.slice(0, 3).map((task) => (
                    <Link
                      className={`rh-preparation-item ${task.status === "done" ? "rh-is-complete" : ""}`}
                      key={task.id}
                      to={`${base}/tasks/${task.id}`}
                    >
                      <span className="rh-preparation-check">
                        <Icon
                          name={task.status === "done" ? "check" : "minus"}
                          size={13}
                        />
                      </span>
                      <span>{task.title}</span>
                      <Icon name="chevron-right" size={14} />
                    </Link>
                  ))}
                  {!preparation.length && (
                    <p className="rh-inline-empty">
                      아직 준비할 일을 고르지 않았어요.
                    </p>
                  )}
                </div>
                <div className="rh-meeting-footer">
                  <div className="rh-preparation-links">
                    <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                      <Icon name="paperclip" size={15} />
                      자료 {materials.length}
                    </Link>
                    <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                      <Icon name="message" size={15} />
                      질문 {questions.length}
                    </Link>
                  </div>
                  <Button className="rh-primary" fullWidth="mobile" asChild>
                    <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                      미팅 준비하기 <Icon name="arrow-right" size={16} />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="rh-meeting-empty">
                <span className="rh-empty-calendar">
                  <Icon name="calendar" size={27} />
                </span>
                <h3>다음 미팅이 아직 없어요</h3>
                <p>날짜를 잡기 전에도 보여줄 결과와 질문부터 남길 수 있어요.</p>
                <Button className="rh-primary" fullWidth="mobile" asChild>
                  <Link to={`${base}/meetings?new=1`}>
                    미팅 만들기 <Icon name="plus" size={16} />
                  </Link>
                </Button>
              </div>
            )}
          </section>
          <section className="rh-work" aria-labelledby="rh-work-heading">
            <div className="rh-section-heading">
              <div>
                <h2 id="rh-work-heading">남은 할 일</h2>
                <p className="rh-section-description">
                  {openCount}개 남음<span>·</span>
                  {completedCount}개 완료
                </p>
              </div>
              <Link className="rh-text-link" to={`${base}/tasks`}>
                전체 보기 <Icon name="arrow-up-right" size={15} />
              </Link>
            </div>
            {isCollaborative && (
              <Segments
                label="할 일 범위"
                size="small"
                value={scope}
                onChange={(next) => setScope(next as typeof scope)}
                options={[
                  { value: "mine", label: "내 할 일" },
                  { value: "all", label: "연구 전체" },
                ]}
              />
            )}
            <div className="rh-task-list">
              {work.slice(0, 5).map((task) => (
                <div
                  className={`rh-task ${task.status === "done" ? "rh-is-complete" : ""}`}
                  key={task.id}
                >
                  <Checkbox
                    aria-label={`${task.title} 완료`}
                    checked={task.status === "done"}
                    disabled={busy === task.id}
                    onCheckedChange={() => void toggle(task.id)}
                  />
                  <Link
                    className="rh-task-copy"
                    to={`${base}/tasks/${task.id}`}
                  >
                    <strong>{task.title}</strong>
                    <span>
                      {isCollaborative && (
                        <>
                          {members.find(
                            (member) => member.userId === task.assigneeId,
                          )?.name ?? "담당 미지정"}
                          <i>·</i>
                        </>
                      )}
                      {task.dueDate
                        ? `${task.status !== "done" && task.dueDate < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) ? "기한 지남 · " : ""}${formatDate(task.dueDate)}`
                        : "기한 없음"}
                    </span>
                  </Link>
                  <span
                    className={`rh-badge ${task.status === "done" ? "rh-badge-green" : task.priority === "high" ? "rh-badge-amber" : "rh-badge-neutral"}`}
                  >
                    {task.status === "done"
                      ? taskLabels.done
                      : task.priority === "high"
                        ? "우선"
                        : taskLabels[task.status]}
                  </span>
                </div>
              ))}
              {!work.length && (
                <div className="rh-list-empty">
                  <Icon name="tasks" size={22} />
                  <p>
                    {isCollaborative && scope === "mine"
                      ? "내 할 일이 없어요."
                      : "아직 할 일이 없어요."}
                  </p>
                </div>
              )}
            </div>
            <Link className="rh-add-link" to={`${base}/tasks?new=1`}>
              <Icon name="plus" size={17} />할 일 추가
            </Link>
          </section>
          <section className="rh-writing" aria-labelledby="rh-writing-heading">
            <div className="rh-section-heading">
              <h2 id="rh-writing-heading">최근 문서</h2>
              <Link className="rh-text-link" to={`${base}/writing`}>
                글쓰기 <Icon name="arrow-up-right" size={15} />
              </Link>
            </div>
            {docs.slice(0, 3).map((document) => {
              const versionCount = data.documentVersions.filter(
                (version) => version.documentId === document.id,
              ).length;
              const author = members.find(
                (member) => member.userId === document.updatedBy,
              )?.name;
              return (
                <Link
                  className="rh-document"
                  key={document.id}
                  to={`${base}/writing/${document.id}`}
                >
                  <span className="rh-document-icon">
                    <Icon name="file" size={22} />
                  </span>
                  <span className="rh-document-copy">
                    <strong>{document.title}</strong>
                    <small>
                      {new Date(document.updatedAt).toLocaleDateString("ko-KR")}
                      {isCollaborative && author && ` · ${author}`}
                      {versionCount > 0 ? ` · 버전 ${versionCount}개` : ""}
                    </small>
                  </span>
                  <Icon name="arrow-up-right" size={16} />
                </Link>
              );
            })}
            {!docs.length && (
              <Link className="rh-writing-empty" to={`${base}/writing?new=1`}>
                <span className="rh-document-icon">
                  <Icon name="edit" size={22} />
                </span>
                <span>
                  <strong>아직 문서가 없어요</strong>
                  <small>새 연구 계획서 만들기</small>
                </span>
                <Icon name="plus" size={18} />
              </Link>
            )}
          </section>
        </div>
        <aside className="rh-side-column" aria-label="연구 소식과 도우미">
          <section
            className="rh-attention"
            aria-labelledby="rh-attention-heading"
          >
            <div className="rh-section-heading">
              <h2 id="rh-attention-heading">
                확인할 내용
                {attentionCount > 0 && (
                  <span className="rh-count">{attentionCount}</span>
                )}
              </h2>
              <Icon name="bell" size={18} />
            </div>
            {updates.slice(0, 3).map((event) => (
              <Link
                className="rh-attention-row"
                key={event.id}
                to={notificationHref(event)}
              >
                <span className="rh-attention-icon">
                  <Icon name="feedback" size={18} />
                </span>
                <span>
                  <strong>{event.title}</strong>
                  <p>{event.message}</p>
                </span>
                <Icon name="chevron-right" size={14} />
              </Link>
            ))}
            {pending.length > 0 && (
              <Link
                className="rh-attention-row"
                to={`${base}/assistant?tab=overview`}
              >
                <span className="rh-attention-icon">
                  <Icon name="sparkles" size={18} />
                </span>
                <span>
                  <strong>확인할 AI 제안 {pending.length}개</strong>
                  <p>기록으로 남길 제안을 선택하세요.</p>
                </span>
                <Icon name="chevron-right" size={14} />
              </Link>
            )}
            {!attentionCount && (
              <div className="rh-attention-empty">
                <span>
                  <Icon name="check" size={18} />
                </span>
                <div>
                  <strong>확인할 새 소식이 없어요</strong>
                  <p>
                    교수 응답, 검토 댓글, 확인할 AI 제안이 생기면 여기에 보여요.
                  </p>
                </div>
              </div>
            )}
            {milestone && (
              <Link className="rh-deadline" to={`${base}/planning`}>
                <Icon name="flag" size={16} />
                <span>
                  <small>
                    다음 주요 목표 · {formatDate(milestone.dueDate)}
                  </small>
                  <strong>{milestone.title}</strong>
                </span>
                <Icon name="chevron-right" size={14} />
              </Link>
            )}
          </section>
          <section
            className="rh-assistant"
            aria-labelledby="rh-assistant-heading"
          >
            <AssistantMascot state="ready" size={64} />
            <h2 id="rh-assistant-heading">연구 도우미</h2>
            <p>
              지정한 기록을 바탕으로 할 일과 수정 방법을 제안해요. 선택한 제안만
              내 기록에 남아요.
            </p>
            <div className="rh-assistant-actions">
              <Link to={`${base}/assistant?mode=plan_research`}>
                <span>
                  <Icon name="tasks" size={16} />할 일 정리
                </span>
                <Icon name="arrow-up-right" size={15} />
              </Link>
              <Link to={`${base}/assistant?mode=suggest_revisions`}>
                <span>
                  <Icon name="layers" size={16} />
                  수정 방법 제안
                </span>
                <Icon name="arrow-up-right" size={15} />
              </Link>
            </div>
          </section>
          <section
            className="rh-activity"
            aria-labelledby="rh-activity-heading"
          >
            <div className="rh-section-heading">
              <h2 id="rh-activity-heading">최근 활동</h2>
              <Icon name="history" size={18} />
            </div>
            <ol className="rh-activity-list">
              {events.map((event) => (
                <li key={event.id}>
                  <Link to={event.href}>
                    <span className="rh-activity-dot" aria-hidden="true" />
                    <span>
                      <strong>{event.title}</strong>
                      <p>{event.message}</p>
                      <small>
                        {isCollaborative && `${event.actorName} · `}
                        <time dateTime={event.createdAt}>
                          {new Date(event.createdAt).toLocaleString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {!events.length && (
              <p className="rh-inline-empty">
                공동연구자의 활동이 여기에 보여요.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
