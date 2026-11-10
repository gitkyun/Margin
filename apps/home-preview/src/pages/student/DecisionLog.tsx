import { Link } from "react-router-dom";
import type { DecisionEntry } from "@/lib/decisions";
import { formatDate } from "@/lib/domain";

interface DecisionLogProps {
  entries: DecisionEntry[];
  researchId: string;
}

/**
 * 연구 전체의 결정을 최근 것부터 보여 주는 목록(미팅 화면의 여백 패널).
 * 나중에 바뀐 결정은 흐리게 두고, 무엇으로 바뀌었는지 함께 적습니다.
 */
export function DecisionLog({ entries, researchId }: DecisionLogProps) {
  if (!entries.length)
    return (
      <p className="student-empty-inline">
        아직 기록한 결정이 없어요. 미팅 기록의 ‘결정·질문’에서 남길 수 있어요.
      </p>
    );
  return (
    <ol className="decision-log">
      {entries.map(({ decision, meeting, replaces, replacedBy }) => (
        <li key={decision.id} className={replacedBy ? "is-replaced" : ""}>
          <p className="decision-log-text">{decision.text}</p>
          {decision.reason && (
            <p className="decision-log-reason">이유: {decision.reason}</p>
          )}
          {replaces && (
            <p className="decision-log-link">이전 결정: {replaces.text}</p>
          )}
          {replacedBy && (
            <p className="decision-log-link">이후 바뀜: {replacedBy.text}</p>
          )}
          <small>
            {meeting ? (
              <Link
                to={`/r/${researchId}/meetings/${meeting.id}?tab=questions`}
              >
                {meeting.title}
                {meeting.date ? ` · ${formatDate(meeting.date)}` : ""}
              </Link>
            ) : (
              formatDate(decision.createdAt.slice(0, 10))
            )}
          </small>
        </li>
      ))}
    </ol>
  );
}
