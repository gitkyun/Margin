import { t } from "@/lib/i18n";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/experience";
import { useWorkspace } from "@/lib/workspace";
import {
  feedbackLabels,
  formatDate,
  type Feedback,
  type Milestone,
  type Task,
} from "@/lib/domain";

/**
 * 정보 보기(IA v2 05 §3.8, `?side=info`): 여백 자리의 300px 열.
 * 연결된 주요 목표(고르고 빼기) · 이 글의 피드백·할 일 · 쓰인 곳(이 글을 보여 줄 글로 고른 미팅).
 */
export function EditorInfo({
  researchId,
  documentId,
  tasks,
  feedback,
  onToggle,
  onOpenTask,
  onOpenFeedback,
  onClose,
  draft,
}: {
  researchId: string;
  documentId: string;
  /** 연구 도우미 초안이면 근거로 쓴 기록과 사람이 고쳤는지(05 §3.9) */
  draft?: {
    from: { kind: string; id: string; title: string }[];
    edited: boolean;
  };
  tasks: Task[];
  feedback: { feedback: Feedback; number: number }[];
  onToggle: (task: Task) => void;
  onOpenTask: (id: string) => void;
  onOpenFeedback: (id: string) => void;
  onClose: () => void;
}) {
  const { data, save } = useWorkspace();
  const milestones = data.milestones.filter(
    (m) => m.researchId === researchId && !m.archivedAt,
  );
  const linked = milestones.filter((m) => m.documentIds.includes(documentId));
  const unlinked = milestones.filter(
    (m) => !m.documentIds.includes(documentId),
  );
  const meetings = data.meetings
    .filter(
      (m) =>
        m.researchId === researchId &&
        !m.archivedAt &&
        m.documentIds?.includes(documentId),
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  async function setLinked(milestone: Milestone, on: boolean) {
    try {
      await save("milestones", {
        ...milestone,
        documentIds: on
          ? [...milestone.documentIds, documentId]
          : milestone.documentIds.filter((id) => id !== documentId),
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <aside className="editor-info" aria-label={t("글 정보 보기")}>
      <div className="editor-info-head">
        <h2>{t("정보")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("정보 닫기")}
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </Button>
      </div>
      <section>
        <h3>{t("연결된 주요 목표")}</h3>
        {linked.map((m) => (
          <div key={m.id} className="editor-info-row">
            <Link to={`/r/${researchId}/flow`}>
              <span>{m.title}</span>
              <small>{m.status === "done" ? t("끝남") : t("진행 예정")}</small>
            </Link>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("{title}에서 빼기", { title: m.title })}
              onClick={() => void setLinked(m, false)}
            >
              <Icon name="close" size={14} />
            </Button>
          </div>
        ))}
        {!linked.length && (
          <p className="editor-info-empty">
            {t("이 글을 넣은 목표가 아직 없어요.")}
          </p>
        )}
        {unlinked.length > 0 && (
          <Choice
            compact
            label={t("목표에 넣기")}
            value=""
            onChange={(id) => {
              const m = unlinked.find((x) => x.id === id);
              if (m) void setLinked(m, true);
            }}
            options={unlinked.map((m) => ({ value: m.id, label: m.title }))}
          />
        )}
      </section>
      <section>
        <h3>{t("이 글의 할 일")}</h3>
        {tasks.map((task) => {
          const done = task.status === "done";
          return (
            <div key={task.id} className="editor-info-task">
              <input
                type="checkbox"
                checked={done}
                aria-label={t("{title} 완료", { title: task.title })}
                onChange={() => onToggle(task)}
              />
              <button type="button" onClick={() => onOpenTask(task.id)}>
                <span className={done ? "is-done" : undefined}>
                  {task.title}
                </span>
                {task.sectionAnchor && <small>{task.sectionAnchor}</small>}
              </button>
            </div>
          );
        })}
        {!tasks.length && (
          <p className="editor-info-empty">
            {t("할 일 상세의 '고칠 글'에서 이 글을 고르면 여기에 보여요.")}
          </p>
        )}
      </section>
      {feedback.length > 0 && (
        <section>
          <h3>{t("이 글의 피드백")}</h3>
          {feedback.map(({ feedback: item, number }) => (
            <button
              key={item.id}
              type="button"
              className="editor-info-feedback"
              onClick={() => onOpenFeedback(item.id)}
            >
              <span className="editor-gutter-num" aria-hidden>
                {number}
              </span>
              <span>{item.title}</span>
              <small>{feedbackLabels[item.status]}</small>
            </button>
          ))}
        </section>
      )}
      {draft && (
        <section>
          <h3>{t("초안의 근거")}</h3>
          {draft.edited && (
            <p className="editor-info-empty">
              {t("연구 도우미가 쓴 초안에서 시작한 글이에요.")}
            </p>
          )}
          {draft.from.map((source) => {
            const href =
              source.kind === "meetings"
                ? `/r/${researchId}/meetings/${source.id}`
                : source.kind === "documents"
                  ? `/r/${researchId}/docs/w/${source.id}`
                  : null;
            if (href)
              return (
                <Link
                  key={`${source.kind}:${source.id}`}
                  className="editor-info-row-link"
                  to={href}
                >
                  <span>{source.title}</span>
                </Link>
              );
            if (source.kind === "feedback" || source.kind === "tasks")
              return (
                <button
                  key={`${source.kind}:${source.id}`}
                  type="button"
                  className="editor-info-feedback"
                  onClick={() =>
                    source.kind === "feedback"
                      ? onOpenFeedback(source.id)
                      : onOpenTask(source.id)
                  }
                >
                  <span>{source.title}</span>
                </button>
              );
            return (
              <p
                key={`${source.kind}:${source.id}`}
                className="editor-info-empty"
              >
                {source.title}
              </p>
            );
          })}
          {!draft.from.length && (
            <p className="editor-info-empty">
              {t("근거로 쓴 기록이 따로 남아 있지 않아요.")}
            </p>
          )}
        </section>
      )}
      <section>
        <h3>{t("쓰인 곳")}</h3>
        {meetings.map((m) => (
          <Link
            key={m.id}
            className="editor-info-row-link"
            to={`/r/${researchId}/meetings/${m.id}`}
          >
            <span>{m.title}</span>
            {m.date && <small>{formatDate(m.date)}</small>}
          </Link>
        ))}
        {!meetings.length && (
          <p className="editor-info-empty">
            {t("이 글을 보여 줄 글로 고른 미팅이 아직 없어요.")}
          </p>
        )}
      </section>
    </aside>
  );
}
