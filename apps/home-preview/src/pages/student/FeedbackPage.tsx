import { WorkTabs } from "./shared";
import { SelectField } from "@/components/experience";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import {
  feedbackLabels,
  originLabels,
  recordBase,
  taskLabels,
  type AICandidate,
  type AIInput,
  type BaseRecord,
  type Feedback,
  type RevisionPlan,
  type RevisionResult,
} from "@/lib/domain";
import { AIWorkbench } from "./AIWorkbench";
import { ResultEditorDialog } from "./ResultEditorDialog";
import { newResultDraft } from "./result-draft";
import { isAISourceStale } from "./ai-source";
import {
  BackLink,
  ErrorNotice,
  FilterSegments,
  FormDialog,
  LabeledInput,
  LabeledText,
  LinkChip,
  SaveActions,
  SearchInput,
  useSaving,
} from "./shared";
import { filterCounts } from "@/lib/filter-counts";

const feedbackFilters = [
  ["all", "전체"],
  ["unprocessed", "시작 전"],
  ["in_progress", "진행 중"],
  ["recorded", "수정 결과 있음"],
  ["held", "보류"],
] as const;

export function FeedbackPage() {
  const { researchId = "", feedbackId } = useParams();
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const createBase = useRef<BaseRecord | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const form = useSaving();
  if (feedbackId) {
    const feedback = data.feedback.find(
      (item) => item.id === feedbackId && item.researchId === researchId,
    );
    return feedback ? (
      <FeedbackDetail key={feedback.id} feedback={feedback} />
    ) : (
      <>
        <BackLink to={`/r/${researchId}/feedback`}>피드백 목록</BackLink>
        <EmptyState
          title="피드백을 열 수 없어요"
          description="피드백 목록에서 다시 선택해 주세요."
        />
      </>
    );
  }
  function openCreate() {
    createBase.current = recordBase(researchId);
    setTitle("");
    setBody("");
    form.setError(null);
    setCreating(true);
  }
  const searched = data.feedback.filter(
    (item) =>
      item.researchId === researchId &&
      (!search ||
        `${item.title} ${item.body}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const matches = (item: (typeof searched)[number], value: string) =>
    value === "all" || item.status === value;
  const counts = filterCounts(
    feedbackFilters.map(([value]) => value),
    searched,
    matches,
  );
  const items = searched.filter((item) => matches(item, filter));
  return (
    <div className="student-page">
      <WorkTabs researchId={researchId} selected="feedback" />
      <PageHeader
        title="피드백"
        description="받은 피드백마다 수정 방법을 정하고 고친 내용을 기록하세요."
        actions={
          <Button onClick={openCreate}>
            <Icon name="plus" size={17} />
            피드백 추가
          </Button>
        }
      />

      <div className="page-toolbar">
        <FilterSegments
          label="피드백 상태"
          options={feedbackFilters}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="피드백에서 찾기"
        />
      </div>
      <section className="surface feedback-list">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              to={`/r/${researchId}/feedback/${item.id}`}
              className="feedback-list-row"
            >
              <span className="student-feedback-symbol">
                <Icon name="message" size={19} />
              </span>
              <span className="grow">
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>
                  {item.origin && <>{originLabels[item.origin]} · </>}
                  {item.meetingId
                    ? (data.meetings.find((m) => m.id === item.meetingId)
                        ?.title ?? "미팅에서 저장")
                    : "미팅 없이 추가"}{" "}
                  · 할 일{" "}
                  {
                    data.tasks.filter((t) => t.feedbackIds.includes(item.id))
                      .length
                  }
                  개
                </small>
              </span>
              <StatusBadge
                tone={
                  item.status === "recorded"
                    ? "green"
                    : item.status === "in_progress"
                      ? "blue"
                      : item.status === "held"
                        ? "amber"
                        : "neutral"
                }
              >
                {feedbackLabels[item.status]}
              </StatusBadge>
              <Icon name="chevron-right" size={17} />
            </Link>
          ))
        ) : (
          <EmptyState
            title={
              search || filter !== "all"
                ? "조건에 맞는 피드백이 없어요"
                : "아직 피드백이 없어요"
            }
            description="미팅 기록에서 저장하거나 직접 추가할 수 있어요."
            action={
              <Button variant="outline" onClick={openCreate}>
                피드백 추가
              </Button>
            }
          />
        )}
      </section>
      <FormDialog
        busy={form.saving}
        open={creating}
        onOpenChange={setCreating}
        title="피드백 직접 추가"
        description="직접 작성한 피드백으로 저장돼요."
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || !body.trim()) {
              form.setError("제목과 피드백 내용을 입력해 주세요.");
              return;
            }
            void form.perform(async () => {
              createBase.current ??= recordBase(researchId);
              const item = await save("feedback", {
                ...createBase.current,
                origin: "manual",
                title: title.trim(),
                body: body.trim(),
                notes: "",
                status: "unprocessed",
              });
              setCreating(false);
              navigate(`/r/${researchId}/feedback/${item.id}`);
              toast.success("피드백을 저장했어요");
            });
          }}
        >
          <LabeledInput
            label="제목"
            required
            value={title}
            onChange={setTitle}
          />
          <LabeledText
            label="피드백 내용"
            required
            value={body}
            onChange={setBody}
          />
          <ErrorNotice error={form.error} />
          <SaveActions
            saving={form.saving}
            onCancel={() => setCreating(false)}
          />
        </form>
      </FormDialog>
    </div>
  );
}

function FeedbackDetail({ feedback }: { feedback: Feedback }) {
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const researchId = feedback.researchId;
  const [aiInput, setAiInput] = useState<AIInput | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRun, setAiRun] = useState(0);
  const [resultDraft, setResultDraft] = useState<RevisionResult | null>(null);
  const aiStale =
    !!aiInput && isAISourceStale(aiInput, { text: feedback.body });
  function openAI() {
    if (!aiInput || isAISourceStale(aiInput, { text: feedback.body })) {
      setAiInput({
        mode: "suggest_revisions",
        researchId,
        feedbackId: feedback.id,
        sourceText: feedback.body,
      });
      setAiRun((value) => value + 1);
    }
    setAiOpen(true);
  }
  const taskBase = useRef<BaseRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(feedback);
  const editForm = useSaving();
  const [planDraft, setPlanDraft] = useState<RevisionPlan | null>(null);
  const planForm = useSaving();
  const [taskPlan, setTaskPlan] = useState<RevisionPlan | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const taskForm = useSaving();
  const [cancelPlan, setCancelPlan] = useState<RevisionPlan | null>(null);
  const cancelForm = useSaving();
  const plans = data.plans.filter((item) => item.feedbackId === feedback.id);
  const tasks = data.tasks.filter((item) =>
    item.feedbackIds.includes(feedback.id),
  );
  const results = data.results.filter((item) =>
    item.feedbackIds.includes(feedback.id),
  );
  const meeting = data.meetings.find((item) => item.id === feedback.meetingId);
  async function saveCandidate(candidate: AICandidate, base: BaseRecord) {
    await save("plans", {
      ...base,
      origin: "ai",
      feedbackId: feedback.id,
      title: candidate.title.trim(),
      method: candidate.method ?? candidate.body ?? "",
      expectedResult: candidate.expectedResult ?? "",
      assumptions: candidate.assumptions ?? "",
      requiredMaterials: candidate.requiredMaterials ?? "",
      suggestedTasks: candidate.suggestedTasks ?? [],
      status: "saved",
      sourceQuote:
        candidate.sourceQuote &&
        (feedback.body.includes(candidate.sourceQuote) ||
          feedback.sourceQuote === candidate.sourceQuote)
          ? candidate.sourceQuote
          : undefined,
    });
    toast.success(
      "이 방법을 선택했어요. 수정 방법에서 할 일로 만들 수 있어요.",
    );
  }
  function createPlan() {
    setPlanDraft({
      ...recordBase(researchId),
      origin: "manual",
      feedbackId: feedback.id,
      title: "",
      method: "",
      expectedResult: "",
      assumptions: "",
      requiredMaterials: "",
      suggestedTasks: [],
      status: "saved",
    });
    planForm.setError(null);
  }
  function startTask(plan: RevisionPlan) {
    taskBase.current = recordBase(researchId);
    setTaskPlan(plan);
    setTaskTitle(plan.suggestedTasks[0] ?? plan.title);
    setTaskDescription(plan.method);
    taskForm.setError(null);
  }
  return (
    <div className="student-page">
      <BackLink to={`/r/${researchId}/feedback`}>피드백 목록</BackLink>
      <PageHeader
        title={feedback.title}
        description={
          meeting ? `${meeting.title}에서 정리한 피드백` : "저장한 피드백"
        }
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setDraft(feedback);
              setEditing(true);
              editForm.setError(null);
            }}
          >
            <Icon name="edit" size={16} />
            피드백 편집
          </Button>
        }
      />
      <div
        className={`feedback-detail-layout ${aiInput && aiOpen ? "with-ai" : ""}`}
      >
        <div className="stack">
          <section className="surface feedback-origin">
            <div className="section-heading">
              <h2>받은 피드백</h2>
              <StatusBadge
                tone={
                  feedback.status === "recorded"
                    ? "green"
                    : feedback.status === "in_progress"
                      ? "blue"
                      : "neutral"
                }
              >
                {feedbackLabels[feedback.status]}
              </StatusBadge>
            </div>
            {feedback.origin && (
              <p className="meta">{originLabels[feedback.origin]}</p>
            )}
            <p className="feedback-body">{feedback.body}</p>
            {feedback.sourceQuote && (
              <blockquote className="source-excerpt">
                <small>
                  저장할 때 메모에서 옮긴 원문
                  {feedback.sourceMemoRevision
                    ? ` · v${feedback.sourceMemoRevision}`
                    : ""}
                </small>
                {feedback.sourceQuote}
              </blockquote>
            )}
            {meeting && (
              <LinkChip
                to={`/r/${researchId}/meetings/${meeting.id}?tab=record`}
              >
                미팅 기록 열기
              </LinkChip>
            )}
            {feedback.notes && (
              <div className="student-private-note">
                <span>
                  <Icon name="lock" size={14} />내 메모 · 비공개
                </span>
                <p>{feedback.notes}</p>
              </div>
            )}
          </section>
          <section className="surface revision-plans">
            <div className="section-heading">
              <div>
                <h2>수정 방법</h2>
                <p className="meta">
                  어떻게 고칠지 정한 뒤 할 일로 만들 수 있어요.
                </p>
                <p className="student-footnote">
                  방법을 선택해도 할 일이 완료되지는 않아요. 진행 상태는 할
                  일에서 바꿔 주세요.
                </p>
              </div>
              <div className="button-row">
                <Button variant="ghost" size="sm" onClick={createPlan}>
                  직접 작성
                </Button>
                <Button variant="outline" size="sm" onClick={openAI}>
                  <Icon name="sparkles" size={15} />
                  {aiInput && !aiOpen ? "AI 제안 다시 열기" : "AI 제안"}
                </Button>
              </div>
            </div>
            {plans.filter((plan) => plan.status !== "cancelled").length ? (
              plans
                .filter((plan) => plan.status !== "cancelled")
                .map((plan, index) => (
                  <article key={plan.id} className="saved-plan">
                    <div className="saved-plan-heading">
                      <span className="plan-index">
                        방법 {index + 1}
                        {plan.origin && <> · {originLabels[plan.origin]}</>}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${plan.title} 편집`}
                        onClick={() => {
                          setPlanDraft({ ...plan });
                          planForm.setError(null);
                        }}
                      >
                        <Icon name="edit" size={15} />
                      </Button>
                    </div>
                    <h3>{plan.title}</h3>
                    <p>{plan.method}</p>
                    {plan.expectedResult && (
                      <dl>
                        <dt>예상 결과</dt>
                        <dd>{plan.expectedResult}</dd>
                      </dl>
                    )}
                    {plan.requiredMaterials && (
                      <dl>
                        <dt>필요한 자료·준비할 것</dt>
                        <dd>{plan.requiredMaterials}</dd>
                      </dl>
                    )}
                    {plan.assumptions && (
                      <div className="ai-assumption">
                        <small>확인이 필요한 가정</small>
                        <p>{plan.assumptions}</p>
                      </div>
                    )}
                    <div className="saved-plan-footer">
                      <span className="meta">
                        할 일{" "}
                        {tasks.filter((task) => task.planId === plan.id).length}
                        개
                      </span>
                      <div className="button-row">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCancelPlan(plan);
                            cancelForm.setError(null);
                          }}
                        >
                          선택 취소
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startTask(plan)}
                        >
                          할 일로 만들기
                          <Icon name="arrow-right" size={14} />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
            ) : (
              <EmptyState
                title="아직 정한 수정 방법이 없어요"
                description="직접 적거나 AI 제안을 받아 비교할 수 있어요."
                action={
                  <Button variant="outline" onClick={createPlan}>
                    수정 방법 작성
                  </Button>
                }
              />
            )}{" "}
            {plans.some((plan) => plan.status === "cancelled") && (
              <details className="student-details">
                <summary>
                  선택 취소한 방법{" "}
                  {plans.filter((p) => p.status === "cancelled").length}개
                </summary>
                {plans
                  .filter((p) => p.status === "cancelled")
                  .map((plan) => (
                    <div className="student-simple-row" key={plan.id}>
                      <span className="grow">
                        <strong>{plan.title}</strong>
                        <small>{plan.method}</small>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void save("plans", { ...plan, status: "saved" })
                            .then(() => toast.success("방법을 다시 선택했어요"))
                            .catch((e) => toast.error(e.message))
                        }
                      >
                        다시 선택
                      </Button>
                    </div>
                  ))}
              </details>
            )}
          </section>
          <div className="student-two-column">
            <section className="surface">
              <div className="section-heading">
                <h2>연결한 할 일</h2>
                <Link
                  className="student-text-link"
                  to={`/r/${researchId}/tasks?feedback=${feedback.id}&new=1`}
                >
                  추가
                  <Icon name="plus" size={14} />
                </Link>
              </div>
              {tasks.length ? (
                tasks.map((task) => (
                  <Link
                    className="student-simple-row"
                    key={task.id}
                    to={`/r/${researchId}/tasks/${task.id}`}
                  >
                    <span className="grow">
                      <strong>{task.title}</strong>
                    </span>
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
                  </Link>
                ))
              ) : (
                <p className="student-empty-inline">
                  수정 방법에서 할 일을 만들거나 기존 할 일을 연결할 수 있어요.
                </p>
              )}
            </section>
            <section className="surface">
              <div className="section-heading">
                <h2>수정 결과</h2>
                <button
                  type="button"
                  className="student-text-link"
                  onClick={() =>
                    setResultDraft(newResultDraft(researchId, { feedback }))
                  }
                >
                  작성
                  <Icon name="plus" size={14} />
                </button>
              </div>
              {/* Opened in place so this feedback stays behind the dialog. */}
              <ResultEditorDialog
                researchId={researchId}
                draft={resultDraft}
                setDraft={setResultDraft}
              />
              {results.length ? (
                results.map((result) => (
                  <Link
                    className="student-simple-row"
                    key={result.id}
                    to={`/r/${researchId}/results/${result.id}`}
                  >
                    <span className="grow">
                      <strong>{result.title}</strong>
                      <small>
                        {result.location ||
                          (result.kind === "document"
                            ? "볼 위치 없음"
                            : "문서 외 수정")}
                      </small>
                    </span>
                    <Icon name="chevron-right" size={15} />
                  </Link>
                ))
              ) : (
                <p className="student-empty-inline">
                  아직 수정 결과가 없어요. 실제로 고친 내용을 기록해 주세요.
                </p>
              )}
            </section>
          </div>
        </div>
        {aiInput && (
          <AIWorkbench
            key={aiRun}
            title="수정 방법 제안"
            input={aiInput}
            hidden={!aiOpen}
            stale={aiStale}
            onClose={() => setAiOpen(false)}
            onRefresh={openAI}
            onSave={saveCandidate}
          />
        )}
      </div>
      <FormDialog
        busy={editForm.saving}
        open={editing}
        onOpenChange={setEditing}
        title="피드백 편집"
        description="피드백 상태는 할 일 완료나 교수 응답과 따로 저장돼요."
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.title.trim() || !draft.body.trim()) {
              editForm.setError("제목과 피드백 내용을 입력해 주세요.");
              return;
            }
            void editForm.perform(async () => {
              await save("feedback", {
                ...draft,
                title: draft.title.trim(),
                body: draft.body.trim(),
              });
              setEditing(false);
              toast.success("피드백을 저장했어요");
            });
          }}
        >
          <LabeledInput
            label="제목"
            required
            value={draft.title}
            onChange={(title) => setDraft((v) => ({ ...v, title }))}
          />
          <LabeledText
            label="피드백 내용"
            required
            value={draft.body}
            onChange={(body) => setDraft((v) => ({ ...v, body }))}
          />
          <label className="field">
            <span className="field-name">피드백 상태</span>
            <SelectField
              className="native-select"
              value={draft.status}
              onChange={(e) =>
                setDraft((v) => ({
                  ...v,
                  status: e.target.value as Feedback["status"],
                }))
              }
            >
              {Object.entries(feedbackLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </label>
          <LabeledText
            label="내 메모"
            hint="나만 볼 수 있어요."
            value={draft.notes}
            onChange={(notes) => setDraft((v) => ({ ...v, notes }))}
          />
          <ErrorNotice error={editForm.error} />
          <SaveActions
            saving={editForm.saving}
            onCancel={() => setEditing(false)}
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={planForm.saving}
        open={planDraft !== null}
        onOpenChange={(open) => {
          if (!open) setPlanDraft(null);
        }}
        title={
          planDraft && plans.some((p) => p.id === planDraft.id)
            ? "수정 방법 편집"
            : "수정 방법 작성"
        }
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !planDraft ||
              !planDraft.title.trim() ||
              !planDraft.method.trim()
            ) {
              planForm.setError("제목과 ‘어떻게 고칠지’를 입력해 주세요.");
              return;
            }
            void planForm.perform(async () => {
              await save("plans", {
                ...planDraft,
                title: planDraft.title.trim(),
                method: planDraft.method.trim(),
              });
              setPlanDraft(null);
              toast.success("수정 방법을 저장했어요");
            });
          }}
        >
          {planDraft && (
            <>
              <LabeledInput
                label="제목"
                required
                value={planDraft.title}
                onChange={(title) =>
                  setPlanDraft((v) => (v ? { ...v, title } : v))
                }
              />
              <LabeledText
                label="어떻게 고칠지"
                required
                value={planDraft.method}
                onChange={(method) =>
                  setPlanDraft((v) => (v ? { ...v, method } : v))
                }
              />
              <LabeledText
                label="예상 결과"
                value={planDraft.expectedResult}
                onChange={(expectedResult) =>
                  setPlanDraft((v) => (v ? { ...v, expectedResult } : v))
                }
                rows={2}
              />
              <LabeledText
                label="필요한 자료·준비할 것"
                value={planDraft.requiredMaterials}
                onChange={(requiredMaterials) =>
                  setPlanDraft((v) => (v ? { ...v, requiredMaterials } : v))
                }
                rows={2}
              />
              <LabeledText
                label="확인이 필요한 가정"
                value={planDraft.assumptions}
                onChange={(assumptions) =>
                  setPlanDraft((v) => (v ? { ...v, assumptions } : v))
                }
                rows={2}
              />
            </>
          )}
          <ErrorNotice error={planForm.error} />
          <SaveActions
            saving={planForm.saving}
            onCancel={() => setPlanDraft(null)}
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={taskForm.saving}
        open={taskPlan !== null}
        onOpenChange={(open) => {
          if (!open) setTaskPlan(null);
        }}
        title="할 일로 만들기"
        description="이 피드백과 선택한 방법에 연결된 새 할 일을 만들어요."
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!taskPlan || !taskTitle.trim()) {
              taskForm.setError("제목을 입력해 주세요.");
              return;
            }
            void taskForm.perform(async () => {
              taskBase.current ??= recordBase(researchId);
              const task = await save("tasks", {
                ...taskBase.current,
                origin: taskPlan.origin,
                title: taskTitle.trim(),
                description: taskDescription.trim(),
                status: "todo",
                dueDate: null,
                priority: "normal",
                feedbackIds: [feedback.id],
                planId: taskPlan.id,
              });
              setTaskPlan(null);
              navigate(`/r/${researchId}/tasks/${task.id}`);
              toast.success("할 일을 만들었어요");
            });
          }}
        >
          <LabeledInput
            label="제목"
            required
            value={taskTitle}
            onChange={setTaskTitle}
          />
          <LabeledText
            label="설명"
            value={taskDescription}
            onChange={setTaskDescription}
          />
          <ErrorNotice error={taskForm.error} />
          <SaveActions
            saving={taskForm.saving}
            onCancel={() => setTaskPlan(null)}
            label="할 일 만들기"
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={cancelForm.saving}
        open={cancelPlan !== null}
        onOpenChange={(open) => {
          if (!open) setCancelPlan(null);
        }}
        title="이 방법의 선택을 취소할까요?"
        description="‘선택 취소한 방법’으로 옮겨요. 나중에 다시 선택할 수 있어요."
      >
        <div className="stack">
          <p className="student-inline-note">
            이미 만든 할 일은 그대로 남아요. 이 방법과의 연결은 할 일을 편집할
            때 해제할 수 있어요.
          </p>
          <ErrorNotice error={cancelForm.error} />
          <div className="form-actions">
            <Button variant="outline" onClick={() => setCancelPlan(null)}>
              닫기
            </Button>
            <Button
              disabled={cancelForm.saving}
              onClick={() => {
                if (cancelPlan)
                  void cancelForm.perform(async () => {
                    await save("plans", { ...cancelPlan, status: "cancelled" });
                    setCancelPlan(null);
                    toast.success(
                      "선택을 취소했어요. 만든 할 일은 그대로 있어요.",
                    );
                  });
              }}
            >
              선택 취소
            </Button>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
