import { t } from "@/lib/i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import {
  feedbackLabels,
  formatDate,
  priorityLabels,
  recordBase,
  responseLabels,
  taskLabels,
  type Decision,
  type Feedback,
  type Question,
  type RevisionResult,
  type Task,
  type WorkspaceData,
} from "@/lib/domain";
import { feedbackProgress } from "@/lib/feedback-progress";
import { documentOutline } from "@/lib/docs-list";
import { selectNextMeeting } from "@/lib/home-meeting";
import {
  detailValue,
  useCloseDetail,
  useOpenDetail,
  type DetailKind,
  type DetailRef,
} from "@/lib/item-detail";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { SourceAudioClip } from "@/components/recording/SourceAudioClip";
import { ResultEditorDialog } from "@/pages/student/ResultEditorDialog";
import { newResultDraft } from "@/pages/student/result-draft";
import { FeedbackPlans } from "./FeedbackPlans";
import {
  ResponseStatus,
  latestResponse,
  latestRound,
  timeText,
} from "@/pages/reviews/helpers";
import "./item-detail.css";

const KIND_LABEL: Record<DetailKind, string> = {
  task: t("할 일"),
  feedback: t("피드백"),
  decision: t("결정"),
  question: t("질문"),
  result: t("수정 결과"),
};

const COLLECTION = {
  task: "tasks",
  feedback: "feedback",
  decision: "decisions",
  question: "questions",
  result: "results",
} as const;

type AnyRecord = Task | Feedback | Decision | Question | RevisionResult;

/** 상세가 가리키는 기록. 이 연구의 것이 아니면 없음(볼 수 없는 것과 구분하지 않음, 06 §6.7). */
export function findDetailRecord(
  data: WorkspaceData,
  researchId: string,
  ref: DetailRef,
): AnyRecord | undefined {
  const list = data[COLLECTION[ref.kind]] as AnyRecord[];
  const record = list.find((item) => item.id === ref.id);
  return record &&
    record.researchId === researchId &&
    !("deletedAt" in record && record.deletedAt)
    ? record
    : undefined;
}

/**
 * 항목 상세(IA v2 06 §6, P5). 사이드 창 자리에 덮여 뜨고 폭은 사이드 창 그대로입니다.
 * 바로 바뀌는 값(제목·상태·체크·기한)은 그 자리에서 저장하고, 실패하면 되돌립니다.
 */
