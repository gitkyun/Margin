import { t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/icons";
import { PageHeader, EmptyState } from "@/components/common";
import { Segments, SelectField } from "@/components/experience";
import { WeekStrip } from "@/components/home/WeekStrip";
import { QuickTaskInput, TaskRow } from "@/components/tasks/TaskRow";
import { useTaskRowMotion } from "@/components/task-row-motion";
import { SearchInput } from "@/pages/student/shared";
import { useWorkspace } from "@/lib/workspace";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { useMediaQuery } from "@/lib/use-media-query";
import { seoulToday } from "@/lib/home-meeting";
import { friendlyError } from "@/lib/supabase";
import { doneToday, groupTasks, taskSource } from "@/lib/task-groups";
import {
  feedbackLabels,
  priorityLabels,
  recordBase,
  responseLabels,
  type Feedback,
  type Task,
  type WorkspaceData,
} from "@/lib/domain";
import type { DetailHistoryState } from "@/lib/item-detail";
import "@/components/tasks/tasks.css";
import { handleListKeys } from "@/lib/list-keys";

const DETAIL_STATE: DetailHistoryState = { layer: "detail", depth: 1 };

/** 피드백 탭의 기본 필터: 남은 피드백(시작 전·진행 중) */
const OPEN_FEEDBACK: Feedback["status"][] = ["unprocessed", "in_progress"];

export function remainingFeedback(feedback: Feedback[]): Feedback[] {
  return feedback.filter((item) => OPEN_FEEDBACK.includes(item.status));
}

/**
 * 할 일 화면(IA v2 T1, 06 §3.1). `할 일 | 피드백` 탭으로 지금의 할 일·피드백 화면을 대신합니다.
 * 줄을 누르면 사이드 창 자리에 항목 상세가 열립니다.
 */
export function TasksHome() {
  const { researchId = "" } = useParams();
  const { data, user, save, remove } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "feedback" ? "feedback" : "tasks";
  const research = data.researches.find((item) => item.id === researchId);
  const feedback = data.feedback.filter(
    (item) => item.researchId === researchId && !item.archivedAt,
  );
  const openTasks = data.tasks.filter(
    (task) =>
      task.researchId === researchId &&
      !task.archivedAt &&
      task.status !== "done",
  );
  const [adding, setAdding] = useState(false);
  // `?new=task&feedback=`(01 §3.3): 할 일 보기에서 빠른 추가 줄을 열고, 그 피드백에 잇습니다.
  const [addFeedbackId, setAddFeedbackId] = useState<string | null>(null);
  const addFeedback = feedback.find((item) => item.id === addFeedbackId);
  useEffect(() => {
    if (params.get("new") !== "task") return;
    setAddFeedbackId(params.get("feedback"));
    setAdding(true);
    const next = new URLSearchParams(params);
    for (const key of ["new", "feedback", "view"]) next.delete(key);
    setParams(next, { replace: true });
  }, [params.get("new")]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

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
        feedbackIds: addFeedback ? [addFeedback.id] : [],
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

  if (!research) return null;
  return (
    <div className="tasks-home">
      <PageHeader
        title={t("할 일")}
        actions={
          view === "tasks" ? (
            <>
              <span className="page-action-wide">
                <Button onClick={() => setAdding(true)}>
                  <Icon name="plus" size={17} />
                  {t("할 일 추가")}
                </Button>
              </span>
              <span className="page-action-narrow">
                <Button
                  size="icon"
                  aria-label={t("할 일 추가")}
                  onClick={() => setAdding(true)}
                >
                  <Icon name="plus" size={18} />
                </Button>
              </span>
            </>
          ) : (
            <Button asChild>
              <Link to="?view=feedback&new=feedback">
                <Icon name="plus" size={17} />
                {t("피드백 추가")}
              </Link>
            </Button>
          )
        }
      />
      <Tabs
        label={t("할 일 보기")}
        value={view}
        onChange={(value) =>
          setParam("view", value === "feedback" ? value : null)
        }
        options={[
          { value: "tasks", label: t("할 일"), count: openTasks.length },
          {
            value: "feedback",
            label: t("피드백"),
            count: remainingFeedback(feedback).length,
          },
        ]}
      />
      {view === "tasks" ? (
        <TaskList
          data={data}
          researchId={researchId}
          userId={user.id}
          ownerId={research.ownerId}
          adding={adding}
          addNote={
            addFeedback
              ? t("‘{title}’ 피드백에 이어요.", { title: addFeedback.title })
              : undefined
          }
          onCloseAdd={() => {
            setAdding(false);
            setAddFeedbackId(null);
          }}
          onAdd={addTask}
          params={params}
          setParam={setParam}
        />
      ) : (
        <FeedbackList
          data={data}
          feedback={feedback}
          researchId={researchId}
          params={params}
          setParam={setParam}
        />
      )}
    </div>
  );
}

function TaskList({
  data,
  researchId,
  userId,
  ownerId,
  adding,
  addNote,
  onCloseAdd,
  onAdd,
  params,
  setParam,
}: {
  data: WorkspaceData;
  researchId: string;
  userId: string;
  ownerId: string;
  adding: boolean;
  /** 빠른 추가 줄 아래 한 줄 안내(이어 둘 피드백) */
  addNote?: string;
  onCloseAdd(): void;
  onAdd(title: string): Promise<void>;
  params: URLSearchParams;
  setParam(key: string, value: string | null): void;
}) {
  const { save } = useWorkspace();
  const completion = useTaskCompletion(save);
  const rowMotion = useTaskRowMotion();
  const swipeable = useMediaQuery("(max-width: 767px)");
  const today = seoulToday();
  const status = params.get("status") ?? "active";
  const query = params.get("q") ?? "";
  const [priority, setPriority] = useState("all");
  const [meetingId, setMeetingId] = useState("all");
  const [scope, setScope] = useState("all");
  const [day, setDay] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const members = data.members.filter(
    (member) => member.researchId === researchId && member.status === "active",
  );
  const collaborative = members.some((member) => member.userId !== ownerId);
  const meetings = data.meetings.filter(
    (meeting) =>
      meeting.researchId === researchId && meeting.status !== "cancelled",
  );
  const feedback = data.feedback.filter(
    (item) => item.researchId === researchId,
  );
  const dayMeeting = day
    ? meetings.some((meeting) => meeting.date === day)
    : false;

  const base = data.tasks.filter(
    (task) =>
      task.researchId === researchId &&
      (status === "archived" ? !!task.archivedAt : !task.archivedAt),
  );
  const filtered = base
    .filter(
      (task) =>
        !query ||
        `${task.title} ${task.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .filter((task) => priority === "all" || task.priority === priority)
    .filter(
      (task) =>
        meetingId === "all" ||
        meetings
          .find((meeting) => meeting.id === meetingId)
          ?.taskIds.includes(task.id) ||
        feedback.some(
          (item) =>
            item.meetingId === meetingId && task.feedbackIds.includes(item.id),
        ),
    )
    .filter(
      (task) =>
        !collaborative ||
        scope === "all" ||
        !task.assigneeId ||
        task.assigneeId === userId,
    )
    .filter((task) => !day || task.dueDate === day);
  // 체크한 줄은 되돌리기 시간 동안 자리에 남깁니다(지금 할 일 화면과 같음).
  const lingering = (task: Task) =>
    completion.held.has(task.id) || completion.recent.has(task.id);
  const shown = filtered.filter((task) =>
    status === "active"
      ? task.status !== "done" || lingering(task)
      : status === "done"
        ? task.status === "done"
        : true,
  );
  const groups = groupTasks(shown, today);
  const finishedToday =
    status === "active"
      ? doneToday(filtered, today).filter((task) => !lingering(task))
      : [];
  const source = useMemo(
    () => (task: Task) => taskSource(task, feedback, meetings),
    [feedback, meetings],
  );
  const filtering =
    !!query || priority !== "all" || meetingId !== "all" || !!day;

  return (
    <>
      <WeekStrip
        data={data}
        researchId={researchId}
        filterDay={day}
        onFilterDay={setDay}
      />
      <div className="page-toolbar">
        <Segments
          value={status}
          onChange={(value) =>
            setParam("status", value === "active" ? null : value)
          }
          label={t("할 일 상태")}
          options={[
            { value: "active", label: t("남은 할 일") },
            { value: "done", label: t("완료") },
            { value: "all", label: t("전체") },
            { value: "archived", label: t("보관함") },
          ]}
        />
        <SearchInput
          value={query}
          onChange={(value) => setParam("q", value || null)}
          placeholder={t("할 일에서 찾기")}
        />
      </div>
      <div className="tasks-filters">
        <label>
          {t("우선순위")}
          <SelectField
            className="native-select"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="all">{t("전체")}</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </label>
        <label>
          {t("기록")}
          <SelectField
            className="native-select"
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
          >
            <option value="all">{t("모든 기록")}</option>
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.title}
              </option>
            ))}
          </SelectField>
        </label>
        {collaborative && (
          <Segments
            value={scope}
            onChange={setScope}
            label={t("누구의 할 일")}
            size="small"
            options={[
              { value: "mine", label: t("내 할 일") },
              { value: "all", label: t("모두") },
            ]}
          />
        )}
      </div>
      {day && (
        <p className="tasks-day-filter" role="status">
          {t("{month}월 {day}일 기한인 할 일만 보고 있어요.", {
            month: Number(day.slice(5, 7)),
            day: Number(day.slice(8, 10)),
          })}
          {dayMeeting && ` ${t("이날 미팅이 있어요.")}`}{" "}
          <Button variant="link" size="sm" onClick={() => setDay(null)}>
            {t("날짜 풀기")}
          </Button>
        </p>
      )}
      {adding && (
        <QuickTaskInput onAdd={onAdd} onClose={onCloseAdd} note={addNote} />
      )}
      {groups.length ? (
        <div className="tasks-groups" onKeyDown={handleListKeys}>
          {groups.map((group) => (
            <section
              key={group.key}
              className="tasks-group"
              aria-labelledby={`tasks-group-${group.key}`}
            >
              <h2 id={`tasks-group-${group.key}`}>
                {group.label}
                <span>{group.tasks.length}</span>
              </h2>
              <AnimatePresence initial={false}>
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    source={source(task)}
                    completion={completion}
                    rowMotion={rowMotion}
                    swipeable={swipeable}
                  />
                ))}
              </AnimatePresence>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="tasks"
          title={
            filtering
              ? t("조건에 맞는 할 일이 없어요.")
              : status === "archived"
                ? t("보관한 할 일이 없어요.")
                : t("남은 할 일이 없어요.")
          }
        />
      )}
      {finishedToday.length > 0 && (
        <section className="tasks-group tasks-finished">
          <button
            type="button"
            className="tasks-finished-toggle"
            aria-expanded={showDone}
            onClick={() => setShowDone(!showDone)}
          >
            <Icon
              name={showDone ? "chevron-down" : "chevron-right"}
              size={16}
            />
            {t("오늘 끝낸 할 일 {count}개", { count: finishedToday.length })}
          </button>
          {showDone &&
            finishedToday.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                source={source(task)}
                completion={completion}
                rowMotion={rowMotion}
              />
            ))}
        </section>
      )}
    </>
  );
}

const FEEDBACK_STATUSES = Object.keys(feedbackLabels) as Feedback["status"][];

function FeedbackList({
  data,
  feedback,
  researchId,
  params,
  setParam,
}: {
  data: WorkspaceData;
  feedback: Feedback[];
  researchId: string;
  params: URLSearchParams;
  setParam(key: string, value: string | null): void;
}) {
  const query = params.get("q") ?? "";
  const raw = params.get("fstatus");
  const archived = raw === "archived";
  const statuses: Feedback["status"][] = raw
    ? (raw
        .split(",")
        .filter((value) =>
          (FEEDBACK_STATUSES as string[]).includes(value),
        ) as Feedback["status"][])
    : OPEN_FEEDBACK;
  const [meetingId, setMeetingId] = useState("all");
  const list = (
    archived
      ? data.feedback.filter(
          (item) => item.researchId === researchId && !!item.archivedAt,
        )
      : feedback.filter((item) => statuses.includes(item.status))
  )
    .filter((item) => meetingId === "all" || item.meetingId === meetingId)
    .filter(
      (item) =>
        !query ||
        `${item.title} ${item.body}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const meetings = data.meetings
    .filter((meeting) => meeting.researchId === researchId)
    .sort((a, b) =>
      `${b.date ?? ""}${b.createdAt}`.localeCompare(
        `${a.date ?? ""}${a.createdAt}`,
      ),
    );
  const groups = [
    ...meetings
      .map((meeting) => ({
        key: meeting.id,
        label: meeting.title,
        items: list.filter((item) => item.meetingId === meeting.id),
      }))
      .filter((group) => group.items.length),
    {
      key: "none",
      label: t("기록 없이 추가한 피드백"),
      items: list.filter(
        (item) =>
          !item.meetingId ||
          !meetings.some((meeting) => meeting.id === item.meetingId),
      ),
    },
  ].filter((group) => group.items.length);

  function toggleStatus(value: Feedback["status"]) {
    const next = statuses.includes(value)
      ? statuses.filter((item) => item !== value)
      : [...statuses, value];
    const same =
      next.length === OPEN_FEEDBACK.length &&
      next.every((item) => OPEN_FEEDBACK.includes(item));
    setParam("fstatus", same ? null : next.join(",") || "none");
  }

  return (
    <>
      <div className="page-toolbar">
        <div
          className="feedback-status-chips"
          role="group"
          aria-label={t("피드백 상태")}
        >
          {FEEDBACK_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              className="feedback-status-chip"
              aria-pressed={!archived && statuses.includes(value)}
              onClick={() => toggleStatus(value)}
            >
              {feedbackLabels[value]}
            </button>
          ))}
          <button
            type="button"
            className="feedback-status-chip"
            aria-pressed={archived}
            onClick={() => setParam("fstatus", archived ? null : "archived")}
          >
            {t("보관함")}
          </button>
        </div>
        <SearchInput
          value={query}
          onChange={(value) => setParam("q", value || null)}
          placeholder={t("피드백에서 찾기")}
        />
      </div>
      <div className="tasks-filters">
        <label>
          {t("기록")}
          <SelectField
            className="native-select"
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
          >
            <option value="all">{t("모든 기록")}</option>
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.title}
              </option>
            ))}
          </SelectField>
        </label>
      </div>
      {groups.length ? (
        <div className="tasks-groups" onKeyDown={handleListKeys}>
          {groups.map((group) => (
            <section
              key={group.key}
              className="tasks-group"
              aria-labelledby={`feedback-group-${group.key}`}
            >
              <h2 id={`feedback-group-${group.key}`}>
                {group.label}
                <span>{group.items.length}</span>
              </h2>
              {group.items.map((item) => (
                <FeedbackLine key={item.id} data={data} feedback={item} />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="feedback"
          title={
            query || meetingId !== "all"
              ? t("조건에 맞는 피드백이 없어요.")
              : t("남은 피드백이 없어요.")
          }
        />
      )}
    </>
  );
}

function FeedbackLine({
  data,
  feedback,
}: {
  data: WorkspaceData;
  feedback: Feedback;
}) {
  const tasks = data.tasks.filter(
    (task) => task.feedbackIds.includes(feedback.id) && !task.archivedAt,
  );
  const done = tasks.filter((task) => task.status === "done").length;
  const results = data.results
    .filter((result) => result.feedbackIds.includes(feedback.id))
    .map((result) => result.id);
  const items = data.reviewItems.filter((item) =>
    results.includes(item.resultId),
  );
  const round = data.rounds
    .filter((item) => items.some((reviewItem) => reviewItem.id === item.itemId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const response = round
    ? data.responses
        .filter((item) => item.roundId === round.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    : undefined;
  const params = new URLSearchParams(window.location.search);
  params.set("detail", `feedback:${feedback.id}`);
  return (
    <Link
      className="task-line task-line-feedback"
      to={{ search: `?${params.toString()}` }}
      state={DETAIL_STATE}
    >
      <span className="task-line-text">
        <strong>{feedback.title}</strong>
        <small>
          {feedbackLabels[feedback.status]}
          {tasks.length > 0 &&
            ` · ${t("할 일 {done}/{total}", { done, total: tasks.length })}`}
        </small>
      </span>
      {response && (
        <span className="task-line-badge">
          {responseLabels[response.result]}
        </span>
      )}
    </Link>
  );
}
