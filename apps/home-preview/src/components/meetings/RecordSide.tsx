import { t } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { QuickTaskInput, TaskRow } from "@/components/tasks/TaskRow";
import { useTaskRowMotion } from "@/components/task-row-motion";
import { useWorkspace } from "@/lib/workspace";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { seoulToday } from "@/lib/home-meeting";
import { friendlyError } from "@/lib/supabase";
import { carriedTasks, recordItems } from "@/lib/record-view";
import {
  feedbackLabels,
  formatDate,
  recordBase,
  responseLabels,
  type Feedback,
  type Meeting,
  type Question,
  type Task,
  type WorkspaceData,
} from "@/lib/domain";
import type { DetailHistoryState } from "@/lib/item-detail";
import "@/components/log/log.css";
import "./record-side.css";
import { markKindLabel, type MarkKind } from "@/lib/mark-kinds";

/** 오른쪽 열 형광펜 줄 하나(메모) */
export interface SideMark {
  start: number;
  end: number;
  kind: MarkKind;
  /** 칠한 글(줄이 길면 화면에서 두 줄로 자름) */
  text: string;
}
import { SuggestionRows, SummaryBody, useOrganize } from "./OrganizeParts";

const DETAIL_STATE: DetailHistoryState = { layer: "detail", depth: 1 };
const FOLD_KEY = "margin-record-side-folded";

function detailSearch(value: string): string {
  const params = new URLSearchParams(window.location.search);
  params.set("detail", value);
  return `?${params.toString()}`;
}

/** 저장된 접힘 값을 읽어요. 깨진 값(null·숫자·배열·잘못된 JSON)이면 빈 값으로 시작해요. */
export function parseFolded(raw: string | null): Record<string, boolean> {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

function readFolded(): Record<string, boolean> {
  try {
    return parseFolded(localStorage.getItem(FOLD_KEY));
  } catch {
    // 저장소를 못 쓰는 브라우저(비공개 모드 등)는 기본값으로 둬요.
    return {};
  }
}

/** 구획 머리를 누르면 접힙니다. 접힘은 이 브라우저에 기억합니다(04 §5.4). */
function Fold({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => {
    const saved = readFolded()[id];
    return saved === undefined ? defaultOpen : !saved;
  });
  return (
    <section className="record-side-section">
      <button
        type="button"
        className="record-side-head"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          try {
            localStorage.setItem(
              FOLD_KEY,
              JSON.stringify({ ...readFolded(), [id]: !next }),
            );
          } catch {
            // 기억하지 못해도 이번 화면에서는 접힙니다.
          }
        }}
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
        {title}
      </button>
      {open && <div className="record-side-body">{children}</div>}
    </section>
  );
}

