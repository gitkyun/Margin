import { dateLocale, t } from "@/lib/i18n";
import { EXPANDING_CLASS } from "@/lib/expand-home";
import { formatClock, timeParts } from "@/lib/time-format";
import { RollingNumber } from "@/components/RollingNumber";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import {
  formatDate,
  meetingLabels,
  relativeDay,
  taskLabels,
  formatDateTime,
  recordBase,
} from "@/lib/domain";
import {
  unreadReviewNotifications,
  notificationHref,
  type ReviewNotification,
} from "@/lib/notifications";
import { reviewDecision } from "@/lib/home-inbox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { EmptyState, TextLink, StatusBadge } from "@/components/common";
import { selectNextMeeting, seoulToday } from "@/lib/home-meeting";
import { selectHomeAction } from "@/lib/home-action";
import { startChecklist } from "@/lib/onboarding";
import {
  StartChecklist,
  isStartChecklistHidden,
  shouldCelebrateStartChecklist,
} from "@/components/home/StartChecklist";
import "./research-home.css";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { AnimatePresence, motion } from "motion/react";
import { useTaskRowMotion } from "@/components/task-row-motion";
import { WeekStrip } from "@/components/home/WeekStrip";
import { HomeTour } from "@/components/home/HomeTour";
import { clearTourRequest, isTourRequested, shouldShowTour } from "@/lib/tour";
import { ResearchDirection } from "@/components/home/ResearchDirection";
import { SubmissionCountdown } from "@/components/home/SubmissionCountdown";
import { planExcerpt } from "@/lib/research-direction";
import { friendlyError } from "@/lib/supabase";
import { Segments } from "@/components/experience";
import { Checkbox } from "@montage-ui/core";

const TOUR_DELAY_MS = 500;
/** 온보딩 전환(바뀌기·멈춤·커지기 2.5초)이 끝난 뒤 */
const TOUR_DELAY_AFTER_EXPAND_MS = 3200;

