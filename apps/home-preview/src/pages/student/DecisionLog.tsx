import { t } from "@/lib/i18n";
import { Link } from "react-router-dom";
import type { DecisionEntry } from "@/lib/decisions";
import { formatDate, kstDateKey } from "@/lib/domain";
import { InlineEmpty } from "@/components/common";

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
      <InlineEmpty>
        {t(
          "아직 기록한 결정이 없어요. 미팅 기록의 ‘결정·질문’에서 남길 수 있어요.",
        )}
      </InlineEmpty>
    );
  return (
    <ol className="decision-log" aria-label={t("결정 기록 타임라인")}>
      {entries.map(({ decision, meeting, replaces, replacedBy }) => (
        <li key={decision.id} className={replacedBy ? "is-replaced" : ""}>
          <p className="decision-log-text">
            {decision.text}
            {replacedBy && (
              <span className="sr-only"> ({t("이후 바뀐 결정")})</span>
            )}
          </p>
          {decision.reason && (
            <p className="decision-log-reason">
              {t("이유: {reason}", { reason: decision.reason })}
            </p>
          )}
          {replaces && (
            <p className="decision-log-link">
              {t("이전 결정: {text}", { text: replaces.text })}
            </p>
          )}
          {replacedBy && (
            <p className="decision-log-link">
              {t("이후 바뀜: {text}", { text: replacedBy.text })}
            </p>
          )}
          <small>
            {meeting ? (
              <Link
                to={`/r/${researchId}/meetings/${meeting.id}?tab=questions`}
              >
                {meeting.title}
                {meeting.date && (
                  <>
                    {" · "}
                    <time dateTime={meeting.date}>
                      {formatDate(meeting.date)}
                    </time>
                  </>
                )}
              </Link>
            ) : (
              <time dateTime={decision.createdAt}>
                {formatDate(kstDateKey(decision.createdAt))}
              </time>
            )}
          </small>
        </li>
      ))}
    </ol>
  );
}