export function ItemDetail({
  researchId,
  detail,
}: {
  researchId: string;
  detail: DetailRef;
}) {
  const { data, loading, save, remove } = useWorkspace();
  const close = useCloseDetail();
  const heading = useRef<HTMLHeadingElement>(null);
  const record = findDetailRecord(data, researchId, detail);
  const label = KIND_LABEL[detail.kind];

  // 열면 머리 제목으로 초점을 옮깁니다(02 §4.3).
  useEffect(() => {
    heading.current?.focus();
  }, [detail.kind, detail.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[role='dialog'], [role='menu']")) return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const kind = COLLECTION[detail.kind];
  async function archive() {
    if (!record) return;
    try {
      await remove(kind, record.id);
      toast.success(t("보관했어요."), {
        duration: 6000,
        action: { label: t("되돌리기"), onClick: () => void restore() },
      });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function restore() {
    const current = findDetailRecord(data, researchId, detail);
    if (!current) return;
    try {
      await save(kind, { ...current, archivedAt: undefined } as never);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("detail", detailValue(detail));
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success(t("링크를 복사했어요."));
    } catch {
      toast.error(t("링크를 복사하지 못했어요."));
    }
  }

  return (
    <section className="item-detail" aria-labelledby="item-detail-heading">
      <header className="item-detail-head">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("상세 닫고 돌아가기")}
          onClick={close}
        >
          <Icon name="arrow-left" size={18} />
        </Button>
        <h2 id="item-detail-heading" ref={heading} tabIndex={-1}>
          {label}
        </h2>
        {record && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("{label} 메뉴", { label })}
              >
                <Icon name="more" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void copyLink()}>
                <Icon name="link" size={16} />
                {t("링크 복사")}
              </DropdownMenuItem>
              {!record.archivedAt && (
                <DropdownMenuItem onSelect={() => void archive()}>
                  <Icon name="trash" size={16} />
                  {t("보관")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("{label} 닫기", { label })}
          onClick={close}
        >
          <Icon name="close" size={18} />
        </Button>
      </header>
      <div className="item-detail-body">
        {!record ? (
          loading ? (
            <div className="item-detail-skeleton" aria-busy="true">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="item-detail-missing" role="status">
              <p>
                {t("이 항목을 열 수 없어요. 보관했거나 볼 수 없는 항목이에요.")}
              </p>
              <Button variant="outline" size="sm" onClick={close}>
                {t("닫기")}
              </Button>
            </div>
          )
        ) : (
          <>
            {record.archivedAt && (
              <div className="item-detail-archived" role="status">
                <span>{t("보관한 항목이에요.")}</span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void restore()}
                >
                  {t("복원")}
                </Button>
              </div>
            )}
            <DetailContent
              researchId={researchId}
              kind={detail.kind}
              record={record}
            />
          </>
        )}
      </div>
    </section>
  );
}

/** 바로 저장하고, 실패하면 되돌려 알립니다(06 §6.1). */
function useInstantSave() {
  const { save } = useWorkspace();
  return async function <K extends keyof typeof COLLECTION>(
    kind: K,
    value: AnyRecord,
  ) {
    try {
      await save(COLLECTION[kind], value as never);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  };
}

function DetailContent({
  researchId,
  kind,
  record,
}: {
  researchId: string;
  kind: DetailKind;
  record: AnyRecord;
}) {
  switch (kind) {
    case "task":
      return <TaskBody researchId={researchId} task={record as Task} />;
    case "feedback":
      return (
        <FeedbackBody researchId={researchId} feedback={record as Feedback} />
      );
    case "decision":
      return (
        <DecisionBody researchId={researchId} decision={record as Decision} />
      );
    case "question":
      return (
        <QuestionBody researchId={researchId} question={record as Question} />
      );
    case "result":
      return (
        <ResultBody researchId={researchId} result={record as RevisionResult} />
      );
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="item-detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/**
 * 긴 글 칸(06 §6.1): [편집]을 누르면 글 칸과 [취소] [저장]. 저장하지 않은 글이 있으면 화면을 옮기기 전에 묻습니다.
 */
function LongTextSection({
  title,
  value,
  empty,
  note,
  onSave,
}: {
  title: string;
  value: string;
  /** 비어 있을 때 보일 말 */
  empty: string;
  /** 칸 아래 한 줄 안내(예: 나만 보는 메모) */
  note?: string;
  onSave(value: string): Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const dirty = editing && text !== value;
  useNavigationGuard({ dirty, busy: saving, label: title });
  return (
    <section className="item-detail-section">
      <div className="item-detail-section-head">
        <h3>{title}</h3>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText(value);
              setEditing(true);
            }}
          >
            {t("편집")}
          </Button>
        )}
      </div>
      {editing ? (
        <form
          className="item-detail-edit"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              await onSave(text.trim());
              setEditing(false);
            } catch (error) {
              toast.error(friendlyError(error));
            } finally {
              setSaving(false);
            }
          }}
        >
          <textarea
            aria-label={title}
            value={text}
            maxLength={20000}
            rows={5}
            autoFocus
            onChange={(event) => setText(event.target.value)}
          />
          <div className="item-detail-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              {t("취소")}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t("저장 중") : t("저장")}
            </Button>
          </div>
        </form>
      ) : value ? (
        <p className="item-detail-text">{value}</p>
      ) : (
        <p className="item-detail-empty">{empty}</p>
      )}
      {note && <p className="item-detail-note">{note}</p>}
    </section>
  );
}

function TitleField({
  value,
  onSave,
  label,
}: {
  value: string;
  onSave(value: string): void;
  label: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const next = text.trim();
    if (!next) setText(value);
    else if (next !== value) onSave(next);
  };
  return (
    <input
      className="item-detail-title"
      aria-label={label}
      value={text}
      maxLength={200}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.stopPropagation();
          setText(value);
        }
      }}
    />
  );
}

