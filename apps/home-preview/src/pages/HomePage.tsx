import { dateLocale, t } from "@/lib/i18n";
import { EXPANDING_CLASS } from "@/lib/expand-home";
import { formatClock } from "@/lib/time-format";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence } from "motion/react";
import { useWorkspace } from "@/lib/workspace";
import {
  formatDate,
  formatDateTime,
  recordBase,
  relativeDay,
  type Meeting,
  type Task,
} from "@/lib/domain";
import {
  unreadReviewNotifications,
  notificationHref,
  type ReviewNotification,
} from "@/lib/notifications";
import { reviewDecision } from "@/lib/home-inbox";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/common";
import { Segments } from "@/components/experience";
import {
  selectNextMeeting,
  seoulNowTime,
  seoulToday,
} from "@/lib/home-meeting";
import { useOptionalRecorder } from "@/components/recording/RecordingProvider";
import { selectHomeAction, type HomeAction } from "@/lib/home-action";
import { startChecklist } from "@/lib/onboarding";
import {
  StartChecklist,
  isStartChecklistHidden,
  shouldCelebrateStartChecklist,
} from "@/components/home/StartChecklist";
import { HomeTour } from "@/components/home/HomeTour";
import { clearTourRequest, isTourRequested, shouldShowTour } from "@/lib/tour";
import { ResearchDirection } from "@/components/home/ResearchDirection";
import { SubmissionCountdown } from "@/components/home/SubmissionCountdown";
import { planExcerpt } from "@/lib/research-direction";
import { friendlyError } from "@/lib/supabase";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { useTaskRowMotion } from "@/components/task-row-motion";
import { QuickTaskInput, TaskRow } from "@/components/tasks/TaskRow";
import { taskSource } from "@/lib/task-groups";
import {
  HOME_TABS,
  homeTaskOrder,
  readHomeTab,
  rememberHomeTab,
  type HomeTab,
} from "@/lib/home-lists";
import "./research-home.css";
import "./home/home.css";

const TOUR_DELAY_MS = 500;
/** 온보딩 전환(바뀌기·멈춤·커지기 2.5초)이 끝난 뒤 */
const TOUR_DELAY_AFTER_EXPAND_MS = 3200;
/** 목록 탭에 보여 주는 줄 수(03 §5) */
const LIST_MAX = 8;

/**
 * 연구 홈(IA v2 H1, 03). 지금 무엇을 하면 되는지 한 번에 보여 주고 한 번 눌러 시작하게 합니다.
 * 머리 → (알림 줄) → 다음 미팅 카드 → 목록 탭 넷, 오른쪽 열(시작하기·연구 흐름·연구 방향).
 * 판이 864px 아래면 한 열로 바뀝니다(home.css 컨테이너 쿼리).
 */
