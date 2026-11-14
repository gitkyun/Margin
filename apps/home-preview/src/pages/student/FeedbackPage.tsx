import { AnimatedList } from "@/components/AnimatedList";
import { WorkTabs, useBackState } from "./shared";
import { SelectField } from "@/components/experience";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import { Icon } from "@/components/icons";
import { feedbackProgress } from "@/lib/feedback-progress";
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
import { MarginPanel, PanelFrame } from "@/components/margin-panel/MarginPanel";
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
import { t } from "@/lib/i18n";

const feedbackFilters = [
  ["all", t("전체")],
  ["unprocessed", t("시작 전")],
  ["in_progress", t("진행 중")],
  ["recorded", t("수정 결과 있음")],
  ["held", t("보류")],
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
        <BackLink to={`/r/${researchId}/feedback`}>{t("피드백 목록")}</BackLink>
        <EmptyState
          title={t("피드백을 열 수 없어요")}
          description={t("피드백 목록에서 다시 선택해 주세요.")}
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
  const hasFeedback = data.feedback.some(
    (item) => item.researchId === researchId,
  );
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
      <PageHeader
        title={t("피드백")}
        tabs={<WorkTabs researchId={researchId} selected="feedback" />}
        actions={
          // 피드백이 없을 때는 빈 상태의 '피드백 추가'가 주 행동이라 여기는 보조로 낮춥니다.
          <Button
            variant={hasFeedback ? undefined : "outline"}
            onClick={openCreate}
          >
            <Icon name="plus" size={17} />
            {t("피드백 추가")}
          </Button>
        }
      />

      <div className="page-toolbar">
        <FilterSegments
          label={t("피드백 상태")}
          options={feedbackFilters}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("피드백에서 찾기")}
        />
      </div>
      <AnimatedList className="surface feedback-list">
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
                        ?.title ?? t("미팅에서 저장"))
                    : t("미팅 없이 추가")}{" "}
                  ·{" "}
                  {t("할 일 {count}개", {
                    count: data.tasks.filter((task) =>
                      task.feedbackIds.includes(item.id),
                    ).length,
                  })}
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
                ? t("조건에 맞는 피드백이 없어요")
                : t("아직 피드백이 없어요")
            }
            description={t("미팅 기록에서 저장하거나 직접 추가할 수 있어요.")}
            action={
              <Button variant="outline" onClick={openCreate}>
                {t("피드백 추가")}
              </Button>
            }
          />
        )}
      </AnimatedList>
      <FormDialog
        busy={form.saving}
        open={creating}
        onOpenChange={setCreating}
        title={t("피드백 직접 추가")}
        description={t("직접 작성한 피드백으로 저장돼요.")}
      >
        <form
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || !body.trim()) {
              form.setError(t("제목과 피드백 내용을 입력해 주세요."));
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
              toast.success(t("피드백을 저장했어요"));
            });
          }}
        >
          <LabeledInput
            label={t("제목")}
            required
            value={title}
            onChange={setTitle}
          />
          <LabeledText
            label={t("피드백 내용")}
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
  const back = useBackState();
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const researchId = feedback.researchId;
  const [aiInput, setAiInput] = useState<AIInput | null>(null);
  // 여백 패널: 연결(이 피드백과 이어진 기록)과 도우미(수정 방법 제안)
  const [panelTab, setPanelTab] = useState<"links" | "assistant">("links");
  const [panelOpen, setPanelOpen] = useState(false);
  const aiOpen = panelOpen && panelTab === "assistant";
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
    setPanelTab("assistant");
    setPanelOpen(true);
  }
  function openLinks() {
    setPanelTab("links");
    setPanelOpen(true);
  }
  const taskBase = useRef<BaseRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(feedback);
  const editForm = useSaving();
  const [planDraft, setPlanDraft] = useState<RevisionPlan | null>(null);
  const planForm = useSaving();
  const [taskPlan, setTaskPlan] = useState<RevisionPlan | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTitleError, setTaskTitleError] = useState("");
  const taskTitleInput = useRef<HTMLInputElement>(null);
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
  const progress = feedbackProgress({
    feedback,
    plans,
    tasks,
    results,
    reviewItems: data.reviewItems,
    rounds: data.rounds,
    responses: data.responses,
  });
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
      t("이 방법을 선택했어요. 수정 방법에서 할 일로 만들 수 있어요."),
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
    setTaskTitleError("");
    setTaskDescription(plan.method);
    taskForm.setError(null);
  }
  return (
    <div className="student-page">
      <PageHeader
        back={
          <BackLink to={`/r/${researchId}/feedback`}>
            {t("피드백 목록")}
          </BackLink>
        }
        title={feedback.title}
        description={
          meeting
            ? t("{title}에서 정리한 피드백", { title: meeting.title })
            : t("저장한 피드백")
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
            {t("피드백 편집")}
          </Button>
        }
      />
      <ol className="feedback-progress" aria-label={t("이 피드백의 진행")}>
        {progress.map((step) => (
          <li key={step.key} data-filled={step.filled}>
            {step.key === "tasks" ? (
              <button
                type="button"
                onClick={openLinks}
                aria-label={t("할 일 {value}, 연결된 기록 열기", {
                  value: step.value,
                })}
              >
                <span>{step.label}</span>
                <strong>{step.value}</strong>
              </button>
            ) : (
              <>
                <span>{step.label}</span>
                <strong>{step.value}</strong>
              </>
            )}
          </li>
        ))}
      </ol>
      <div className="feedback-detail-layout">
        <div className="stack">
          <section className="surface feedback-origin">
            <div className="section-heading">
              {/* 상태는 위 진행 줄 첫 칸('받은 피드백')에 있어 여기서 되풀이하지 않습니다. */}
              <h2>{t("받은 피드백")}</h2>
            </div>
            {feedback.origin && (
              <p className="meta">{originLabels[feedback.origin]}</p>
            )}
            <p className="feedback-body">{feedback.body}</p>
            {feedback.sourceQuote && (
              <blockquote className="source-excerpt">
                <small>
                  {t("저장할 때 메모에서 옮긴 원문")}
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
                state={back(feedback.title)}
              >
                {t("미팅 기록 열기")}
              </LinkChip>
            )}
            {feedback.notes && (
              <div className="student-private-note">
                <span>
                  <Icon name="lock" size={14} />
                  {t("내 메모 · 비공개")}
                </span>
                <p>{feedback.notes}</p>
              </div>
            )}
          </section>
          <section className="surface revision-plans">
            <div className="section-heading">
              <div>
                <h2>{t("수정 방법")}</h2>
                <p className="meta">
                  {t("어떻게 고칠지 정한 뒤 할 일로 만들 수 있어요.")}
                </p>
              </div>
              <div className="button-row">
                {/* 기본 길은 직접 작성입니다. AI 제안은 같은 줄의 보조 동작으로 둡니다.
                    빈 상태에도 같은 창을 여는 버튼을 따로 두지 않습니다. */}
                <Button variant="outline" size="sm" onClick={createPlan}>
                  <Icon name="plus" size={15} />
                  {t("수정 방법 작성")}
                </Button>
                <Button variant="ghost" size="sm" onClick={openAI}>
                  <Icon name="sparkles" size={15} />
                  {aiInput && !aiOpen ? t("AI 제안 다시 열기") : t("AI 제안")}
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
                        {t("방법 {number}", { number: index + 1 })}
                        {plan.origin && <> · {originLabels[plan.origin]}</>}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("{title} 편집", { title: plan.title })}
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
                        <dt>{t("예상 결과")}</dt>
                        <dd>{plan.expectedResult}</dd>
                      </dl>
                    )}
                    {plan.requiredMaterials && (
                      <dl>
                        <dt>{t("필요한 자료·준비할 것")}</dt>
                        <dd>{plan.requiredMaterials}</dd>
                      </dl>
                    )}
                    {plan.assumptions && (
                      <div className="ai-assumption">
                        <small>{t("확인이 필요한 가정")}</small>
                        <p>{plan.assumptions}</p>
                      </div>
                    )}
                    <div className="saved-plan-footer">
                      <span className="meta">
                        {t("할 일 {count}개", {
                          count: tasks.filter((task) => task.planId === plan.id)
                            .length,
                        })}
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
                          {t("선택 취소")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startTask(plan)}
                        >
                          {t("할 일로 만들기")}
                          <Icon name="arrow-right" size={14} />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
            ) : (
              <EmptyState title={t("아직 정한 수정 방법이 없어요")} />
            )}
            {plans.some((plan) => plan.status === "cancelled") && (
              <details className="student-details">
                <summary>
                  {t("선택 취소한 방법 {count}개", {
                    count: plans.filter((p) => p.status === "cancelled").length,
                  })}
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
                            .then(() =>
                              toast.success(t("방법을 다시 선택했어요")),
                            )
                            .catch((e) => toast.error(e.message))
                        }
                      >
                        {t("다시 선택")}
                      </Button>
                    </div>
                  ))}
              </details>
            )}
          </section>
          <section className="surface">
            <div className="section-heading">
              <h2>{t("수정 결과")}</h2>
              <Button
                variant="link"
                size="sm"
                type="button"
                onClick={() =>
                  setResultDraft(newResultDraft(researchId, { feedback }))
                }
              >
                {t("작성")}
                <Icon name="plus" size={14} />
              </Button>
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
                  state={back(feedback.title)}
                >
                  <span className="grow">
                    <strong>{result.title}</strong>
                    <small>
                      {result.location ||
                        (result.kind === "document"
                          ? t("볼 위치 없음")
                          : t("문서 외 수정"))}
                    </small>
                  </span>
                  <Icon name="chevron-right" size={15} />
                </Link>
              ))
            ) : (
              <p className="student-empty-inline">
                {t(
                  "아직 수정 결과가 없어요. 실제로 고친 내용을 기록해 주세요.",
                )}
              </p>
            )}
          </section>
        </div>
        <MarginPanel
          label={t("연결된 기록과 연구 도우미")}
          open={panelOpen}
          onOpen={() => setPanelOpen(true)}
          onClose={() => setPanelOpen(false)}
        >
          <PanelFrame
            title={t("이 피드백")}
            onClose={() => setPanelOpen(false)}
            tab={panelTab}
            onTab={(value) => (value === "assistant" ? openAI() : openLinks())}
            tabs={[
              {
                value: "links",
                label: t("연결"),
                count: tasks.length + results.length + (meeting ? 1 : 0),
              },
              { value: "assistant", label: t("도우미") },
            ]}
          >
            {panelTab === "links" && (
              <div className="panel-frame-body">
                {meeting && (
                  <>
                    <h3>{t("미팅")}</h3>
                    <Link
                      className="student-simple-row"
                      to={`/r/${researchId}/meetings/${meeting.id}?tab=record`}
                      state={back(feedback.title)}
                    >
                      <span className="grow">
                        <strong>{meeting.title}</strong>
                        <small>{t("이 피드백을 정리한 미팅")}</small>
                      </span>
                      <Icon name="chevron-right" size={15} />
                    </Link>
                  </>
                )}
                <h3>
                  {t("할 일")}
                  <span className="count-chip">{tasks.length}</span>
                  <Link
                    className="student-text-link"
                    to={`/r/${researchId}/tasks?feedback=${feedback.id}&new=1`}
                  >
                    {t("추가")}
                    <Icon name="plus" size={14} />
                  </Link>
                </h3>
                {tasks.length ? (
                  tasks.map((task) => (
                    <Link
                      className="student-simple-row"
                      key={task.id}
                      to={`/r/${researchId}/tasks/${task.id}`}
                      state={back(feedback.title)}
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
                    {t(
                      "수정 방법에서 할 일을 만들거나 기존 할 일을 연결할 수 있어요.",
                    )}
                  </p>
                )}
                <h3>
                  {t("수정 결과")}
                  <span className="count-chip">{results.length}</span>
                </h3>
                {results.length ? (
                  results.map((result) => (
                    <Link
                      className="student-simple-row"
                      key={result.id}
                      to={`/r/${researchId}/results/${result.id}`}
                      state={back(feedback.title)}
                    >
                      <span className="grow">
                        <strong>{result.title}</strong>
                      </span>
                      <Icon name="chevron-right" size={15} />
                    </Link>
                  ))
                ) : (
                  <p className="student-empty-inline">
                    {t("아직 수정 결과가 없어요.")}
                  </p>
                )}
                <p className="panel-frame-note">
                  {t(
                    "할 일을 끝내도 수정 결과나 교수 확인이 바뀌지는 않아요. 칸마다 따로 기록해요.",
                  )}
                </p>
              </div>
            )}
            {panelTab === "assistant" && aiInput && (
              <AIWorkbench
                key={aiRun}
                embedded
                title={t("수정 방법 제안")}
                input={aiInput}
                stale={aiStale}
                onClose={() => setPanelOpen(false)}
                onRefresh={openAI}
                onSave={saveCandidate}
              />
            )}
          </PanelFrame>
        </MarginPanel>
      </div>
      <FormDialog
        busy={editForm.saving}
        open={editing}
        onOpenChange={setEditing}
        title={t("피드백 편집")}
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.title.trim() || !draft.body.trim()) {
              editForm.setError(t("제목과 피드백 내용을 입력해 주세요."));
              return;
            }
            void editForm.perform(async () => {
              await save("feedback", {
                ...draft,
                title: draft.title.trim(),
                body: draft.body.trim(),
              });
              setEditing(false);
              toast.success(t("피드백을 저장했어요"));
            });
          }}
        >
          <LabeledInput
            label={t("제목")}
            required
            value={draft.title}
            onChange={(title) => setDraft((v) => ({ ...v, title }))}
          />
          <LabeledText
            label={t("피드백 내용")}
            required
            value={draft.body}
            onChange={(body) => setDraft((v) => ({ ...v, body }))}
          />
          <label className="field">
            <span className="field-name">{t("피드백 상태")}</span>
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
            label={t("내 메모")}
            hint={t("나만 볼 수 있어요.")}
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
            ? t("수정 방법 편집")
            : t("수정 방법 작성")
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
              planForm.setError(t("제목과 ‘어떻게 고칠지’를 입력해 주세요."));
              return;
            }
            void planForm.perform(async () => {
              await save("plans", {
                ...planDraft,
                title: planDraft.title.trim(),
                method: planDraft.method.trim(),
              });
              setPlanDraft(null);
              toast.success(t("수정 방법을 저장했어요"));
            });
          }}
        >
          {planDraft && (
            <>
              <LabeledInput
                label={t("제목")}
                required
                value={planDraft.title}
                onChange={(title) =>
                  setPlanDraft((v) => (v ? { ...v, title } : v))
                }
              />
              <LabeledText
                label={t("어떻게 고칠지")}
                required
                value={planDraft.method}
                onChange={(method) =>
                  setPlanDraft((v) => (v ? { ...v, method } : v))
                }
              />
              <LabeledText
                label={t("예상 결과")}
                value={planDraft.expectedResult}
                onChange={(expectedResult) =>
                  setPlanDraft((v) => (v ? { ...v, expectedResult } : v))
                }
                rows={2}
              />
              <LabeledText
                label={t("필요한 자료·준비할 것")}
                value={planDraft.requiredMaterials}
                onChange={(requiredMaterials) =>
                  setPlanDraft((v) => (v ? { ...v, requiredMaterials } : v))
                }
                rows={2}
              />
              <LabeledText
                label={t("확인이 필요한 가정")}
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
        title={t("할 일로 만들기")}
        description={t("이 피드백과 선택한 방법에 연결된 새 할 일을 만들어요.")}
      >
        <form
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!taskPlan) return;
            if (!taskTitle.trim()) {
              // 브라우저 기본 말풍선 대신 칸 아래에 알려 줍니다(QA F-005).
              setTaskTitleError(t("제목을 입력해 주세요."));
              taskTitleInput.current?.focus();
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
              toast.success(t("할 일을 만들었어요"));
            });
          }}
        >
          <LabeledInput
            label={t("제목")}
            required
            value={taskTitle}
            onChange={(value) => {
              setTaskTitle(value);
              setTaskTitleError("");
            }}
            error={taskTitleError || undefined}
            inputRef={taskTitleInput}
          />
          <LabeledText
            label={t("설명")}
            value={taskDescription}
            onChange={setTaskDescription}
          />
          <ErrorNotice error={taskForm.error} />
          <SaveActions
            saving={taskForm.saving}
            onCancel={() => setTaskPlan(null)}
            label={t("할 일 만들기")}
          />
        </form>
      </FormDialog>
      <FormDialog
        busy={cancelForm.saving}
        open={cancelPlan !== null}
        onOpenChange={(open) => {
          if (!open) setCancelPlan(null);
        }}
        title={t("이 방법의 선택을 취소할까요?")}
        description={t(
          "‘선택 취소한 방법’으로 옮겨요. 나중에 다시 선택할 수 있어요.",
        )}
      >
        <div className="stack">
          <p className="student-inline-note">
            {t(
              "이미 만든 할 일은 그대로 남아요. 이 방법과의 연결은 할 일을 편집할 때 해제할 수 있어요.",
            )}
          </p>
          <ErrorNotice error={cancelForm.error} />
          <div className="form-actions">
            <Button variant="outline" onClick={() => setCancelPlan(null)}>
              {t("닫기")}
            </Button>
            <Button
              disabled={cancelForm.saving}
              onClick={() => {
                if (cancelPlan)
                  void cancelForm.perform(async () => {
                    await save("plans", { ...cancelPlan, status: "cancelled" });
                    setCancelPlan(null);
                    toast.success(
                      t("선택을 취소했어요. 만든 할 일은 그대로 있어요."),
                    );
                  });
              }}
            >
              {t("선택 취소")}
            </Button>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