function Quote({
  text,
  meetingId,
  researchId,
  audio,
}: {
  text?: string;
  meetingId?: string;
  researchId: string;
  /** 전사문에서 고른 구간으로 만든 기록이면 그 구간 녹음 듣기 */
  audio?: { source: NonNullable<Feedback["audioSource"]>; label: string };
}) {
  if (!text && !audio) return null;
  return (
    <Section title={t("원문")}>
      {text && <blockquote className="item-detail-quote">{text}</blockquote>}
      {audio && <SourceAudioClip source={audio.source} label={audio.label} />}
      {meetingId && (
        <Link
          className="item-detail-link"
          to={`/r/${researchId}/meetings/${meetingId}?tab=record`}
        >
          {t("기록에서 보기")}
          <Icon name="chevron-right" size={14} />
        </Link>
      )}
    </Section>
  );
}

function SourceMeeting({
  meetingId,
  researchId,
}: {
  meetingId?: string;
  researchId: string;
}) {
  const { data } = useWorkspace();
  const meeting = data.meetings.find((item) => item.id === meetingId);
  if (!meeting) return null;
  return (
    <Section title={t("나온 기록")}>
      <Link
        className="item-detail-row"
        to={`/r/${researchId}/meetings/${meeting.id}`}
      >
        <Icon name="calendar" size={16} />
        <span>{meeting.title}</span>
        <small>{formatDate(meeting.date)}</small>
      </Link>
    </Section>
  );
}

/** 상세 안에서 다른 항목을 여는 줄. 주소를 쌓아 뒤로 가기로 앞 항목에 돌아갑니다. */
function DetailRow({
  target,
  children,
}: {
  target: DetailRef;
  children: ReactNode;
}) {
  const open = useOpenDetail();
  return (
    <button
      type="button"
      className="item-detail-row"
      onClick={() => open(target)}
    >
      {children}
    </button>
  );
}

function TaskCheckRow({ task }: { task: Task }) {
  const instant = useInstantSave();
  const done = task.status === "done";
  return (
    <div className="item-detail-task">
      <input
        type="checkbox"
        checked={done}
        aria-label={t("{title} 완료", { title: task.title })}
        onChange={() =>
          void instant("task", { ...task, status: done ? "todo" : "done" })
        }
      />
      <DetailRow target={{ kind: "task", id: task.id }}>
        <span className={done ? "is-done" : undefined}>{task.title}</span>
        {task.dueDate && <small>{formatDate(task.dueDate)}</small>}
      </DetailRow>
    </div>
  );
}