export function HomePage() {
  const { researchId = "" } = useParams();
  const { data, user, save, saveResearch } = useWorkspace();
  const [importing, setImporting] = useState(false);
  // 방금 닫은 연구를 기억합니다. 다른 연구로 바꾸면 그 연구의 저장된 상태를 다시 봅니다.
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const forcedTour = params.get("tour") === "1";
  const [tour, setTour] = useState(false);
  const recorder = useOptionalRecorder();
  // 화면 안내는 저절로 뜨지 않습니다(감사 F3). ‘다시 보기’나 ?tour=1일 때만 홈이 자리 잡은 뒤에 엽니다.
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
  const research = data.researches.find((item) => item.id === researchId);
  if (!research) return <EmptyState title={t("연구를 찾을 수 없어요")} />;
  const base = `/r/${researchId}`;
  const checklistHidden =
    hiddenFor === researchId || isStartChecklistHidden(researchId);
  const meetings = data.meetings.filter(
    (m) =>
      m.researchId === researchId && !m.archivedAt && m.status !== "cancelled",
  );
  const next = selectNextMeeting(meetings, research.nextMeetingId);
  const members = data.members.filter(
    (member) => member.researchId === researchId && member.status === "active",
  );
  const isCollaborative = members.some(
    (member) => member.userId !== research.ownerId,
  );
  const phases = data.phases
    .filter((phase) => phase.researchId === researchId && !phase.archivedAt)
    .sort((a, b) => a.order - b.order);
  const current =
    phases.find((phase) => phase.id === research.currentPhaseId) ??
    phases.find((phase) => phase.status === "active");
  const updates = unreadReviewNotifications(data, user, researchId);
  const action = selectHomeAction({
    base,
    today: seoulToday(),
    now: seoulNowTime(),
    recordingMeetingId:
      recorder?.session?.researchId === researchId &&
      (recorder.state === "recording" || recorder.state === "paused")
        ? recorder.session.meetingId
        : null,
    next,
    meetings,
    feedback: data.feedback.filter((item) => item.researchId === researchId),
    unreadChangesRequested: updates
      .filter((event) => event.kind === "response" && event.tone === "amber")
      .map((event) => ({
        title: event.title,
        href: notificationHref(event),
        createdAt: event.createdAt,
      })),
  });
  const checklist = startChecklist(data, researchId);
  // 마지막 항목을 막 끝냈으면 완료 문구를 한 번 보여 주고 접히도록 그때도 냅니다.
  const showChecklist =
    !checklistHidden &&
    (checklist.some((item) => !item.done) ||
      shouldCelebrateStartChecklist(researchId, checklist));
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
  const archived = !!research.archivedAt;

  return (
    <div className="rh-home hm-home">
      {tour && (
        <HomeTour onDone={endTour} onUnavailable={() => setTour(false)} />
      )}
      <header className="hm-head">
        <div className="hm-head-copy">
          <h1 title={research.name}>{research.name}</h1>
          {research.description && (
            <p title={research.description}>{research.description}</p>
          )}
        </div>
        <div className="hm-chips">
          <Link
            className="hm-chip"
            to={`${base}/flow${current ? `?phase=${current.id}` : ""}`}
          >
            {current
              ? t("현재 단계 {title}", { title: current.title })
              : t("단계 정하기")}
            <Icon name="chevron-right" size={14} />
          </Link>
          <SubmissionCountdown
            date={research.submissionDate}
            href={`${base}/flow`}
          />
          {isCollaborative && (
            <Link className="hm-chip" to={`${base}?settings=people`}>
              {t("공동연구자 {count}명", { count: members.length })}
              <Icon name="chevron-right" size={14} />
            </Link>
          )}
        </div>
      </header>
      {/* 휴대폰 바로가기 줄(03 §1): 결정·질문과 글·자료 창을 휴대폰 층으로 엽니다. 할 일은 아래 탭에 있습니다. */}
      <nav className="hm-shortcuts" aria-label={t("바로가기")}>
        <Link className="hm-shortcut" to="?panel=log">
          <Icon name="flag" size={18} />
          {t("결정·질문")}
        </Link>
        <Link className="hm-shortcut" to="?panel=materials">
          <Icon name="folder" size={18} />
          {t("자료")}
        </Link>
      </nav>
      <div className="hm-grid">
        <div className="hm-main">
          {action.notice && <LeadNotice action={action} disabled={archived} />}
          <NextMeetingCard
            base={base}
            next={next}
            action={action}
            disabled={archived}
            hasRecords={meetings.length > 0}
          />
          <HomeLists
            researchId={researchId}
            isCollaborative={isCollaborative}
            archived={archived}
            updates={updates}
            nextMeeting={next}
          />
        </div>
        <aside className="hm-side" aria-label={t("시작하기와 연구 흐름")}>
          {showChecklist && (
            <div className="hm-start">
              <StartChecklist
                researchId={researchId}
                items={checklist}
                onHide={() => setHiddenFor(researchId)}
                onFinish={() => setHiddenFor(researchId)}
              />
            </div>
          )}
          <section
            className="hm-card hm-flow"
            aria-labelledby="hm-flow-heading"
          >
            <div className="hm-card-head">
              <h2 id="hm-flow-heading">{t("연구 흐름")}</h2>
              <Link className="hm-more" to={`${base}/flow`}>
                {t("열기")}
                <Icon name="chevron-right" size={14} />
              </Link>
            </div>
            {phases.length ? (
              <ol className="rh-phase-track hm-phase-track">
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
                      to={`${base}/flow?phase=${phase.id}`}
                      aria-current={
                        phase.id === current?.id ? "step" : undefined
                      }
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
              <Link className="hm-more" to={`${base}/flow`}>
                <Icon name="flag" size={16} />
                {t("단계와 주요 목표 정하기")}
              </Link>
            )}
            {milestone && (
              <p className="hm-milestone">
                {t("다음 목표 · {title} · {date}", {
                  title: milestone.title,
                  date: formatDate(milestone.dueDate),
                })}
              </p>
            )}
          </section>
          <section className="hm-card hm-direction" aria-label={t("연구 방향")}>
            <ResearchDirection
              research={research}
              settingsHref={`${base}?settings=research`}
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
          </section>
        </aside>
      </div>
    </div>
  );
}

