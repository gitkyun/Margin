import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import type { AICandidate } from "@/lib/domain";

interface SmartSuggestionCardProps {
  number: number;
  candidate: AICandidate;
  /** 제안이 기댄 원문 인용. 원문에서 확인되지 않으면 null(피드백 전체가 근거) */
  sourceQuote: string | null;
  adopted: boolean;
  saving: boolean;
  /** 원문이 바뀌었거나 다른 제안을 저장하는 중이면 고를 수 없어요. */
  blocked: boolean;
  blockedReasonId?: string;
  onAdopt(): void;
  onEdit(): void;
  onDismiss(): void;
}

/**
 * 스마트 제안 카드: 근거(원문) · 제안 내용 · 확인이 필요한 가정을 나눠 보여 주고,
 * [이 방법 선택] [고쳐서 쓰기] [닫기]만 둡니다(용어표: ‘채택’ 대신 ‘선택’).
 * 선택하거나 고쳐서 저장해야만 기록에 남아요.
 */
export function SmartSuggestionCard({
  number,
  candidate,
  sourceQuote,
  adopted,
  saving,
  blocked,
  blockedReasonId,
  onAdopt,
  onEdit,
  onDismiss,
}: SmartSuggestionCardProps) {
  const method = candidate.method ?? candidate.body ?? "";
  return (
    <article
      className={`smart-suggestion ${adopted ? "is-adopted" : ""}`}
      aria-label={t("AI 제안 {number}", { number })}
    >
      <header className="smart-suggestion-head">
        <span className="smart-suggestion-badge">
          <Icon name="sparkles" size={13} />
          {t("AI 제안 {number}", { number })}
        </span>
        {adopted ? (
          <span className="smart-suggestion-state">
            <Icon name="check" size={13} />
            {t("선택함")}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("AI 제안 {number} 닫기", { number })}
            disabled={saving}
            onClick={onDismiss}
          >
            <Icon name="close" size={14} />
          </Button>
        )}
      </header>
      <h4>{candidate.title}</h4>
      <div className="smart-suggestion-source">
        <small>{t("제안 근거 · 원문")}</small>
        {sourceQuote ? (
          <blockquote>{sourceQuote}</blockquote>
        ) : (
          <p>{t("이 피드백의 내용 전체")}</p>
        )}
      </div>
      <div className="smart-suggestion-body">
        <small>{t("제안 내용 · AI")}</small>
        <p>{method}</p>
        {candidate.expectedResult && (
          <dl>
            <dt>{t("예상 결과")}</dt>
            <dd>{candidate.expectedResult}</dd>
          </dl>
        )}
        {candidate.requiredMaterials && (
          <dl>
            <dt>{t("필요한 자료·할 일")}</dt>
            <dd>{candidate.requiredMaterials}</dd>
          </dl>
        )}
      </div>
      {candidate.assumptions && (
        <div className="ai-assumption">
          <small>{t("확인이 필요한 가정")}</small>
          <p>{candidate.assumptions}</p>
        </div>
      )}
      {!adopted && (
        <footer className="smart-suggestion-actions">
          <Button
            size="sm"
            disabled={
              blocked || saving || !candidate.title.trim() || !method.trim()
            }
            aria-describedby={blocked ? blockedReasonId : undefined}
            onClick={onAdopt}
          >
            {saving ? t("저장 중") : t("이 방법 선택")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={blocked || saving}
            aria-describedby={blocked ? blockedReasonId : undefined}
            onClick={onEdit}
          >
            <Icon name="edit" size={14} />
            {t("고쳐서 쓰기")}
          </Button>
        </footer>
      )}
    </article>
  );
}
