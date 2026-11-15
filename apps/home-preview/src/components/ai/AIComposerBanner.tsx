import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { formatCredits, runCreditUsage, useAIUsage } from "@/lib/ai-usage";
import { t } from "@/lib/i18n";
import "./ai-controls.css";

/**
 * 입력창 위 회색 띠(Kokonut AI Prompt 패턴). 내 잔액과 방금 요청의 실제 사용량을 한 줄로 보여 주고,
 * 추천 모델이 아닐 때는 바로 바꾸는 버튼을, 아니면 사용 내역 링크를 둡니다.
 */
export function AIComposerBanner({
  runId,
  usedCredits,
  usageHref,
  recommendedLabel,
  onPickRecommended,
}: {
  /** 방금 보낸 요청의 실행 번호 */
  runId?: string;
  /** 서버 응답이 알려 준 이번 요청 사용량(원장보다 먼저 도착해요) */
  usedCredits?: number;
  usageHref: string;
  /** 지금 모델이 추천이 아닐 때만 추천 모델 이름 */
  recommendedLabel?: string;
  onPickRecommended?: () => void;
}) {
  const usage = useAIUsage();
  const credits = usage.isError ? undefined : usage.data?.credits;
  const used = runId
    ? (runCreditUsage(credits, runId) ?? usedCredits)
    : undefined;
  return (
    <div className="ai-composer-banner" role="status">
      <Icon name="sparkles" size={18} className="ai-composer-banner-icon" />
      <p>
        {used !== undefined && (
          <>
            <span>
              {t("이번 요청 실제 사용 · {credits}크레딧", {
                credits: formatCredits(used),
              })}
            </span>
            <i aria-hidden="true">·</i>
          </>
        )}
        <span>
          {credits
            ? t("내 잔액 · {credits}크레딧", {
                credits: formatCredits(credits.balance),
              })
            : usage.isError
              ? t("크레딧 정보를 불러오지 못했어요.")
              : usage.isPending
                ? t("크레딧 불러오는 중")
                : t("크레딧 정보는 서버 연결 후 표시돼요.")}
        </span>
      </p>
      {usage.isError ? (
        <button type="button" onClick={() => void usage.refetch()}>
          {t("다시 불러오기")}
        </button>
      ) : recommendedLabel && onPickRecommended ? (
        <button
          type="button"
          title={recommendedLabel}
          onClick={onPickRecommended}
        >
          {t("추천 모델로 바꾸기")}
        </button>
      ) : (
        <Link to={usageHref}>{t("사용 내역")}</Link>
      )}
    </div>
  );
}