/** 주 행동 버튼. 화면의 유일한 파란 채움 버튼입니다(03 §3). */
function LeadButton({
  action,
  disabled,
}: {
  action: HomeAction;
  disabled: boolean;
}) {
  if (disabled)
    return (
      <Button
        className="rh-lead-action"
        disabled
        title={t("보관한 연구예요. 복원하면 고칠 수 있어요.")}
      >
        {action.label}
      </Button>
    );
  return (
    <Button className="rh-lead-action" fullWidth="mobile" asChild>
      <Link to={action.href} data-action={action.kind}>
        {action.label}
        <Icon name={action.icon} size={18} />
      </Link>
    </Button>
  );
}

/** 알림 줄(03 §3의 1·3·4·5번). 닫을 수 없고 조건이 사라지면 없어집니다. */
function LeadNotice({
  action,
  disabled,
}: {
  action: HomeAction;
  disabled: boolean;
}) {
  return (
    <div className="hm-notice" role="status">
      <p>{action.notice}</p>
      <LeadButton action={action} disabled={disabled} />
    </div>
  );
}

function meetingWhen(meeting: Meeting): string {
  if (!meeting.date) return t("날짜 미정");
  const time = meeting.time ? formatClock(meeting.time) : "";
  if (meeting.date === seoulToday())
    return time ? t("오늘 {time}", { time }) : t("오늘");
  const day = formatDate(meeting.date);
  const relative = relativeDay(meeting.date);
  return [time ? `${day} ${time}` : day, relative].filter(Boolean).join(" · ");
}

/** 다음 미팅 카드(03 §4) */
function NextMeetingCard({
  base,
  next,
  action,
  disabled,
  hasRecords,
}: {
  base: string;
  next?: Meeting;
  action: HomeAction;
  disabled: boolean;
  hasRecords: boolean;
}) {
  const { data } = useWorkspace();
  // 알림 줄이 있으면 파란 버튼은 그쪽에 있고, 카드의 버튼은 테두리 버튼입니다.
  const cardHasLead = !action.notice;
  const researchId = base.slice(3);
  const polls = data.polls.filter(
    (poll) => poll.researchId === researchId && poll.status === "open",
  );
  const poll = polls[0];
  if (!next)
    return (
      <section className="hm-card hm-meeting" aria-labelledby="hm-next-heading">
        <h2 id="hm-next-heading" className="hm-label">
          {t("다음 미팅")}
        </h2>
        <p className="hm-meeting-title">
          {hasRecords ? t("다음 미팅이 아직 없어요") : t("아직 기록이 없어요.")}
        </p>
        <div className="hm-actions">
          {cardHasLead ? (
            <LeadButton action={action} disabled={disabled} />
          ) : (
            <Button variant="outline" asChild>
              <Link to={`${base}/meetings?new=1`}>{t("다음 미팅 잡기")}</Link>
            </Button>
          )}
          {!hasRecords && (
            <span className="hm-text-links">
              <Link to={`${base}/meetings?new=1&intent=record`}>
                {t("녹음 시작")}
              </Link>
              <span aria-hidden="true">·</span>
              <Link to={`${base}/meetings?new=1&intent=written`}>
                {t("서면 피드백 붙여넣기")}
              </Link>
            </span>
          )}
        </div>
        {poll && <PollLine base={base} poll={poll} />}
      </section>
    );
  const tasks = data.tasks.filter(
    (task) => next.taskIds.includes(task.id) && !task.archivedAt,
  );
  const done = tasks.filter((task) => task.status === "done").length;
  const versions = next.versionIds.length;
  const questions = data.questions.filter(
    (question) =>
      next.questionIds.includes(question.id) && !question.archivedAt,
  ).length;
  const summary = [
    tasks.length
      ? t("가져갈 할 일 {done}/{total} 끝냄", { done, total: tasks.length })
      : "",
    versions ? t("보여 줄 글·자료 {count}개", { count: versions }) : "",
    questions ? t("질문 {count}개", { count: questions }) : "",
  ].filter(Boolean);
  return (
    <section className="hm-card hm-meeting" aria-labelledby="hm-next-heading">
      <h2 id="hm-next-heading" className="hm-label">
        {t("다음 미팅")}
      </h2>
      <p className="hm-when">{meetingWhen(next)}</p>
      <p className="hm-meeting-title">
        <Link to={`${base}/meetings/${next.id}?tab=prepare`} title={next.title}>
          {next.title}
        </Link>
      </p>
      <p className="hm-summary">
        {summary.length ? summary.join(" · ") : t("아직 준비한 내용이 없어요.")}
      </p>
      <div className="hm-actions">
        <Button variant="outline" asChild>
          <Link to={`${base}/meetings/${next.id}`}>{t("기록 열기")}</Link>
        </Button>
        {cardHasLead ? (
          <LeadButton action={action} disabled={disabled} />
        ) : (
          <Button variant="outline" asChild>
            <Link to={`${base}/meetings/${next.id}?tab=prepare`}>
              {t("미팅 준비하기")}
            </Link>
          </Button>
        )}
      </div>
      {poll && <PollLine base={base} poll={poll} />}
    </section>
  );
}