function AddTaskButton({
  researchId,
  title,
  feedbackIds = [],
  label = t("할 일 추가"),
}: {
  researchId: string;
  title: string;
  feedbackIds?: string[];
  label?: string;
}) {
  const { save, remove } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || !title.trim()}
      onClick={async () => {
        setBusy(true);
        try {
          const task = await save("tasks", {
            ...recordBase(researchId),
            origin: "manual",
            title: title.trim().slice(0, 80),
            description: "",
            status: "todo",
            dueDate: null,
            priority: "normal",
            visibility: "private",
            feedbackIds,
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
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="plus" size={16} />
      {label}
    </Button>
  );
}

function TaskBody({ researchId, task }: { researchId: string; task: Task }) {
  const { data, save } = useWorkspace();
  const instant = useInstantSave();
  const [resultDraft, setResultDraft] = useState<RevisionResult | null>(null);
  const feedback = data.feedback.filter(
    (item) => task.feedbackIds.includes(item.id) && !item.archivedAt,
  );
  const otherFeedback = data.feedback.filter(
    (item) =>
      item.researchId === researchId &&
      !item.archivedAt &&
      !task.feedbackIds.includes(item.id),
  );
  const plan = task.planId
    ? data.plans.find((item) => item.id === task.planId)
    : undefined;
  const meetings = data.meetings.filter(
    (meeting) => meeting.taskIds.includes(task.id) && !meeting.archivedAt,
  );
  const research = data.researches.find((item) => item.id === researchId);
  const next = selectNextMeeting(
    data.meetings.filter((meeting) => meeting.researchId === researchId),
    research?.nextMeetingId,
  );
  const results = data.results.filter(
    (result) => result.taskIds.includes(task.id) && !result.archivedAt,
  );
  const done = task.status === "done";

  async function bringToNext() {
    if (!next) return;
    try {
      await save("meetings", {
        ...next,
        taskIds: [...new Set([...next.taskIds, task.id])],
      });
      toast.success(t("‘{title}’에 가져가요.", { title: next.title }));
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <>
      <div className="item-detail-headline">
        <input
          type="checkbox"
          checked={done}
          aria-label={t("완료")}
          onChange={() =>
            void instant("task", { ...task, status: done ? "todo" : "done" })
          }
        />
        <TitleField
          label={t("할 일 제목")}
          value={task.title}
          onSave={(title) => void instant("task", { ...task, title })}
        />
      </div>
      <div className="item-detail-fields">
        <label>
          <span>{t("상태")}</span>
          <select
            value={task.status}
            onChange={(event) =>
              void instant("task", {
                ...task,
                status: event.target.value as Task["status"],
              })
            }
          >
            {(Object.keys(taskLabels) as Task["status"][]).map((key) => (
              <option key={key} value={key}>
                {taskLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("기한")}</span>
          <input
            type="date"
            value={task.dueDate ?? ""}
            onChange={(event) =>
              void instant("task", {
                ...task,
                dueDate: event.target.value || null,
              })
            }
          />
        </label>
        <label>
          <span>{t("우선순위")}</span>
          <select
            value={task.priority}
            onChange={(event) =>
              void instant("task", {
                ...task,
                priority: event.target.value as Task["priority"],
              })
            }
          >
            {(Object.keys(priorityLabels) as Task["priority"][]).map((key) => (
              <option key={key} value={key}>
                {priorityLabels[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Quote
        text={task.sourceQuote}
        meetingId={task.sourceRecordId}
        researchId={researchId}
      />
      <LongTextSection
        title={t("설명")}
        value={task.description}
        empty={t("아직 설명이 없어요.")}
        onSave={async (description) => {
          await save("tasks", { ...task, description });
        }}
      />
      <DocTarget researchId={researchId} task={task} />
      <Section title={t("연결된 피드백")}>
        {feedback.map((item) => (
          <div key={item.id} className="item-detail-task">
            <DetailRow target={{ kind: "feedback", id: item.id }}>
              <Icon name="feedback" size={16} />
              <span>{item.title}</span>
            </DetailRow>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("‘{title}’ 연결 빼기", { title: item.title })}
              onClick={() =>
                void instant("task", {
                  ...task,
                  feedbackIds: task.feedbackIds.filter((id) => id !== item.id),
                })
              }
            >
              <Icon name="close" size={14} />
            </Button>
          </div>
        ))}
        {!feedback.length && (
          <p className="item-detail-empty">{t("연결된 피드백이 없어요.")}</p>
        )}
        {otherFeedback.length > 0 && (
          <div className="item-detail-fields">
            <label>
              <span>{t("피드백 잇기")}</span>
              <select
                value=""
                onChange={(event) => {
                  const id = event.target.value;
                  if (id)
                    void instant("task", {
                      ...task,
                      feedbackIds: [...task.feedbackIds, id],
                    });
                }}
              >
                <option value="">{t("고르기")}</option>
                {otherFeedback.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Section>
      {plan && (
        <Section title={t("수정 방법")}>
          <p className="item-detail-text">
            {plan.title || t("제목 없는 수정 방법")}
            {plan.status === "cancelled" && (
              <small className="item-detail-muted">
                {" · "}
                {t("선택 취소됨")}
              </small>
            )}
          </p>
        </Section>
      )}
      <Section title={t("가져간 미팅")}>
        {meetings.map((meeting) => (
          <Link
            key={meeting.id}
            className="item-detail-row"
            to={`/r/${researchId}/meetings/${meeting.id}`}
          >
            <Icon name="calendar" size={16} />
            <span>{meeting.title}</span>
            <small>{formatDate(meeting.date)}</small>
          </Link>
        ))}
        {!meetings.length && (
          <p className="item-detail-empty">
            {t("아직 미팅에 가져가지 않았어요.")}
          </p>
        )}
        {next && !next.taskIds.includes(task.id) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void bringToNext()}
          >
            <Icon name="calendar" size={16} />
            {t("다음 미팅에 가져가기")}
          </Button>
        )}
      </Section>
      <Section title={t("수정 결과")}>
        {results.map((result) => (
          <DetailRow key={result.id} target={{ kind: "result", id: result.id }}>
            <Icon name="result" size={16} />
            <span>{result.title}</span>
          </DetailRow>
        ))}
        {!results.length && (
          <p className="item-detail-empty">{t("아직 수정 결과가 없어요.")}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResultDraft(newResultDraft(researchId, { task }))}
        >
          <Icon name="plus" size={16} />
          {t("수정 결과 추가")}
        </Button>
        <ResultEditorDialog
          researchId={researchId}
          draft={resultDraft}
          setDraft={setResultDraft}
        />
      </Section>
      <p className="item-detail-note">
        {t("할 일 완료는 수정 결과 작성이나 교수 검토와 별개예요.")}
      </p>
    </>
  );
}

/**
 * 고칠 글(IA v2 06 항목 상세): 글을 고르고 그 글의 제목에서 위치를 고릅니다.
 * 위치를 고르지 않으면 글 맨 위 여백에 보입니다(05 §3.5).
 */
function DocTarget({ researchId, task }: { researchId: string; task: Task }) {
  const { data } = useWorkspace();
  const instant = useInstantSave();
  const docs = data.documents
    .filter((d) => d.researchId === researchId && !d.archivedAt)
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
  const doc = docs.find((d) => d.id === task.documentId);
  const headings = doc ? [...new Set(documentOutline(doc.content, 200))] : [];
  const anchor = task.sectionAnchor ?? "";
  return (
    <Section title={t("고칠 글")}>
      <div className="item-detail-fields">
        <label>
          <span>{t("글")}</span>
          <select
            value={task.documentId ?? ""}
            onChange={(event) =>
              void instant("task", {
                ...task,
                documentId: event.target.value || undefined,
                sectionAnchor: undefined,
              })
            }
          >
            <option value="">{t("고르지 않음")}</option>
            {task.documentId && !doc && (
              <option value={task.documentId}>{t("찾을 수 없는 글")}</option>
            )}
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        {doc && (
          <label>
            <span>{t("위치")}</span>
            <select
              value={anchor}
              onChange={(event) =>
                void instant("task", {
                  ...task,
                  sectionAnchor: event.target.value || undefined,
                })
              }
            >
              <option value="">{t("글 맨 위")}</option>
              {anchor && !headings.includes(anchor) && (
                <option value={anchor}>
                  {t("찾을 수 없는 제목 · {title}", { title: anchor })}
                </option>
              )}
              {headings.map((heading) => (
                <option key={heading} value={heading}>
                  {heading}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {doc && (
        <Link
          className="item-detail-link"
          to={`/r/${researchId}/docs/w/${doc.id}${
            anchor ? `?at=${encodeURIComponent(anchor)}` : ""
          }`}
        >
          {t("글 열기")}
          <Icon name="chevron-right" size={14} />
        </Link>
      )}
    </Section>
  );
}

/** 이 수정 결과가 담긴 검토 요청의 최신 차수와 교수 응답 */
function latestReview(data: WorkspaceData, resultIds: string[]) {
  const items = data.reviewItems.filter((item) =>
    resultIds.includes(item.resultId),
  );
  const rounds = data.rounds
    .filter((round) => items.some((item) => item.id === round.itemId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const round = rounds[0];
  if (!round) return null;
  const response = data.responses
    .filter((item) => item.roundId === round.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return {
    round,
    response,
    href: `/reviews/${round.requestId}?item=${round.itemId}&round=${round.id}`,
  };
}

function ReviewSection({
  researchId,
  resultIds,
  feedbackIds,
}: {
  researchId: string;
  resultIds: string[];
  feedbackIds: string[];
}) {
  const { data } = useWorkspace();
  const review = latestReview(data, resultIds);
  return (
    <Section title={t("교수 응답")}>
      {review ? (
        <>
          <p className="item-detail-badge">
            {review.response
              ? responseLabels[review.response.result]
              : t("응답 전")}
          </p>
          {review.response?.comment && (
            <p className="item-detail-text">
              {review.response.comment.slice(0, 160)}
            </p>
          )}
          <div className="item-detail-actions">
            <Button variant="outline" size="sm" asChild>
              <Link to={review.href}>{t("검토 열기")}</Link>
            </Button>
            {review.response?.comment && (
              <AddTaskButton
                researchId={researchId}
                title={review.response.comment}
                feedbackIds={feedbackIds}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <p className="item-detail-empty">
            {resultIds.length
              ? t("아직 검토 요청에 담지 않았어요.")
              : t("수정 결과를 먼저 남겨 주세요.")}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!resultIds.length}
            asChild={!!resultIds.length}
          >
            {resultIds.length ? (
              <Link to={`?new=review&result=${resultIds[0]}`}>
                {t("검토 요청 만들기")}
              </Link>
            ) : (
              <span>{t("검토 요청 만들기")}</span>
            )}
          </Button>
        </>
      )}
    </Section>
  );
}

function FeedbackBody({
  researchId,
  feedback,
}: {
  researchId: string;
  feedback: Feedback;
}) {
  const { data, save } = useWorkspace();
  const instant = useInstantSave();
  const [resultDraft, setResultDraft] = useState<RevisionResult | null>(null);
  const plans = data.plans.filter(
    (plan) => plan.feedbackId === feedback.id && !plan.archivedAt,
  );
  const tasks = data.tasks.filter(
    (task) => task.feedbackIds.includes(feedback.id) && !task.archivedAt,
  );
  const results = data.results.filter(
    (result) => result.feedbackIds.includes(feedback.id) && !result.archivedAt,
  );
  const progress = feedbackProgress({
    feedback,
    plans,
    tasks,
    results,
    reviewItems: data.reviewItems,
    rounds: data.rounds,
    responses: data.responses,
  });
  const allDone =
    tasks.length > 0 && tasks.every((task) => task.status === "done");
  return (
    <>
      <TitleField
        label={t("피드백 제목")}
        value={feedback.title}
        onSave={(title) => void instant("feedback", { ...feedback, title })}
      />
      <div className="item-detail-fields">
        <label>
          <span>{t("상태")}</span>
          <select
            value={feedback.status}
            onChange={(event) =>
              void instant("feedback", {
                ...feedback,
                status: event.target.value as Feedback["status"],
              })
            }
          >
            {(Object.keys(feedbackLabels) as Feedback["status"][]).map(
              (key) => (
                <option key={key} value={key}>
                  {feedbackLabels[key]}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <ol className="item-detail-progress" aria-label={t("진행")}>
        {progress.map((step) => (
          <li
            key={step.key}
            data-filled={step.filled || undefined}
            aria-label={`${step.label}: ${step.value}`}
          >
            <span className="item-detail-dot" aria-hidden="true" />
            <span className="item-detail-step">
              <strong>{step.label}</strong>
              <small>{step.value}</small>
            </span>
          </li>
        ))}
      </ol>
      <Quote
        text={feedback.sourceQuote}
        meetingId={feedback.meetingId}
        researchId={researchId}
        audio={
          feedback.audioSource
            ? { source: feedback.audioSource, label: feedback.title }
            : undefined
        }
      />
      <LongTextSection
        title={t("내용")}
        value={feedback.body}
        empty={t("아직 내용이 없어요.")}
        onSave={async (body) => {
          if (!body) throw new Error(t("피드백 내용을 입력해 주세요."));
          await save("feedback", { ...feedback, body });
        }}
      />
      <Section title={t("수정 방법")}>
        <FeedbackPlans
          researchId={researchId}
          feedback={feedback}
          plans={plans}
        />
      </Section>
      <Section title={t("할 일")}>
        {tasks.map((task) => (
          <TaskCheckRow key={task.id} task={task} />
        ))}
        {!tasks.length && (
          <p className="item-detail-empty">{t("아직 할 일이 없어요.")}</p>
        )}
        <AddTaskButton
          researchId={researchId}
          title={feedback.title}
          feedbackIds={[feedback.id]}
        />
      </Section>
      <Section title={t("수정 결과")}>
        {results.map((result) => (
          <DetailRow key={result.id} target={{ kind: "result", id: result.id }}>
            <Icon name="result" size={16} />
            <span>{result.title}</span>
          </DetailRow>
        ))}
        {!results.length && (
          <p className="item-detail-empty">
            {allDone
              ? t(
                  "할 일을 모두 끝냈어요. 어떻게 고쳤는지 수정 결과로 남길 수 있어요.",
                )
              : t("아직 수정 결과가 없어요.")}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setResultDraft(newResultDraft(researchId, { feedback }))
          }
        >
          <Icon name="plus" size={16} />
          {t("수정 결과 추가")}
        </Button>
        {/* 상세 위에서 바로 엽니다(지금 수정 결과 대화상자). */}
        <ResultEditorDialog
          researchId={researchId}
          draft={resultDraft}
          setDraft={setResultDraft}
        />
      </Section>
      <ReviewSection
        researchId={researchId}
        resultIds={results.map((result) => result.id)}
        feedbackIds={[feedback.id]}
      />
      <LongTextSection
        title={t("개인 메모")}
        value={feedback.notes ?? ""}
        empty={t("아직 메모가 없어요.")}
        note={t("나만 보는 메모예요. 교수·공동연구자에게 보이지 않아요.")}
        onSave={async (notes) => {
          await save("feedback", { ...feedback, notes });
        }}
      />
      <SourceMeeting meetingId={feedback.meetingId} researchId={researchId} />
    </>
  );
}

function DecisionBody({
  researchId,
  decision,
}: {
  researchId: string;
  decision: Decision;
}) {
  const { data } = useWorkspace();
  const replaced = data.decisions.find(
    (item) => item.id === decision.replacesId,
  );
  return (
    <>
      <p className="item-detail-lead">{decision.text}</p>
      {decision.reason && (
        <Section title={t("이유")}>
          <p className="item-detail-text">{decision.reason}</p>
        </Section>
      )}
      {replaced && (
        <Section title={t("바꾼 이전 결정")}>
          <DetailRow target={{ kind: "decision", id: replaced.id }}>
            <span>{replaced.text}</span>
          </DetailRow>
        </Section>
      )}
      <SourceMeeting meetingId={decision.meetingId} researchId={researchId} />
      <div className="item-detail-actions">
        <AddTaskButton researchId={researchId} title={decision.text} />
      </div>
    </>
  );
}

function QuestionBody({
  researchId,
  question,
}: {
  researchId: string;
  question: Question;
}) {
  const { data } = useWorkspace();
  const instant = useInstantSave();
  const meetings = data.meetings.filter(
    (meeting) =>
      meeting.questionIds.includes(question.id) && !meeting.archivedAt,
  );
  const resolved = question.status === "resolved";
  return (
    <>
      <p className="item-detail-lead">{question.text}</p>
      <label className="item-detail-toggle">
        <input
          type="checkbox"
          checked={resolved}
          onChange={() =>
            void instant("question", {
              ...question,
              status: resolved ? "open" : "resolved",
            })
          }
        />
        {t("해결했어요")}
      </label>
      <SourceMeeting meetingId={question.meetingId} researchId={researchId} />
      {meetings.length > 0 && (
        <Section title={t("가져간 미팅")}>
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              className="item-detail-row"
              to={`/r/${researchId}/meetings/${meeting.id}`}
            >
              <Icon name="calendar" size={16} />
              <span>{meeting.title}</span>
              <small>{formatDate(meeting.date)}</small>
            </Link>
          ))}
        </Section>
      )}
    </>
  );
}

function ResultBody({
  researchId,
  result,
}: {
  researchId: string;
  result: RevisionResult;
}) {
  const { data } = useWorkspace();
  const instant = useInstantSave();
  // [편집]은 지금의 수정 결과 대화상자를 상세 위에서 엽니다(06 §6.6).
  const [draft, setDraft] = useState<RevisionResult | null>(null);
  const feedback = data.feedback.filter((item) =>
    result.feedbackIds.includes(item.id),
  );
  const tasks = data.tasks.filter((item) => result.taskIds.includes(item.id));
  const version = data.versions.find((item) => item.id === result.versionId);
  const items = data.reviewItems.filter((item) => item.resultId === result.id);
  const needsFile =
    result.kind === "document" && (!result.versionId || !result.location);
  return (
    <>
      <TitleField
        label={t("수정 결과 제목")}
        value={result.title}
        onSave={(title) => void instant("result", { ...result, title })}
      />
      <div className="item-detail-actions">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraft({ ...result })}
        >
          <Icon name="edit" size={15} />
          {t("편집")}
        </Button>
      </div>
      <Section title={t("수정한 내용")}>
        {result.description ? (
          <p className="item-detail-text">{result.description}</p>
        ) : (
          <p className="item-detail-empty">{t("아직 적지 않았어요.")}</p>
        )}
      </Section>
      <Section title={t("교수님이 볼 파일")}>
        {version ? (
          <Link
            className="item-detail-row"
            to={`/r/${researchId}/docs/m/${version.materialId}?version=${version.id}`}
          >
            <Icon name="file" size={16} />
            <span>
              {version.fileName}
              <small>
                {t("파일 버전 v{number}", { number: version.number })} ·{" "}
                {result.location || t("볼 위치 없음")}
              </small>
            </span>
          </Link>
        ) : (
          <p className="item-detail-empty">
            {result.kind === "document"
              ? t("아직 파일을 연결하지 않았어요.")
              : t("문서 외 수정이라 파일 없이 위에 적은 설명만 보여요.")}
          </p>
        )}
        {needsFile && (
          <p className="item-detail-note">
            {t(
              "문서 수정에는 파일과 볼 위치가 필요해요. 편집에서 추가해 주세요.",
            )}
          </p>
        )}
      </Section>
      <Section title={t("연결된 피드백·할 일")}>
        {feedback.map((item) => (
          <DetailRow key={item.id} target={{ kind: "feedback", id: item.id }}>
            <Icon name="feedback" size={16} />
            <span>{item.title}</span>
          </DetailRow>
        ))}
        {tasks.map((task) => (
          <TaskCheckRow key={task.id} task={task} />
        ))}
        {!feedback.length && !tasks.length && (
          <p className="item-detail-empty">{t("연결된 항목이 없어요.")}</p>
        )}
      </Section>
      {items.length ? (
        <Section title={t("교수 응답")}>
          {items.map((item) => {
            const request = data.reviews.find(
              (review) => review.id === item.requestId,
            );
            const round = latestRound(data, item.id);
            const response = latestResponse(data, round?.id);
            const comments = data.comments.filter(
              (comment) => comment.roundId === round?.id,
            );
            return (
              <article key={item.id} className="item-detail-review">
                <div className="item-detail-review-head">
                  <strong>{request?.title ?? item.title}</strong>
                  <ResponseStatus response={response} />
                </div>
                <small className="item-detail-note">
                  {round
                    ? t("{number}차", { number: round.number })
                    : t("차수 없음")}
                  {response ? ` · ${timeText(response.createdAt)}` : ""}
                </small>
                {response?.comment && (
                  <blockquote className="item-detail-quote">
                    {response.comment}
                  </blockquote>
                )}
                {comments.length > 0 && (
                  <ul className="item-detail-comments">
                    {comments.map((comment) => (
                      <li key={comment.id}>
                        <small>
                          {comment.authorName}
                          {comment.resolved ? ` · ${t("해결됨")}` : ""}
                        </small>
                        {comment.body}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="item-detail-actions">
                  {request && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/reviews/${request.id}`}>
                        {t("검토 열기")}
                      </Link>
                    </Button>
                  )}
                  {response?.comment && (
                    <AddTaskButton
                      researchId={researchId}
                      title={response.comment}
                      feedbackIds={result.feedbackIds}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </Section>
      ) : (
        <ReviewSection
          researchId={researchId}
          resultIds={needsFile ? [] : [result.id]}
          feedbackIds={result.feedbackIds}
        />
      )}
      <ResultEditorDialog
        researchId={researchId}
        draft={draft}
        setDraft={setDraft}
      />
    </>
  );
}
