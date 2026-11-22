import { t } from "@/lib/i18n";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { Segments } from "@/components/experience";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { decisionLog, REASON_MAX } from "@/lib/decisions";
import { selectNextMeeting } from "@/lib/home-meeting";
import {
  formatDate,
  kstDateKey,
  recordBase,
  type Decision,
  type Question,
} from "@/lib/domain";
import type { DetailHistoryState } from "@/lib/item-detail";
import "@/components/tasks/tasks.css";
import "./log.css";

const DETAIL_STATE: DetailHistoryState = { layer: "detail", depth: 1 };

function detailSearch(value: string): string {
  const params = new URLSearchParams(window.location.search);
  params.set("detail", value);
  return `?${params.toString()}`;
}

/**
 * 결정·질문 창(IA v2 P3, 06 §4). `결정 | 질문 n` 전환.
 * 줄을 누르면 항목 상세가 창 위에 덮입니다. 보관한 줄은 맨 아래에서 펼쳐 복원합니다.
 */
export function LogPanel({
  researchId,
  onClose,
}: {
  researchId: string;
  onClose(): void;
}) {
  const { data } = useWorkspace();
  const [view, setView] = useState<"decisions" | "questions">("decisions");
  const openQuestions = data.questions.filter(
    (item) =>
      item.researchId === researchId &&
      !item.archivedAt &&
      item.status === "open",
  ).length;
  return (
    <section className="tasks-panel" aria-labelledby="log-panel-heading">
      <header className="tasks-panel-head">
        <h2 id="log-panel-heading">{t("결정·질문")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ia-panel-close"
          aria-label={t("결정·질문 창 닫기")}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </Button>
      </header>
      <Segments
        value={view}
        onChange={(value) => setView(value as typeof view)}
        label={t("결정·질문 보기")}
        size="small"
        fill
        options={[
          { value: "decisions", label: t("결정") },
          { value: "questions", label: t("질문"), count: openQuestions },
        ]}
      />
      {view === "decisions" ? (
        <Decisions researchId={researchId} />
      ) : (
        <Questions researchId={researchId} />
      )}
    </section>
  );
}

function MeetingSelect({
  researchId,
  value,
  onChange,
  optional = false,
}: {
  researchId: string;
  value: string;
  onChange(value: string): void;
  optional?: boolean;
}) {
  const { data } = useWorkspace();
  const meetings = data.meetings
    .filter(
      (meeting) =>
        meeting.researchId === researchId &&
        !meeting.archivedAt &&
        meeting.status !== "cancelled",
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <label className="log-field">
      <span>{optional ? t("나온 기록(선택)") : t("나온 기록")}</span>
      <select
        value={value}
        required={!optional}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {optional ? t("고르지 않음") : t("기록 고르기")}
        </option>
        {meetings.map((meeting) => (
          <option key={meeting.id} value={meeting.id}>
            {meeting.title} · {formatDate(meeting.date)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddForm({
  children,
  onSubmit,
  onCancel,
  busy,
}: {
  children: ReactNode;
  onSubmit(): Promise<void>;
  onCancel(): void;
  busy: boolean;
}) {
  return (
    <form
      className="log-form"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      {children}
      <div className="item-detail-actions">
        <Button type="submit" size="sm" disabled={busy}>
          {t("저장")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("취소")}
        </Button>
      </div>
    </form>
  );
}

function Decisions({ researchId }: { researchId: string }) {
  const { data, save } = useWorkspace();
  const entries = decisionLog(data.decisions, data.meetings, researchId);
  const archived = data.decisions.filter(
    (item) => item.researchId === researchId && !!item.archivedAt,
  );
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [replacesId, setReplacesId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim() || !meetingId) return;
    setBusy(true);
    try {
      await save("decisions", {
        ...recordBase(researchId),
        origin: "manual",
        meetingId,
        text: text.trim(),
        reason: reason.trim() || undefined,
        replacesId: replacesId || undefined,
      } as Decision);
      setText("");
      setReason("");
      setReplacesId("");
      setAdding(false);
      toast.success(t("결정을 남겼어요."));
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {adding ? (
        <AddForm
          busy={busy}
          onSubmit={submit}
          onCancel={() => setAdding(false)}
        >
          <label className="log-field">
            <span>{t("결정 내용")}</span>
            <textarea
              autoFocus
              required
              rows={2}
              maxLength={2000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <label className="log-field">
            <span>{t("이유(선택)")}</span>
            <textarea
              rows={2}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <MeetingSelect
            researchId={researchId}
            value={meetingId}
            onChange={setMeetingId}
          />
          {entries.length > 0 && (
            <label className="log-field">
              <span>{t("바꾸는 이전 결정(선택)")}</span>
              <select
                value={replacesId}
                onChange={(event) => setReplacesId(event.target.value)}
              >
                <option value="">{t("고르지 않음")}</option>
                {entries
                  .filter((entry) => !entry.replacedBy)
                  .map(({ decision }) => (
                    <option key={decision.id} value={decision.id}>
                      {decision.text.slice(0, 60)}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </AddForm>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />
          {t("결정 추가")}
        </Button>
      )}
      {entries.length ? (
        <ol className="log-list" aria-label={t("결정 기록")}>
          {entries.map(({ decision, meeting, replaces, replacedBy }) => (
            <li key={decision.id} className={replacedBy ? "is-replaced" : ""}>
              <Link
                className="log-row"
                to={{ search: detailSearch(`decision:${decision.id}`) }}
                state={DETAIL_STATE}
              >
                <strong>
                  {decision.text}
                  {replacedBy && (
                    <span className="sr-only"> ({t("이후 바뀐 결정")})</span>
                  )}
                </strong>
                {decision.reason && (
                  <small>
                    {t("이유: {reason}", { reason: decision.reason })}
                  </small>
                )}
                {replaces && (
                  <small>
                    {t("이전 결정: {text}", { text: replaces.text })}
                  </small>
                )}
                {replacedBy && (
                  <small>
                    {t("이후 바뀜: {text}", { text: replacedBy.text })}
                  </small>
                )}
                <small>
                  {meeting
                    ? `${meeting.title} · ${formatDate(meeting.date)}`
                    : formatDate(kstDateKey(decision.createdAt))}
                </small>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="item-detail-empty">{t("아직 기록한 결정이 없어요.")}</p>
      )}
      <ArchivedList
        label={t("보관한 결정 {count}개", { count: archived.length })}
        items={archived.map((item) => ({ id: item.id, text: item.text }))}
        onRestore={(id) => {
          const item = archived.find((decision) => decision.id === id);
          if (item)
            save("decisions", { ...item, archivedAt: undefined }).catch(
              (error) => toast.error(friendlyError(error)),
            );
        }}
      />
    </>
  );
}

function Questions({ researchId }: { researchId: string }) {
  const { data, save } = useWorkspace();
  const all = data.questions.filter((item) => item.researchId === researchId);
  const open = all.filter((item) => !item.archivedAt && item.status === "open");
  const resolved = all.filter(
    (item) => !item.archivedAt && item.status === "resolved",
  );
  const archived = all.filter((item) => !!item.archivedAt);
  const research = data.researches.find((item) => item.id === researchId);
  const next = selectNextMeeting(
    data.meetings.filter((meeting) => meeting.researchId === researchId),
    research?.nextMeetingId,
  );
  const [showResolved, setShowResolved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await save("questions", {
        ...recordBase(researchId),
        origin: "manual",
        meetingId: meetingId || undefined,
        text: text.trim(),
        status: "open",
      } as Question);
      setText("");
      setAdding(false);
      toast.success(t("질문을 남겼어요."));
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(question: Question) {
    try {
      await save("questions", {
        ...question,
        status: question.status === "resolved" ? "open" : "resolved",
      });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  async function bringToNext(question: Question) {
    if (!next) return;
    try {
      await save("meetings", {
        ...next,
        questionIds: [...new Set([...next.questionIds, question.id])],
      });
      toast.success(t("‘{title}’에 가져가요.", { title: next.title }));
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  const row = (question: Question) => {
    const meeting = data.meetings.find(
      (item) => item.id === question.meetingId,
    );
    const resolvedNow = question.status === "resolved";
    const brought = !!next?.questionIds.includes(question.id);
    return (
      <li key={question.id} className="log-question">
        <button
          type="button"
          className="log-circle"
          aria-pressed={resolvedNow}
          aria-label={
            resolvedNow
              ? t("{text} 다시 열기", { text: question.text })
              : t("{text} 해결", { text: question.text })
          }
          onClick={() => void toggle(question)}
        >
          {resolvedNow && <Icon name="check" size={12} />}
        </button>
        <Link
          className="log-row"
          to={{ search: detailSearch(`question:${question.id}`) }}
          state={DETAIL_STATE}
        >
          <strong className={resolvedNow ? "is-done" : undefined}>
            {question.text}
          </strong>
          {meeting && <small>{meeting.title}</small>}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("{text} 메뉴", { text: question.text })}
            >
              <Icon name="more" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                if (!next) {
                  toast.error(t("다음 미팅을 먼저 잡아 주세요."));
                  return;
                }
                if (!brought) void bringToNext(question);
              }}
            >
              <Icon name="calendar" size={16} />
              {brought ? t("다음 미팅에 가져가요") : t("다음 미팅에 가져가기")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  };

  return (
    <>
      {adding ? (
        <AddForm
          busy={busy}
          onSubmit={submit}
          onCancel={() => setAdding(false)}
        >
          <label className="log-field">
            <span>{t("질문 내용")}</span>
            <textarea
              autoFocus
              required
              rows={2}
              maxLength={2000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <MeetingSelect
            researchId={researchId}
            value={meetingId}
            onChange={setMeetingId}
            optional
          />
        </AddForm>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />
          {t("질문 추가")}
        </Button>
      )}
      {open.length ? (
        <ul className="log-list" aria-label={t("열린 질문")}>
          {open.map(row)}
        </ul>
      ) : (
        <p className="item-detail-empty">{t("열린 질문이 없어요.")}</p>
      )}
      {resolved.length > 0 && (
        <section>
          <button
            type="button"
            className="tasks-finished-toggle"
            aria-expanded={showResolved}
            onClick={() => setShowResolved(!showResolved)}
          >
            <Icon
              name={showResolved ? "chevron-down" : "chevron-right"}
              size={16}
            />
            {t("해결한 질문 {count}개", { count: resolved.length })}
          </button>
          {showResolved && (
            <ul className="log-list" aria-label={t("해결한 질문")}>
              {resolved.map(row)}
            </ul>
          )}
        </section>
      )}
      <ArchivedList
        label={t("보관한 질문 {count}개", { count: archived.length })}
        items={archived.map((item) => ({ id: item.id, text: item.text }))}
        onRestore={(id) => {
          const item = archived.find((question) => question.id === id);
          if (item)
            save("questions", { ...item, archivedAt: undefined }).catch(
              (error) => toast.error(friendlyError(error)),
            );
        }}
      />
    </>
  );
}

function ArchivedList({
  label,
  items,
  onRestore,
}: {
  label: string;
  items: { id: string; text: string }[];
  onRestore(id: string): void;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <section>
      <button
        type="button"
        className="tasks-finished-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} size={16} />
        {label}
      </button>
      {open && (
        <ul className="log-list">
          {items.map((item) => (
            <li key={item.id} className="log-archived">
              <span>{item.text}</span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => onRestore(item.id)}
              >
                {t("복원")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