function PollLine({
  base,
  poll,
}: {
  base: string;
  poll: { id: string; title: string; participants: { available: string[] }[] };
}) {
  const answered = poll.participants.filter(
    (person) => person.available.length > 0,
  ).length;
  return (
    <Link className="hm-poll" to={`${base}/meetings?type=poll`}>
      {t("‘{title}’ 조율 중 · {total}명 중 {answered}명 응답", {
        title: poll.title,
        total: poll.participants.length,
        answered,
      })}
      <Icon name="chevron-right" size={14} />
    </Link>
  );
}

/** 목록 탭 넷(03 §5). 주소 `?tab=`에 남기고 연구별로 마지막 탭을 기억합니다. */
function HomeLists({
  researchId,
  isCollaborative,
  archived,
  updates,
  nextMeeting,
}: {
  researchId: string;
  isCollaborative: boolean;
  archived: boolean;
  updates: ReviewNotification[];
  nextMeeting?: Meeting;
}) {
  const { data, user, save, remove } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const completion = useTaskCompletion(save);
  const rowMotion = useTaskRowMotion();
  const [adding, setAdding] = useState(false);
  const [scope, setScope] = useState("mine");
  const [makingTask, setMakingTask] = useState<string | null>(null);
  const base = `/r/${researchId}`;
  const today = seoulToday();
  const tab = readHomeTab(params.get("tab"), researchId);
  function setTab(next: HomeTab) {
    rememberHomeTab(researchId, next);
    const rest = new URLSearchParams(params);
    rest.set("tab", next);
    setParams(rest, { replace: true });
  }

  const feedback = data.feedback.filter(
    (item) => item.researchId === researchId,
  );
  const meetings = data.meetings.filter(
    (meeting) => meeting.researchId === researchId && !meeting.archivedAt,
  );
  const taskPool = data.tasks.filter(
    (task) =>
      task.researchId === researchId &&
      !task.archivedAt &&
      (task.status !== "done" ||
        completion.held.has(task.id) ||
        completion.recent.has(task.id)) &&
      (!isCollaborative ||
        scope === "all" ||
        !task.assigneeId ||
        task.assigneeId === user.id),
  );
  const ordered = homeTaskOrder(taskPool, nextMeeting?.taskIds ?? []);
  const pending = data.aiCandidates.filter(
    (candidate) =>
      candidate.researchId === researchId &&
      candidate.status === "pending" &&
      // 본문 안 수정 제안은 글 편집 화면에서만 다룹니다(IA v2 05 §3.6).
      candidate.mode !== "suggest_edits",
  );
  const events = data.events
    .filter((event) => event.researchId === researchId)
    .sort(
      (a, b) =>
        Number(!!a.readAt) - Number(!!b.readAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const unreadEvents = events.filter((event) => !event.readAt).length;
  const recentMeetings = meetings
    .filter((meeting) => meeting.status !== "cancelled")
    .sort((a, b) =>
      `${b.date ?? ""}${b.updatedAt}`.localeCompare(
        `${a.date ?? ""}${a.updatedAt}`,
      ),
    )
    .slice(0, 5);
  const docs = [
    ...data.documents
      .filter((doc) => doc.researchId === researchId && !doc.archivedAt)
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        kind: t("글"),
        href: `${base}/docs/w/${doc.id}`,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
        versions: data.documentVersions.filter(
          (version) => version.documentId === doc.id,
        ).length,
      })),
    ...data.materials
      .filter((item) => item.researchId === researchId && !item.archivedAt)
      .map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.externalUrl ? t("링크") : t("자료"),
        href: `${base}/docs/m/${item.id}`,
        updatedAt: item.updatedAt,
        updatedBy: item.updatedBy,
        versions: data.versions.filter(
          (version) => version.materialId === item.id,
        ).length,
      })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const members = data.members.filter(
    (member) => member.researchId === researchId && member.status === "active",
  );

  async function addTask(title: string) {
    try {
      const task = await save("tasks", {
        ...recordBase(researchId),
        origin: "manual",
        title,
        description: "",
        status: "todo",
        dueDate: null,
        priority: "normal",
        visibility: "private",
        feedbackIds: [],
      } as Task);
      toast.success(t("할 일을 추가했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => void remove("tasks", task.id),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
      throw error;
    }
  }
  // 알림에서 바로 할 일을 만듭니다. 알림은 읽음으로 바꾸지 않아요(작업·읽음 분리).
  async function makeTask(event: ReviewNotification, title: string) {
    if (makingTask) return;
    setMakingTask(event.id);
    try {
      await save("tasks", {
        ...recordBase(researchId),
        origin: "manual",
        title,
        description: event.excerpt ?? "",
        status: "todo",
        dueDate: null,
        priority: "normal",
        visibility: "private",
        feedbackIds: [],
      } as Task);
      toast.success(
        t("할 일로 만들었어요. 알림은 확인할 때까지 여기에 남아요."),
      );
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setMakingTask(null);
    }
  }

  const openTasks = ordered.first.length + ordered.rest.length;
  const alertCount = updates.length + unreadEvents;
  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      today={today}
      source={taskSource(task, feedback, meetings)}
      completion={completion}
      rowMotion={rowMotion}
    />
  );
  const firstShown = ordered.first.slice(0, LIST_MAX);
  const restShown = ordered.rest.slice(
    0,
    Math.max(0, LIST_MAX - firstShown.length),
  );

  return (
    <section className="hm-card hm-lists" aria-label={t("홈 목록")}>
      <div
        className="hm-lists-head"
        onFocusCapture={(event) => {
          const tab = event.target.closest('[role="tab"]');
          const strip = tab?.closest<HTMLElement>(".margin-tabs");
          if (!strip || !tab) return;
          const bounds = strip.getBoundingClientRect();
          const item = tab.getBoundingClientRect();
          if (item.left < bounds.left)
            strip.scrollLeft += item.left - bounds.left;
          else if (item.right > bounds.right)
            strip.scrollLeft += item.right - bounds.right;
        }}
      >
        <Tabs
          label={t("홈 목록")}
          value={tab}
          onChange={(value) => setTab(value as HomeTab)}
          options={HOME_TABS.map((key) => ({
            value: key,
            label: {
              tasks: t("할 일"),
              alerts: t("알림"),
              meetings: t("최근 미팅"),
              docs: t("최근 글·자료"),
            }[key],
            count:
              key === "tasks"
                ? openTasks
                : key === "alerts"
                  ? alertCount
                  : undefined,
          }))}
        />
        {tab === "tasks" && isCollaborative && (
          <Segments
            label={t("할 일 범위")}
            size="small"
            value={scope}
            onChange={setScope}
            options={[
              { value: "mine", label: t("내 할 일") },
              { value: "all", label: t("모두") },
            ]}
          />
        )}
      </div>
      {tab === "tasks" && (
        <div className="hm-list">
          <AnimatePresence initial={false}>
            {firstShown.map(row)}
          </AnimatePresence>
          {firstShown.length > 0 && restShown.length > 0 && (
            <h3 className="hm-subhead">{t("그 밖의 할 일")}</h3>
          )}
          <AnimatePresence initial={false}>
            {restShown.map(row)}
          </AnimatePresence>
          {!openTasks && (
            <p className="hm-empty">{t("남은 할 일이 없어요.")}</p>
          )}
          {adding ? (
            <QuickTaskInput onAdd={addTask} onClose={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              className="hm-add"
              disabled={archived}
              title={
                archived
                  ? t("보관한 연구예요. 복원하면 고칠 수 있어요.")
                  : undefined
              }
              onClick={() => setAdding(true)}
            >
              <Icon name="plus" size={16} />
              {t("할 일 추가")}
            </button>
          )}
          <Link className="hm-more hm-more-end" to={`${base}/tasks`}>
            {t("할 일 전체 보기")}
            <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      )}
      {tab === "alerts" && (
        <div className="hm-list">
          {pending.length > 0 && (
            <Link
              className="hm-row"
              to="?panel=assistant&panelView=suggestions"
            >
              <Icon name="sparkles" size={16} />
              <span>
                {t("확인할 AI 제안 {count}개", { count: pending.length })}
              </span>
            </Link>
          )}
          {updates.slice(0, LIST_MAX).map((event) => {
            const decision = reviewDecision(event);
            return (
              <div key={event.id} className="hm-row is-unread">
                <span className="hm-dot" aria-hidden="true" />
                <Link className="hm-row-main" to={notificationHref(event)}>
                  <strong title={event.title}>{event.title}</strong>
                  <small>{event.message}</small>
                </Link>
                {decision.canMakeTask && (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={!!makingTask || archived}
                    onClick={() => void makeTask(event, decision.taskTitle)}
                  >
                    {t("할 일 추가")}
                  </Button>
                )}
              </div>
            );
          })}
          {events
            .slice(0, Math.max(0, LIST_MAX - updates.length))
            .map((event) => (
              <Link
                key={event.id}
                className={`hm-row ${event.readAt ? "" : "is-unread"}`}
                to={event.href}
              >
                <span className="hm-dot" aria-hidden="true" />
                <span className="hm-row-main">
                  <strong>
                    {event.actorName} · {event.title}
                  </strong>
                  <small>
                    {new Date(event.createdAt).toLocaleDateString(
                      dateLocale(),
                      {
                        month: "numeric",
                        day: "numeric",
                      },
                    )}
                  </small>
                </span>
              </Link>
            ))}
          {!pending.length && !updates.length && !events.length && (
            <p className="hm-empty">{t("확인할 새 알림이 없어요.")}</p>
          )}
        </div>
      )}
      {tab === "meetings" && (
        <div className="hm-list">
          {recentMeetings.map((meeting) => {
            const left = data.tasks.filter(
              (task) =>
                meeting.taskIds.includes(task.id) &&
                !task.archivedAt &&
                task.status !== "done",
            ).length;
            return (
              <Link
                key={meeting.id}
                className="hm-row"
                to={`${base}/meetings/${meeting.id}`}
              >
                <Icon name="calendar" size={16} />
                <span className="hm-row-main">
                  <strong title={meeting.title}>{meeting.title}</strong>
                  <small>
                    {formatDate(meeting.date)}
                    {left > 0 &&
                      ` · ${t("남은 할 일 {count}개", { count: left })}`}
                  </small>
                </span>
              </Link>
            );
          })}
          {!recentMeetings.length && (
            <div className="hm-empty-block">
              <p className="hm-empty">{t("아직 기록이 없어요.")}</p>
              <Button variant="outline" size="sm" asChild>
                <Link to={`${base}/meetings?new=1`}>{t("미팅 만들기")}</Link>
              </Button>
            </div>
          )}
          <Link className="hm-more hm-more-end" to={`${base}/meetings`}>
            {t("미팅 전체 보기")}
            <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      )}
      {tab === "docs" && (
        <div className="hm-list">
          {docs.map((doc) => {
            const author = members.find(
              (member) => member.userId === doc.updatedBy,
            )?.name;
            return (
              <Link key={doc.id} className="hm-row" to={doc.href}>
                <Icon name="file" size={16} />
                <span className="hm-row-main">
                  <strong title={doc.title}>{doc.title}</strong>
                  <small>
                    {doc.kind} ·{" "}
                    {t("{when} 저장", {
                      when: formatDateTime(doc.updatedAt, { time: false }),
                    })}
                    {doc.versions > 0 &&
                      ` · ${t("버전 {count}개", { count: doc.versions })}`}
                    {isCollaborative && author && ` · ${author}`}
                  </small>
                </span>
              </Link>
            );
          })}
          {!docs.length && (
            <div className="hm-empty-block">
              <p className="hm-empty">{t("아직 글이나 자료가 없어요.")}</p>
              <Button variant="outline" size="sm" asChild>
                <Link to={`${base}/docs?new=1`}>{t("글 만들기")}</Link>
              </Button>
            </div>
          )}
          <Link className="hm-more hm-more-end" to={`${base}/docs`}>
            {t("글·자료 전체 보기")}
            <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}