export function HomePage() {
  const taskRowMotion = useTaskRowMotion();
  const { researchId = "" } = useParams();
  const { data, user, save, saveResearch } = useWorkspace();
  const [importing, setImporting] = useState(false);
  const completion = useTaskCompletion(save);
  const [scope, setScope] = useState("mine");
  // 방금 닫은 연구를 기억합니다. 다른 연구로 바꾸면 그 연구의 저장된 상태를 다시 봅니다.
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  // ‘할 일로 만들기’를 누르고 저장을 기다리는 알림
  const [makingTask, setMakingTask] = useState<string | null>(null);
  const forcedTour = params.get("tour") === "1";
  const [tour, setTour] = useState(false);
  // 화면 안내는 저절로 뜨지 않습니다(감사 F3: 처음 안내는 연구 만들기 + 시작 체크리스트 두 겹).
  // 사용 안내의 ‘다시 보기’로 부탁했거나 ?tour=1로 들어왔을 때만, 홈이 자리 잡은 뒤에 엽니다.
  useEffect(() => {
    if (!shouldShowTour({ requested: isTourRequested(), forced: forcedTour }))
      return;
    const expanding =
      document.documentElement.classList.contains(EXPANDING_CLASS);
    const timer = window.setTimeout(
      () => setTour(true),
      expanding ? TOUR_DELAY_AFTER_EXPAND_MS : TOUR_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [forcedTour]);

  function endTour() {
    clearTourRequest();
    setTour(false);
    if (params.has("tour")) {
      const rest = new URLSearchParams(params);
      rest.delete("tour");
      setParams(rest, { replace: true });
    }
  }
  const checklistHidden =
    hiddenFor === researchId || isStartChecklistHidden(researchId);
  const research = data.researches.find((item) => item.id === researchId);
  if (!research) return <EmptyState title={t("연구를 찾을 수 없어요")} />;
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
        Number(a.status === "done" && !completion.held.has(a.id)) -
          Number(b.status === "done" && !completion.held.has(b.id)) ||
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
  // 확인할 내용에서 바로 할 일을 만듭니다. 알림은 읽음으로 바꾸지 않아요(작업·읽음 분리).
  const taskFor = (title: string) =>
    title ? tasks.find((task) => task.title === title) : undefined;
  async function makeTask(event: ReviewNotification, title: string) {
    if (makingTask) return;
    setMakingTask(event.id);
    try {
      const task = await save("tasks", {
        ...recordBase(researchId),
        origin: "manual",
        title,
        description: event.excerpt ?? "",
        status: "todo",
        dueDate: null,
        priority: "normal",
        visibility: "private",
        feedbackIds: [],
      });
      toast.success(
        t("할 일로 만들었어요. 알림은 확인할 때까지 여기에 남아요."),
        {
          action: {
            label: t("할 일 보기"),
            onClick: () => navigate(`${base}/tasks/${task.id}`),
          },
        },
      );
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setMakingTask(null);
    }
  }
  const openCount = work.filter((task) => task.status !== "done").length;
  const completedCount = work.filter((task) => task.status === "done").length;
  // 머리에는 지금 상황에서 할 일 하나만 올립니다. 카드 안 버튼은 보조로 둡니다.
  const action = selectHomeAction({
    base,
    today: seoulToday(),
    next,
    meetings,
    feedback: data.feedback.filter((item) => item.researchId === researchId),
  });
  // ‘바로 시작’은 할 일도 미팅도 없어 홈이 비어 보일 때만 냅니다.
  // 시작 체크리스트: 다 끝냈거나 닫았으면 내지 않습니다.
  const checklist = startChecklist(data, researchId);
  // 마지막 항목을 막 끝냈으면 완료 문구를 한 번 보여 주고 접히도록 그때도 냅니다.
  const showChecklist =
    !checklistHidden &&
    (checklist.some((item) => !item.done) ||
      shouldCelebrateStartChecklist(researchId, checklist));
  const showQuickStart = !next && openCount === 0 && !showChecklist;
  return (
    <div className="rh-home">
      {tour && (
        <HomeTour onDone={endTour} onUnavailable={() => setTour(false)} />
      )}
      <header className="rh-intro">
        <div className="rh-intro-copy">
          <div className="rh-title-row">
            <h1>{research.name}</h1>
            <SubmissionCountdown
              date={research.submissionDate}
              href={`${base}/planning`}
            />
          </div>
          <p>{research.description || t("아직 연구 설명이 없어요.")}</p>
          <ResearchDirection
            research={research}
            settingsHref={`${base}/settings`}
            planExcerpt={planExcerpt(data.documents, researchId)}
            busy={importing}
            onImport={(purpose) => {
              setImporting(true);
              saveResearch({ ...research, purpose })
                .then(() =>
                  toast.success(
                    t("계획서 첫 문단을 연구 목적으로 가져왔어요."),
                  ),
                )
                .catch((error) => toast.error(friendlyError(error)))
                .finally(() => setImporting(false));
            }}
          />
          <div className="rh-intro-meta">
            <Link
              className="rh-people"
              to={`${base}/planning${current ? `?phase=${current.id}` : ""}`}
            >
              <Icon name="flag" size={16} />
              <span>
                {current
                  ? t("현재 단계 · {title}", { title: current.title })
                  : t("단계와 주요 목표 정하기")}
              </span>
              <Icon name="chevron-right" size={14} />
            </Link>
            <Link className="rh-people" to={`${base}/settings?tab=members`}>
              {isCollaborative ? (
                <>
                  <span className="rh-avatars" aria-hidden="true">
                    {members.slice(0, 3).map((member) => (
                      <span key={member.userId}>{member.name.slice(0, 1)}</span>
                    ))}
                  </span>
                  <span>
                    {t("연구자 {count}명", { count: members.length })}
                  </span>
                </>
              ) : (
                <>
                  <Icon name="users" size={16} />
                  <span>{t("공동연구자 초대")}</span>
                </>
              )}
              <Icon name="chevron-right" size={14} />
            </Link>
          </div>
        </div>
        <Button className="rh-lead-action" size="lg" fullWidth="mobile" asChild>
          <Link to={action.href} data-action={action.kind}>
            {action.label}
            <Icon name={action.icon} size={18} />
          </Link>
        </Button>
      </header>
      {showChecklist && (
        <StartChecklist
          researchId={researchId}
          items={checklist}
          onHide={() => setHiddenFor(researchId)}
          onFinish={() => setHiddenFor(researchId)}
        />
      )}
      <section className="rh-phases" aria-labelledby="rh-phase-heading">
        <div className="rh-section-heading">
          <h2 id="rh-phase-heading">{t("연구 흐름")}</h2>
          {current && (
            <span className="rh-current-label">
              {t("{title} 진행 중", { title: current.title })}
            </span>
          )}
          <TextLink className="rh-text-link" to={`${base}/planning`}>
            {t("계획·일정")} <Icon name="arrow-up-right" size={15} />
          </TextLink>
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
                    <span className="rh-sr-only">{t("현재 단계")}</span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Link className="rh-phase-start" to={`${base}/planning`}>
            <Icon name="flag" size={18} />
            <span>{t("단계와 주요 목표 정하기")}</span>
            <Icon name="arrow-right" size={16} />
          </Link>
        )}
      </section>
      <div
        className={`rh-columns ${attentionCount > 0 ? "rh-has-attention" : ""}`}
      >
        <div className="rh-main-column">
          <section className="rh-meeting" aria-labelledby="rh-meeting-heading">
            <div className="rh-section-heading">
              <h2 id="rh-meeting-heading">
                <Icon name="calendar" size={18} />
                {t("다음 미팅")}
              </h2>
              <TextLink className="rh-text-link" to={`${base}/meetings`}>
                {t("미팅 목록")} <Icon name="chevron-right" size={14} />
              </TextLink>
            </div>
            {next ? (
              <>
                <div className="rh-meeting-title">
                  <div className="rh-date-tile" aria-hidden="true">
                    {next.date ? (
                      <>
                        <span className="rh-date-month">
                          {t("{month}월", {
                            month: Number(next.date.slice(5, 7)),
                          })}
                        </span>
                        <strong>{Number(next.date.slice(8, 10))}</strong>
                        <small>
                          {formatDate(next.date, { weekday: "short" })}
                        </small>
                      </>
                    ) : (
                      <>
                        <span className="rh-date-month">{t("날짜")}</span>
                        <Icon name="calendar" size={20} />
                        <small>{t("미정")}</small>
                      </>
                    )}
                  </div>
                  <div className="rh-meeting-title-copy">
                    <p>
                      {formatDate(next.date)}
                      {next.time && ` · ${formatClock(next.time)}`}
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
                    <StatusBadge tone="blue">
                      {meetingLabels[next.status]}
                    </StatusBadge>
                  </div>
                </div>
                <p className="rh-meeting-goal">
                  {next.goal || t("보여줄 결과를 아직 정하지 않았어요.")}
                </p>
                <div className="rh-preparation-heading">
                  <h4>{t("미팅까지 준비할 일")}</h4>
                  <span>
                    <RollingNumber value={prepared} />
                    <span className="rh-muted">
                      {" "}
                      / {t("{count}개 완료", { count: preparation.length })}
                    </span>
                  </span>
                </div>
                {preparation.length > 0 && (
                  <div
                    className="rh-progress"
                    role="progressbar"
                    aria-label={t("미팅까지 준비할 일")}
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
                      {t("아직 준비할 일을 고르지 않았어요.")}
                    </p>
                  )}
                </div>
                <div className="rh-meeting-footer">
                  <div className="rh-preparation-links">
                    <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                      <Icon name="paperclip" size={15} />
                      {t("자료 {count}개", { count: materials.length })}
                    </Link>
                    <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                      <Icon name="message" size={15} />
                      {t("질문 {count}개", { count: questions.length })}
                    </Link>
                  </div>
                  <Button
                    className="rh-primary"
                    variant="outline"
                    fullWidth="mobile"
                    asChild
                  >
                    <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
                      {t("미팅 준비하기")} <Icon name="arrow-right" size={16} />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="rh-meeting-empty">
                <span className="rh-empty-calendar">
                  <Icon name="calendar" size={27} />
                </span>
                <h3>{t("다음 미팅이 아직 없어요")}</h3>
                <p>
                  {t(
                    "날짜를 잡기 전에도 보여줄 결과와 질문부터 남길 수 있어요.",
                  )}
                </p>
                {/* 머리의 주 행동이 이미 '미팅 만들기'면 같은 버튼을 또 두지 않습니다(감사 C4·C5). */}
                {action.kind !== "create_meeting" && (
                  <Button
                    className="rh-primary"
                    variant="outline"
                    fullWidth="mobile"
                    asChild
                  >
                    <Link to={`${base}/meetings?new=1`}>
                      {t("미팅 만들기")} <Icon name="plus" size={16} />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </section>
          <section className="rh-work" aria-labelledby="rh-work-heading">
            <div className="rh-section-heading">
              <div>
                <h2 id="rh-work-heading">{t("남은 할 일")}</h2>
                <p className="rh-section-description">
                  <RollingNumber value={openCount} />
                  {t("개 남음")}
                  <span>·</span>
                  <RollingNumber value={completedCount} />
                  {t("개 완료")}
                </p>
              </div>
              <TextLink className="rh-text-link" to={`${base}/tasks`}>
                {t("전체 보기")} <Icon name="arrow-up-right" size={15} />
              </TextLink>
            </div>
            {isCollaborative && (
              <Segments
                label={t("할 일 범위")}
                size="small"
                value={scope}
                onChange={(next) => setScope(next as typeof scope)}
                options={[
                  { value: "mine", label: t("내 할 일") },
                  { value: "all", label: t("연구 전체") },
                ]}
              />
            )}
            <div className="rh-task-list">
              <AnimatePresence initial={false}>
                {work.slice(0, 5).map((task) => (
                  <motion.div
                    {...taskRowMotion}
                    className={`rh-task ${task.status === "done" ? "rh-is-complete" : ""}`}
                    key={task.id}
                  >
                    <Checkbox
                      aria-label={t("{title} 완료", { title: task.title })}
                      checked={task.status === "done"}
                      disabled={completion.busy.has(task.id)}
                      onCheckedChange={() => void completion.toggle(task)}
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
                            )?.name ?? t("담당 미지정")}
                            <i>·</i>
                          </>
                        )}
                        {task.dueDate
                          ? `${task.status !== "done" && task.dueDate < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) ? `${t("기한 지남")} · ` : ""}${formatDate(task.dueDate)}`
                          : t("기한 없음")}
                      </span>
                    </Link>
                    <StatusBadge
                      tone={
                        task.status === "done"
                          ? "green"
                          : task.priority === "high"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {task.status === "done"
                        ? taskLabels.done
                        : task.priority === "high"
                          ? t("우선")
                          : taskLabels[task.status]}
                    </StatusBadge>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!work.length && (
                <div className="rh-list-empty">
                  <Icon name="tasks" size={22} />
                  <p>
                    {isCollaborative && scope === "mine"
                      ? t("내 할 일이 없어요.")
                      : t("아직 할 일이 없어요.")}
                  </p>
                </div>
              )}
            </div>
            <Link className="rh-add-link" to={`${base}/tasks?new=1`}>
              <Icon name="plus" size={17} />
              {t("할 일 추가")}
            </Link>
          </section>
        </div>
        <aside
          className="rh-side-column"
          aria-label={t("확인할 내용과 이번 주")}
        >
          <section
            className="rh-attention"
            aria-labelledby="rh-attention-heading"
          >
            <div className="rh-section-heading">
              <h2 id="rh-attention-heading">
                {t("확인할 내용")}
                {attentionCount > 0 && (
                  <span className="rh-count">
                    <RollingNumber value={attentionCount} />
                  </span>
                )}
              </h2>
              <Icon name="bell" size={18} />
            </div>
            {/* 디시전 인박스: 무슨 일이 있었는지 · 무엇을 정할지 · 바로 할 행동 1~2개 */}
            <ul className="rh-inbox" aria-labelledby="rh-attention-heading">
              {updates.slice(0, 3).map((event) => {
                const decision = reviewDecision(event);
                const made = taskFor(decision.taskTitle);
                return (
                  <li
                    className={`rh-attention-row rh-inbox-item tone-${event.tone}`}
                    key={event.id}
                  >
                    <span className="rh-attention-icon">
                      <Icon name={decision.icon} size={18} />
                    </span>
                    <div className="rh-inbox-body">
                      <small className="rh-inbox-event">{event.message}</small>
                      <strong>{event.title}</strong>
                      {event.excerpt && (
                        <q className="rh-inbox-excerpt">{event.excerpt}</q>
                      )}
                      <p className="rh-inbox-ask">{decision.ask}</p>
                      <div className="rh-inbox-actions">
                        <Button size="sm" asChild>
                          <Link to={notificationHref(event)}>
                            {decision.openLabel}
                          </Link>
                        </Button>
                        {decision.canMakeTask &&
                          (made ? (
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`${base}/tasks/${made.id}`}>
                                <Icon name="check" size={14} />
                                {t("만든 할 일 보기")}
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!makingTask}
                              loading={makingTask === event.id}
                              onClick={() =>
                                void makeTask(event, decision.taskTitle)
                              }
                            >
                              {t("할 일로 만들기")}
                            </Button>
                          ))}
                      </div>
                    </div>
                  </li>
                );
              })}
              {pending.length > 0 && (
                <li className="rh-attention-row rh-inbox-item">
                  <span className="rh-attention-icon">
                    <Icon name="sparkles" size={18} />
                  </span>
                  <div className="rh-inbox-body">
                    <strong>
                      {t("확인할 AI 제안 {count}개", { count: pending.length })}
                    </strong>
                    <p className="rh-inbox-ask">
                      {t("기록으로 남길 제안을 선택하세요.")}
                    </p>
                    <div className="rh-inbox-actions">
                      <Button size="sm" asChild>
                        <Link to={`${base}/assistant?tab=overview`}>
                          {t("제안 확인하기")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </li>
              )}
            </ul>
            {updates.length > 3 && (
              <p className="rh-inbox-more">
                {t("확인할 알림 {count}개가 더 있어요.", {
                  count: updates.length - 3,
                })}
              </p>
            )}
            {!attentionCount && (
              <div className="rh-attention-empty">
                <span>
                  <Icon name="check" size={18} />
                </span>
                <div>
                  <strong>{t("확인할 새 알림이 없어요")}</strong>
                  <p>
                    {t(
                      "교수 응답, 검토 댓글, 확인할 AI 제안이 생기면 여기에 보여요.",
                    )}
                  </p>
                </div>
              </div>
            )}
            {milestone && (
              <Link className="rh-deadline" to={`${base}/planning`}>
                <Icon name="flag" size={16} />
                <span>
                  <small>
                    {t("다음 주요 목표")} · {formatDate(milestone.dueDate)}
                  </small>
                  <strong>{milestone.title}</strong>
                </span>
                <Icon name="chevron-right" size={14} />
              </Link>
            )}
          </section>
          <WeekStrip data={data} researchId={research.id} />
          <section className="rh-writing" aria-labelledby="rh-writing-heading">
            <div className="rh-section-heading">
              <h2 id="rh-writing-heading">{t("최근 문서")}</h2>
              <TextLink className="rh-text-link" to={`${base}/writing`}>
                {t("글쓰기")} <Icon name="arrow-up-right" size={15} />
              </TextLink>
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
                      {formatDateTime(document.updatedAt, { time: false })}
                      {isCollaborative && author && ` · ${author}`}
                      {versionCount > 0
                        ? ` · ${t("버전 {count}개", { count: versionCount })}`
                        : ""}
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
                  <strong>{t("아직 문서가 없어요")}</strong>
                  <small>{t("새 연구 계획서 만들기")}</small>
                </span>
                <Icon name="plus" size={18} />
              </Link>
            )}
          </section>
          {isCollaborative && (
            <section
              className="rh-activity"
              aria-labelledby="rh-activity-heading"
            >
              <div className="rh-section-heading">
                <h2 id="rh-activity-heading">{t("최근 활동")}</h2>
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
                          {`${event.actorName} · `}
                          <time dateTime={event.createdAt}>
                            {new Date(event.createdAt).toLocaleString(
                              dateLocale(),
                              {
                                month: "numeric",
                                day: "numeric",
                                ...timeParts(),
                              },
                            )}
                          </time>
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              {!events.length && (
                <p className="rh-inline-empty">
                  {t("공동연구자의 활동이 여기에 보여요.")}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
      {showQuickStart && (
        <section className="rh-quick-start" aria-labelledby="rh-start-heading">
          <div className="rh-section-heading">
            <h2 id="rh-start-heading">{t("바로 시작")}</h2>
          </div>
          <div className="rh-quick-actions">
            <Link
              className="rh-quick-action rh-quick-record"
              to={`${base}/meetings?new=1&intent=record`}
            >
              <span className="rh-quick-icon">
                <Icon name="mic" size={22} />
              </span>
              <span className="rh-quick-text">
                <strong>{t("피드백 기록하기")}</strong>
                <small>{t("새 미팅을 만들어 녹음·메모")}</small>
              </span>
              <Icon name="arrow-up-right" size={18} />
            </Link>
            <Link className="rh-quick-action" to={`${base}/meetings?new=1`}>
              <span className="rh-quick-icon">
                <Icon name="calendar" size={22} />
              </span>
              <span className="rh-quick-text">
                <strong>{t("미팅 준비하기")}</strong>
                <small>{t("할 일·자료·질문 모으기")}</small>
              </span>
              <Icon name="arrow-up-right" size={18} />
            </Link>
            <Link className="rh-quick-action" to={`${base}/writing?new=1`}>
              <span className="rh-quick-icon">
                <Icon name="edit" size={22} />
              </span>
              <span className="rh-quick-text">
                <strong>{t("연구 글 쓰기")}</strong>
                <small>{t("새 연구 계획서 만들기")}</small>
              </span>
              <Icon name="arrow-up-right" size={18} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
