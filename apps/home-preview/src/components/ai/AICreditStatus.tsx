import { useAIUsage, formatCredits, runCreditUsage } from "@/lib/ai-usage";
import { t } from "@/lib/i18n";
import "./ai-controls.css";

export function AICreditStatus({ runId }: { runId?: string }) {
  const usage = useAIUsage();
  const credits = usage.isError ? undefined : usage.data?.credits;
  const actual = runId ? runCreditUsage(credits, runId) : undefined;
  return (
    <p className="ai-credit-status" role="status">
      {runId
        ? actual === undefined
          ? t("이번 요청의 실제 사용량은 정산 후 표시돼요.")
          : t("이번 요청 실제 사용 · {credits}크레딧", {
              credits: formatCredits(actual),
            })
        : credits
          ? t("내 잔액 · {credits}크레딧", {
              credits: formatCredits(credits.balance),
            })
          : usage.isError
            ? t("크레딧 정보를 불러오지 못했어요.")
            : t("크레딧 정보는 서버 연결 후 표시돼요.")}
      {!runId && <small>{t("실제 토큰 사용량으로 정산해요.")}</small>}
    </p>
  );
}