function latestResponse(data: WorkspaceData, feedbackId: string) {
  const results = data.results
    .filter((result) => result.feedbackIds.includes(feedbackId))
    .map((result) => result.id);
  const items = data.reviewItems.filter((item) =>
    results.includes(item.resultId),
  );
  const round = data.rounds
    .filter((item) => items.some((reviewItem) => reviewItem.id === item.itemId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return round
    ? data.responses
        .filter((item) => item.roundId === round.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    : undefined;
}

async function createTask(
  save: ReturnType<typeof useWorkspace>["save"],
  remove: ReturnType<typeof useWorkspace>["remove"],
  researchId: string,
  title: string,
  link: { feedbackIds?: string[]; sourceRecordId?: string },
) {
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
      feedbackIds: link.feedbackIds ?? [],
      ...(link.sourceRecordId ? { sourceRecordId: link.sourceRecordId } : {}),
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

/**
 * 기록됨 모드의 오른쪽 열(IA v2 04 §5.4): ① 요약 ② 피드백·할 일 ③ 결정 ④ 질문 ⑤ 준비한 것.
 * 요약은 아직 저장하지 않으므로(2b 단계) [정리하기]가 지금 연구 도우미 정리 창을 엽니다.
 */
export function RecordSide({
  meeting,
  numbers,
  onPoint,
  prepareOrganize,
  memoText,
  onAddFeedback,
  onAddDecision,
  onAddQuestion,
  onShowPreparation,
  marks = [],
  onPickMark,
}: {
  meeting: Meeting;
  /** 원문 표시 번호(04 §5.3). 원문 위치를 찾은 항목만 */
  numbers?: ReadonlyMap<string, number>;
  /** 줄에 올리거나 초점이 가면 원문의 그 곳을 짚습니다. */
  onPoint?(id: string | null): void;
  /** 정리하기 전에 메모를 저장하고 저장본을 돌려줍니다. */
  prepareOrganize(): Promise<Meeting | null>;
  /** 지금 메모 칸의 글(저장 전 포함) */
  memoText: string;
  onAddFeedback(): void;
  onAddDecision(): void;
  onAddQuestion(): void;
  onShowPreparation(): void;
  /** 메모 형광펜(위치순). 색만으로 구분하지 않도록 종류 이름과 함께 보여요(02 §2, 6단계). */
  marks?: readonly SideMark[];
  /** 형광펜 줄을 누르면 메모의 그 자리를 골라 보여 줍니다. */
  onPickMark?(mark: SideMark): void;
}) {
  const { data, save, remove } = useWorkspace();
  const completion = useTaskCompletion(save);
  const rowMotion = useTaskRowMotion();
  const today = seoulToday();
  const items = recordItems(meeting, data);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const organize = useOrganize(meeting, prepareOrganize);
  const written = meeting.recordType === "written";
  const researchId = meeting.researchId;
  const grouped = new Set<string>();
  const byFeedback = items.feedback.map((feedback) => {
    const tasks = items.tasks.filter((task) =>
      task.feedbackIds.includes(feedback.id),
    );
    tasks.forEach((task) => grouped.add(task.id));
    return { feedback, tasks };
  });
  const others = items.tasks.filter((task) => !grouped.has(task.id));
  const point = (id: string) => ({
    onMouseEnter: () => onPoint?.(id),
    onMouseLeave: () => onPoint?.(null),
    onFocus: () => onPoint?.(id),
    onBlur: () => onPoint?.(null),
  });
  const num = (id: string) => {
    const number = numbers?.get(id);
    return number ? (
      <span
        className="record-side-num"
        aria-label={t("원문 {number}번", { number })}
      >
        {number}
      </span>
    ) : null;
  };
  const row = (task: Task) =>
    numbers?.has(task.id) ? (
      <div key={task.id} className="record-side-numbered" {...point(task.id)}>
        {num(task.id)}
        <TaskRow
          task={task}
          today={today}
          completion={completion}
          rowMotion={rowMotion}
        />
      </div>
    ) : (
      <TaskRow
        key={task.id}
        task={task}
        today={today}
        completion={completion}
        rowMotion={rowMotion}
      />
    );

  return (
    <aside className="record-side" aria-label={t("요약·할 일")}>
      <Fold id="summary" title={t("요약")}>
        <SummaryBody
          meeting={meeting}
          organize={organize}
          canRun={!!memoText.trim() || organize.hasMyRecording}
        />
      </Fold>
      <Fold
        id="work"
        title={
          <>
            {t("피드백·할 일")}
            <span className="record-side-count">
              {t("남은 {left} / 전체 {total}", {
                left: items.remaining,
                total: items.tasks.length,
              })}
            </span>
          </>
        }
      >
        {byFeedback.map(({ feedback, tasks }) => (
          <FeedbackGroup
            key={feedback.id}
            number={num(feedback.id)}
            pointProps={point(feedback.id)}
            feedback={feedback}
            response={latestResponse(data, feedback.id)}
            adding={addingFor === feedback.id}
            onAdd={() => setAddingFor(feedback.id)}
            onCloseAdd={() => setAddingFor(null)}
            onSubmit={(title) =>
              createTask(save, remove, researchId, title, {
                feedbackIds: [feedback.id],
              })
            }
          >
            {tasks.map(row)}
          </FeedbackGroup>
        ))}
        <SuggestionRows meeting={meeting} organize={organize} />
        {others.length > 0 && (
          <div className="record-side-group">
            <h4>{t("그 밖의 할 일")}</h4>
            {others.map(row)}
          </div>
        )}
        {!items.feedback.length && !items.tasks.length && (
          <p className="record-side-empty">
            {t("아직 피드백이나 할 일이 없어요.")}
          </p>
        )}
        {addingFor === "record" && (
          <QuickTaskInput
            onAdd={(title) =>
              createTask(save, remove, researchId, title, {
                sourceRecordId: meeting.id,
              })
            }
            onClose={() => setAddingFor(null)}
          />
        )}
        <div className="record-side-actions">
          <Button size="sm" variant="ghost" onClick={onAddFeedback}>
            <Icon name="plus" size={15} />
            {t("피드백 추가")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAddingFor("record")}
          >
            <Icon name="plus" size={15} />
            {t("할 일 추가")}
          </Button>
        </div>
      </Fold>
      <Fold
        id="decisions"
        title={t("결정 {count}", { count: items.decisions.length })}
        defaultOpen={items.decisions.length <= 3}
      >
        {items.decisions.map((decision) => (
          <Link
            key={decision.id}
            className="record-side-line"
            to={{ search: detailSearch(`decision:${decision.id}`) }}
            state={DETAIL_STATE}
            {...point(decision.id)}
          >
            <strong>
              {num(decision.id)}
              {decision.text}
            </strong>
            {decision.reason && <small>{decision.reason}</small>}
            {decision.replacesId && <small>{t("이전 결정 바꿈")}</small>}
          </Link>
        ))}
        <Button size="sm" variant="ghost" onClick={onAddDecision}>
          <Icon name="plus" size={15} />
          {t("결정 추가")}
        </Button>
      </Fold>
      <Fold
        id="questions"
        title={t("질문 {count}", { count: items.questions.length })}
        defaultOpen={items.questions.length <= 3}
      >
        {items.questions.map((question) => (
          <QuestionLine
            key={question.id}
            question={question}
            number={num(question.id)}
            pointProps={point(question.id)}
          />
        ))}
        <Button size="sm" variant="ghost" onClick={onAddQuestion}>
          <Icon name="plus" size={15} />
          {t("질문 추가")}
        </Button>
      </Fold>
      {marks.length > 0 && (
        <Fold
          id="marks"
          title={t("형광펜 {count}", { count: marks.length })}
          defaultOpen={marks.length <= 5}
        >
          {marks.map((mark) => (
            <button
              key={`${mark.start}-${mark.end}`}
              type="button"
              className="record-side-line record-side-mark"
              onClick={() => onPickMark?.(mark)}
            >
              <strong>
                <span
                  className="mark-swatch"
                  data-kind={mark.kind}
                  aria-hidden="true"
                />
                {markKindLabel(mark.kind)}
              </strong>
              <small>{mark.text}</small>
            </button>
          ))}
        </Fold>
      )}
      {!written && (
        <Fold id="prepared" title={t("준비한 것")} defaultOpen={false}>
          <p className="record-side-note">
            {meeting.goal || t("보여 줄 결과를 적지 않았어요.")}
          </p>
          <p className="record-side-note">
            {t(
              "가져간 할 일 {tasks}개 · 보여 준 글·자료 {docs}개 · 물어본 질문 {questions}개",
              {
                tasks: meeting.taskIds.length,
                docs:
                  meeting.versionIds.length +
                  (meeting.documentIds?.length ?? 0),
                questions: meeting.questionIds.length,
              },
            )}
          </p>
          <Button size="sm" variant="outline" onClick={onShowPreparation}>
            {t("준비 내용 보기")}
          </Button>
        </Fold>
      )}
    </aside>
  );
}

type PointProps = {
  onMouseEnter(): void;
  onMouseLeave(): void;
  onFocus(): void;
  onBlur(): void;
};

function FeedbackGroup({
  number,
  pointProps,
  feedback,
  response,
  adding,
  onAdd,
  onCloseAdd,
  onSubmit,
  children,
}: {
  number: ReactNode;
  pointProps: PointProps;
  feedback: Feedback;
  response?: { result: "confirmed" | "changes_requested" };
  adding: boolean;
  onAdd(): void;
  onCloseAdd(): void;
  onSubmit(title: string): Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="record-side-group">
      <div className="record-side-feedback">
        <Link
          className="record-side-line"
          to={{ search: detailSearch(`feedback:${feedback.id}`) }}
          state={DETAIL_STATE}
          {...pointProps}
        >
          <strong>
            {number}
            {feedback.title}
          </strong>
          <small>{feedbackLabels[feedback.status]}</small>
        </Link>
        {response && (
          <span className="record-side-badge">
            {responseLabels[response.result]}
          </span>
        )}
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("{title}에 할 일 추가", { title: feedback.title })}
          onClick={onAdd}
        >
          <Icon name="plus" size={14} />
        </Button>
      </div>
      <div className="record-side-tasks">
        {children}
        {adding && <QuickTaskInput onAdd={onSubmit} onClose={onCloseAdd} />}
      </div>
    </div>
  );
}

function QuestionLine({
  question,
  number,
  pointProps,
}: {
  question: Question;
  number?: ReactNode;
  pointProps?: PointProps;
}) {
  const { save } = useWorkspace();
  const resolved = question.status === "resolved";
  return (
    <div className="log-question">
      <button
        type="button"
        className="log-circle"
        aria-pressed={resolved}
        aria-label={
          resolved
            ? t("{text} 다시 열기", { text: question.text })
            : t("{text} 해결", { text: question.text })
        }
        onClick={() =>
          void save("questions", {
            ...question,
            status: resolved ? "open" : "resolved",
          }).catch((error) => toast.error(friendlyError(error)))
        }
      >
        {resolved && <Icon name="check" size={12} />}
      </button>
      <Link
        className="record-side-line"
        to={{ search: detailSearch(`question:${question.id}`) }}
        state={DETAIL_STATE}
        {...pointProps}
      >
        <strong className={resolved ? "is-done" : undefined}>
          {number}
          {question.text}
        </strong>
      </Link>
    </div>
  );
}

/**
 * 준비 모드의 오른쪽 열 "지난 기록에서"(IA v2 04 §4.2): 넘어온 할 일·열린 질문·직전 기록.
 * 가져가기는 복사하지 않고 이 미팅의 `taskIds`·`questionIds`에 id를 넣습니다(08 §4.5).
 */
export function PrepareSide({ meeting }: { meeting: Meeting }) {
  const { data, save } = useWorkspace();
  const carried = carriedTasks(meeting, data);
  const key = (m: Pick<Meeting, "date" | "time" | "createdAt">) =>
    m.date ? `${m.date}T${m.time ?? "00:00"}` : m.createdAt;
  const earlier = data.meetings
    .filter(
      (item) =>
        item.researchId === meeting.researchId &&
        item.id !== meeting.id &&
        !item.archivedAt &&
        item.status !== "cancelled" &&
        key(item) < key(meeting),
    )
    .sort((a, b) => key(b).localeCompare(key(a)));
  const earlierIds = new Set(earlier.map((item) => item.id));
  const openQuestions = data.questions.filter(
    (question) =>
      !question.archivedAt &&
      question.status === "open" &&
      !!question.meetingId &&
      earlierIds.has(question.meetingId) &&
      !meeting.questionIds.includes(question.id),
  );
  // 직전 기록은 끝난 기록(기록 완료·서면 피드백)에서 고릅니다. 준비 중인 미팅은 아직 기록이 아닙니다.
  const previous = earlier.find(
    (item) => item.status === "recorded" || item.recordType === "written",
  );
  const sourceOf = (task: Task) => {
    const feedback = data.feedback.find(
      (item) => task.feedbackIds.includes(item.id) && item.meetingId,
    );
    const id = task.sourceRecordId ?? feedback?.meetingId;
    return data.meetings.find((item) => item.id === id)?.title;
  };

  async function bring(patch: Partial<Meeting>, done: string) {
    try {
      await save("meetings", { ...meeting, ...patch });
      toast.success(done);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <aside className="record-side" aria-label={t("지난 기록에서")}>
      <h2 className="record-side-title">{t("지난 기록에서")}</h2>
      {!carried.length && !openQuestions.length && !previous && (
        <p className="record-side-empty">
          {t("지난 기록에서 넘어온 것이 없어요.")}
        </p>
      )}
      {carried.length > 0 && (
        <section className="record-side-section">
          <div className="record-side-row-head">
            <h3>{t("넘어온 할 일 {count}개", { count: carried.length })}</h3>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                void bring(
                  {
                    taskIds: [
                      ...meeting.taskIds,
                      ...carried.map((task) => task.id),
                    ],
                  },
                  t("넘어온 할 일을 모두 가져갔어요."),
                )
              }
            >
              {t("모두 가져가기")}
            </Button>
          </div>
          {carried.map((task) => (
            <div key={task.id} className="record-side-carry">
              <span className="record-side-line">
                <strong>{task.title}</strong>
                {sourceOf(task) && <small>{sourceOf(task)}</small>}
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  void bring(
                    { taskIds: [...meeting.taskIds, task.id] },
                    t("가져갔어요."),
                  )
                }
              >
                {t("가져가기")}
              </Button>
            </div>
          ))}
        </section>
      )}
      {openQuestions.length > 0 && (
        <section className="record-side-section">
          <h3>{t("열린 질문 {count}개", { count: openQuestions.length })}</h3>
          {openQuestions.map((question) => (
            <div key={question.id} className="record-side-carry">
              <span className="record-side-line">
                <strong>{question.text}</strong>
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  void bring(
                    { questionIds: [...meeting.questionIds, question.id] },
                    t("가져갔어요."),
                  )
                }
              >
                {t("가져가기")}
              </Button>
            </div>
          ))}
        </section>
      )}
      {previous && (
        <section className="record-side-section">
          <h3>{t("직전 기록")}</h3>
          <p className="record-side-line">
            <strong>{previous.title}</strong>
            <small>{formatDate(previous.date)}</small>
          </p>
          {previous.memo && (
            <p className="record-side-clamp">{previous.memo}</p>
          )}
          <Button size="xs" variant="outline" asChild>
            <Link to={`/r/${previous.researchId}/meetings/${previous.id}`}>
              {t("기록 열기")}
            </Link>
          </Button>
        </section>
      )}
    </aside>
  );
}
