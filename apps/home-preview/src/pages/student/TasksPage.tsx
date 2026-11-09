import { WorkTabs } from "./shared";
import {
  SelectField,
  Segments,
  VisibilityField,
} from "@/components/experience";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { AnimatePresence, motion } from "motion/react";
import { useTaskRowMotion } from "@/components/task-row-motion";
import {
  formatDate,
  originLabels,
  recordBase,
  taskLabels,
  type Task,
} from "@/lib/domain";
import {
  BackLink,
  ErrorNotice,
  FormDialog,
  LabeledInput,
  LabeledText,
  SaveActions,
  SearchInput,
  useSaving,
} from "./shared";
import { Checkbox } from "@montage-ui/core";
const priorityLabels = { high: "높음", normal: "보통", low: "낮음" };
export function TasksPage() {
  const taskRowMotion = useTaskRowMotion();
  const { researchId = "", taskId } = useParams();
  const { data, user, save, remove } = useWorkspace();
  const completion = useTaskCompletion(save);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = params.get("status") ?? "active",
    setFilter = (v: string) => {
      const n = new URLSearchParams(params);
      n.set("status", v);
      setParams(n);
    };
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const [priority, setPriority] = useState("all");
  const [draft, setDraft] = useState<Task | null>(null);
  const form = useSaving();
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [linkTask, setLinkTask] = useState<Task | null>(null);
  const [meetingId, setMeetingId] = useState("");
  const linkForm = useSaving();
  const [deleting, setDeleting] = useState(false);
  const deleteForm = useSaving();
  const research = data.researches.find((item) => item.id === researchId);
  const current = data.tasks.find(
    (item) => item.id === taskId && item.researchId === researchId,
  );
  const targetMeeting = data.meetings.find((item) => item.id === scope);
  function startCreate() {
    const feedbackId = params.get("feedback");
    setDraft({
      ...recordBase(researchId),
      origin: "manual",
      title: feedbackId
        ? (data.feedback.find((f) => f.id === feedbackId)?.title ?? "")
        : "",
      description: "",
      status: "todo",
      dueDate: null,
      priority: "normal",
      visibility: "private",
      feedbackIds:
        feedbackId &&
        data.feedback.some(
          (f) => f.id === feedbackId && f.researchId === researchId,
        )
          ? [feedbackId]
          : [],
    });
    form.setError(null);
  }
  useEffect(() => {
    if (params.get("new") === "1" && !taskId) {
      startCreate();
      setParams({}, { replace: true });
    }
  }, [params.get("new"), taskId]);
  const quickToggle = completion.toggle;
  function openLink(task: Task) {
    setLinkTask(task);
    setMeetingId(research?.nextMeetingId ?? "");
    linkForm.setError(null);
  }
  function resetFilters() {
    setFilter("all");
    setSearch("");
    setScope("all");
    setPriority("all");
  }
  const hasTasks = data.tasks.some((item) => item.researchId === researchId);
  const tasks = data.tasks
    .filter(
      (item) =>
        item.researchId === researchId &&
        (filter === "archived" ? !!item.archivedAt : !item.archivedAt),
    )
    .filter(
      (item) =>
        filter === "all" ||
        filter === "archived" ||
        (filter === "done"
          ? item.status === "done"
          : item.status !== "done" || completion.held.has(item.id)),
    )
    .filter(
      (item) =>
        !search ||
        `${item.title} ${item.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .filter((item) => priority === "all" || item.priority === priority)
    .filter(
      (item) => scope === "all" || targetMeeting?.taskIds.includes(item.id),
    )
    .sort(
      (a, b) =>
        ({ high: 0, normal: 1, low: 2 })[a.priority] -
          { high: 0, normal: 1, low: 2 }[b.priority] ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    );
  if (taskId && !current)
    return (
      <>
        <BackLink to={`/r/${researchId}/tasks`}>할 일 목록</BackLink>
        <EmptyState
          title="할 일을 열 수 없어요"
          description="이 연구에서 할 일을 찾을 수 없어요. 할 일 목록에서 다시 선택해 주세요."
        />
      </>
    );
  return (
    <div className="student-page">
      <WorkTabs researchId={researchId} selected="tasks" />
      {current ? (
        <>
          <BackLink to={`/r/${researchId}/tasks`}>할 일 목록</BackLink>
          <PageHeader
            title={current.title}
            description="상태와 기한을 바꾸고 관련 기록을 확인하세요."
            actions={
              <Button
                variant="outline"
                onClick={() => {
                  setDraft({ ...current });
                  form.setError(null);
                }}
              >
                <Icon name="edit" size={16} />할 일 편집
              </Button>
            }
          />
          <div className="task-detail-grid">
            <section className="surface task-detail-main">
              <div className="section-heading">
                <h2>할 일 내용</h2>
                <StatusBadge
                  tone={
                    current.status === "done"
                      ? "green"
                      : current.status === "doing"
                        ? "blue"
                        : "neutral"
                  }
                >
                  {taskLabels[current.status]}
                </StatusBadge>
              </div>
              {current.origin && (
                <p className="meta">{originLabels[current.origin]}</p>
              )}
              <p className="student-body-text">
                {current.description || "설명이 없어요."}
              </p>
              <div className="task-property-grid">
                <div>
                  <span>기한</span>
                  <strong>{formatDate(current.dueDate)}</strong>
                </div>
                <div>
                  <span>우선순위</span>
                  <strong>{priorityLabels[current.priority]}</strong>
                </div>
              </div>
              <div className="button-row">
                <Button
                  variant={current.status === "done" ? "outline" : "default"}
                  disabled={
                    !!current.archivedAt ||
                    busyIds.includes(current.id) ||
                    completion.busy.has(current.id)
                  }
                  onClick={() => void quickToggle(current)}
                >
                  <Icon name="check" size={16} />
                  {current.status === "done" ? "완료 취소" : "완료로 표시"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!!current.archivedAt}
                  onClick={() => openLink(current)}
                >
                  미팅 준비에 포함
                  <Icon name="arrow-right" size={15} />
                </Button>
              </div>
              <p className="student-footnote">
                할 일 완료는 수정 결과 작성이나 교수 검토와 별개예요.
              </p>
            </section>
            <aside className="surface">
              <h2>관련 기록</h2>
              {current.feedbackIds.length > 0 && (
                <div className="student-subsection">
                  <h3>피드백</h3>
                  {data.feedback
                    .filter((f) => current.feedbackIds.includes(f.id))
                    .map((f) => (
                      <Link
                        key={f.id}
                        className="student-simple-row"
                        to={`/r/${researchId}/feedback/${f.id}`}
                      >
                        <span className="grow">
                          <strong>{f.title}</strong>
                        </span>
                        <Icon name="chevron-right" size={15} />
                      </Link>
                    ))}
                </div>
              )}
              {current.planId && (
                <div className="student-subsection">
                  <h3>수정 방법</h3>
                  <p className="student-body-text">
                    {data.plans.find((p) => p.id === current.planId)?.title ??
                      "연결한 수정 방법"}
                  </p>
                  {data.plans.find((p) => p.id === current.planId)?.status ===
                    "cancelled" && (
                    <StatusBadge tone="neutral">선택 취소됨</StatusBadge>
                  )}
                </div>
              )}
              <div className="student-subsection">
                <h3>준비에 포함한 미팅</h3>
                {data.meetings.filter((m) => m.taskIds.includes(current.id))
                  .length ? (
                  data.meetings
                    .filter((m) => m.taskIds.includes(current.id))
                    .map((m) => (
                      <Link
                        key={m.id}
                        className="student-simple-row"
                        to={`/r/${researchId}/meetings/${m.id}?tab=prepare`}
                      >
                        <span className="grow">
                          <strong>{m.title}</strong>
                          <small>{formatDate(m.date)}</small>
                        </span>
                        <Icon name="chevron-right" size={15} />
                      </Link>
                    ))
                ) : (
                  <p className="student-empty-inline">
                    아직 미팅 준비에 포함하지 않았어요.
                  </p>
                )}
              </div>
              <div className="student-subsection">
                <div className="section-heading">
                  <h3>수정 결과</h3>
                  <Link
                    className="student-text-link"
                    to={`/r/${researchId}/results?task=${current.id}&new=1`}
                  >
                    작성
                    <Icon name="plus" size={14} />
                  </Link>
                </div>
                {data.results
                  .filter((r) => r.taskIds.includes(current.id))
                  .map((result) => (
                    <Link
                      className="student-simple-row"
                      key={result.id}
                      to={`/r/${researchId}/results/${result.id}`}
                    >
                      <span className="grow">
                        <strong>{result.title}</strong>
                      </span>
                      <Icon name="chevron-right" size={15} />
                    </Link>
                  ))}
              </div>
            </aside>
          </div>
          <div className="student-bottom-actions">
            {current.archivedAt ? (
              <Button
                variant="outline"
                disabled={busyIds.includes(current.id)}
                onClick={async () => {
                  setBusyIds((ids) => [...ids, current.id]);
                  try {
                    await save("tasks", { ...current, archivedAt: undefined });
                    toast.success("할 일을 복원했어요");
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusyIds((ids) => ids.filter((id) => id !== current.id));
                  }
                }}
              >
                <Icon name="archive" size={15} />할 일 복원
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleting(true);
                  deleteForm.setError(null);
                }}
              >
                <Icon name="archive" size={15} />할 일 보관
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title="할 일"
            description="미팅 준비에 포함하지 않은 할 일까지 모두 볼 수 있어요."
            actions={
              <Button onClick={startCreate}>
                <Icon name="plus" size={17} />할 일 추가
              </Button>
            }
          />
          <div className="page-toolbar">
            <Segments
              value={filter}
              onChange={setFilter}
              label="할 일 상태"
              options={[
                { value: "active", label: "남은 할 일" },
                { value: "done", label: "완료" },
                { value: "all", label: "전체" },
                { value: "archived", label: "보관함" },
              ]}
            />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="할 일에서 찾기"
            />
          </div>
          <div className="student-filter-row">
            <label>
              미팅
              <SelectField
                className="native-select"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="all">전체 할 일</option>
                {data.meetings
                  .filter(
                    (m) =>
                      m.researchId === researchId && m.status !== "cancelled",
                  )
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.title}
                    </option>
                  ))}
              </SelectField>
            </label>
            <label>
              우선순위
              <SelectField
                className="native-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="all">전체</option>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </label>
            <span className="meta">할 일 {tasks.length}개</span>
          </div>
          <section className="surface task-table">
            <div className="task-table-head">
              <span>할 일</span>
              <span>상태</span>
              <span>기한</span>
              <span />
            </div>
            {tasks.length ? (
              <AnimatePresence initial={false}>
                {tasks.map((task) => (
                  <motion.div
                    {...taskRowMotion}
                    key={task.id}
                    className={`student-task-row ${task.status === "done" ? "is-complete" : ""}`}
                  >
                    <Checkbox
                      checked={task.status === "done"}
                      onCheckedChange={() => void quickToggle(task)}
                      disabled={
                        !!task.archivedAt || completion.busy.has(task.id)
                      }
                      aria-label={`${task.title} 완료`}
                    />
                    <Link
                      className="task-row-text"
                      to={`/r/${researchId}/tasks/${task.id}`}
                    >
                      <strong>
                        {task.title}
                        {task.priority === "high" && (
                          <span
                            className="priority-dot"
                            role="img"
                            aria-label="우선순위 높음"
                          />
                        )}
                      </strong>
                      <small>
                        {task.origin && <>{originLabels[task.origin]} · </>}
                        {task.description ||
                          (task.feedbackIds.length
                            ? `관련 피드백 ${task.feedbackIds.length}개`
                            : "관련 피드백 없음")}
                      </small>
                    </Link>
                    <StatusBadge
                      tone={
                        task.status === "done"
                          ? "green"
                          : task.status === "doing"
                            ? "blue"
                            : "neutral"
                      }
                    >
                      {taskLabels[task.status]}
                    </StatusBadge>
                    <span className="task-list-date">
                      {task.status !== "done" &&
                        task.dueDate &&
                        task.dueDate <
                          new Intl.DateTimeFormat("en-CA", {
                            timeZone: "Asia/Seoul",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          }).format(new Date()) && (
                          <span className="overdue-label">기한 지남 · </span>
                        )}
                      {task.dueDate
                        ? new Intl.DateTimeFormat("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                          }).format(new Date(`${task.dueDate}T12:00:00`))
                        : "미정"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${task.title} 미팅 준비에 포함`}
                      disabled={!!task.archivedAt}
                      onClick={() => openLink(task)}
                    >
                      <Icon name="calendar" size={16} />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : hasTasks ? (
              <EmptyState
                title="조건에 맞는 할 일이 없어요"
                action={
                  <Button variant="outline" onClick={resetFilters}>
                    조건 초기화
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="아직 할 일이 없어요"
                description="직접 추가하거나 피드백의 수정 방법에서 만들 수 있어요."
                action={
                  <Button variant="outline" onClick={startCreate}>
                    할 일 추가
                  </Button>
                }
              />
            )}
          </section>
        </>
      )}
      <FormDialog
        busy={form.saving}
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        title={
          draft && data.tasks.some((t) => t.id === draft.id)
            ? "할 일 편집"
            : "할 일 추가"
        }
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft || !draft.title.trim()) {
              form.setError("제목을 입력해 주세요.");
              return;
            }
            void form.perform(async () => {
              const item = await save("tasks", {
                ...draft,
                title: draft.title.trim(),
                description: draft.description.trim(),
              });
              setDraft(null);
              toast.success("할 일을 저장했어요");
              if (!taskId) navigate(`/r/${researchId}/tasks/${item.id}`);
            });
          }}
        >
          {draft && (
            <>
              <LabeledInput
                label="제목"
                required
                value={draft.title}
                onChange={(title) => setDraft((v) => (v ? { ...v, title } : v))}
              />
              <LabeledText
                label="설명"
                value={draft.description}
                onChange={(description) =>
                  setDraft((v) => (v ? { ...v, description } : v))
                }
                rows={3}
              />
              <div className="form-grid">
                <label className="field">
                  <span className="field-name">진행 상태</span>
                  <SelectField
                    className="native-select"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((v) =>
                        v
                          ? { ...v, status: e.target.value as Task["status"] }
                          : v,
                      )
                    }
                  >
                    {Object.entries(taskLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <LabeledInput
                  label="기한"
                  type="date"
                  value={draft.dueDate ?? ""}
                  onChange={(dueDate) =>
                    setDraft((v) =>
                      v ? { ...v, dueDate: dueDate || null } : v,
                    )
                  }
                />
              </div>
              <label className="field">
                <span className="field-name">우선순위</span>
                <SelectField
                  className="native-select"
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft((v) =>
                      v
                        ? { ...v, priority: e.target.value as Task["priority"] }
                        : v,
                    )
                  }
                >
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </label>
              <div className="form-grid">
                <label className="field">
                  담당자
                  <SelectField
                    aria-label="담당자"
                    value={draft.assigneeId ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        assigneeId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">담당 미지정</option>
                    {data.members
                      .filter(
                        (m) =>
                          m.researchId === researchId && m.status === "active",
                      )
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                  </SelectField>
                </label>
                <label className="field">
                  연구 단계
                  <SelectField
                    aria-label="연구 단계"
                    value={draft.phaseId ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        phaseId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">단계 미지정</option>
                    {data.phases
                      .filter(
                        (p) => p.researchId === researchId && !p.archivedAt,
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </SelectField>
                </label>
              </div>
              <VisibilityField
                value={draft.visibility ?? "shared"}
                onChange={(visibility) => setDraft({ ...draft, visibility })}
              />
              <div className="student-picker">
                <h3>관련 피드백</h3>
                {data.feedback
                  .filter((f) => f.researchId === researchId)
                  .map((feedback) => (
                    <label className="student-choice-row" key={feedback.id}>
                      <Checkbox
                        checked={draft.feedbackIds.includes(feedback.id)}
                        onCheckedChange={(next) =>
                          setDraft((v) =>
                            v
                              ? {
                                  ...v,
                                  feedbackIds: next
                                    ? [...v.feedbackIds, feedback.id]
                                    : v.feedbackIds.filter(
                                        (id) => id !== feedback.id,
                                      ),
                                }
                              : v,
                          )
                        }
                      />
                      <span>{feedback.title}</span>
                    </label>
                  ))}
                {!data.feedback.some((f) => f.researchId === researchId) && (
                  <p className="student-empty-inline">
                    피드백 없이도 저장할 수 있어요.
                  </p>
                )}
              </div>
              {(draft.planId || current?.planId) && (
                <label className="student-choice-row">
                  <Checkbox
                    checked={!!draft.planId}
                    onCheckedChange={(next) => {
                      const checked = next;
                      setDraft((v) =>
                        v
                          ? {
                              ...v,
                              planId: checked ? current?.planId : undefined,
                            }
                          : v,
                      );
                    }}
                  />
                  <span>
                    수정 방법 연결 유지
                    <small>
                      해제해도 수정 방법과 이 할 일은 지워지지 않아요.
                    </small>
                  </span>
                </label>
              )}
            </>
          )}
          <ErrorNotice error={form.error} />
          <SaveActions saving={form.saving} onCancel={() => setDraft(null)} />
        </form>
      </FormDialog>
      <FormDialog
        busy={linkForm.saving}
        open={linkTask !== null}
        onOpenChange={(open) => {
          if (!open) setLinkTask(null);
        }}
        title="미팅 준비에 포함"
        description="할 일을 복사하지 않고 그대로 넣어요. 기한은 바뀌지 않아요."
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void linkForm.perform(async () => {
              const meeting = data.meetings.find((m) => m.id === meetingId);
              if (!meeting || !linkTask)
                throw new Error("미팅을 선택해 주세요.");
              await save("meetings", {
                ...meeting,
                taskIds: [...new Set([...meeting.taskIds, linkTask.id])],
              });
              setLinkTask(null);
              toast.success("미팅 준비에 포함했어요");
            });
          }}
        >
          <p className="student-body-text">
            <strong>{linkTask?.title}</strong>
          </p>
          <label className="field">
            <span className="field-name">준비할 미팅</span>
            <SelectField
              className="native-select"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              required
            >
              <option value="">미팅 선택</option>
              {data.meetings
                .filter(
                  (m) =>
                    m.researchId === researchId && m.status !== "cancelled",
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} · {formatDate(m.date)}
                  </option>
                ))}
            </SelectField>
          </label>
          {!data.meetings.some(
            (m) => m.researchId === researchId && m.status !== "cancelled",
          ) && (
            <Link
              className="student-text-link"
              to={`/r/${researchId}/meetings`}
            >
              먼저 미팅 만들기
              <Icon name="arrow-right" size={14} />
            </Link>
          )}
          <ErrorNotice error={linkForm.error} />
          <SaveActions
            saving={linkForm.saving}
            onCancel={() => setLinkTask(null)}
            label="준비에 포함"
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={deleteForm.saving}
        open={deleting}
        onOpenChange={setDeleting}
        title="할 일을 보관할까요?"
        description="보관함으로 옮겨요. 연결된 미팅과 수정 결과는 그대로 있고, 보관함에서 복원할 수 있어요."
      >
        <div className="stack">
          <p className="student-body-text">‘{current?.title}’</p>
          <ErrorNotice error={deleteForm.error} />
          <div className="form-actions">
            <Button variant="outline" onClick={() => setDeleting(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={deleteForm.saving}
              onClick={() => {
                if (current)
                  void deleteForm.perform(async () => {
                    await remove("tasks", current.id);
                    setDeleting(false);
                    navigate(`/r/${researchId}/tasks`);
                    toast.success("할 일을 보관했어요");
                  });
              }}
            >
              보관
            </Button>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
