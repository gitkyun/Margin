import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { formatCredits, runCreditUsage, useAIUsage } from "@/lib/ai-usage";
import { t } from "@/lib/i18n";
import { ModelLogo } from "./ModelLogo";
import "./ai-controls.css";
import { PromoHeader } from "@/components/kokonut/ai-prompt";

export interface ComposerPromo {
  /** 권하는 모델 이름 */
  label: string;
  /** 서버가 알려 준 그 모델의 한 줄 설명 */
  note?: string;
  provider?: string;
}

export interface ComposerBannerCommand {
  label: string;
  description: string;
  icon: string;
  onChangeCommand: () => void;
}

/**
 * 입력창 위 한 줄 띠(Kokonut AI Input Selector / AI Input Search의 머리 줄).
 * 요청 종류를 골랐으면 그 설명과 '바꾸기 /'를, 고르지 않았으면 추천 모델 '써 보기'나 내 잔액을 보여 줘요.
 */
export function AIComposerBanner({
  runId,
  usedCredits,
  usageHref,
  provider,
  promo,
  command,
  onTryPromo,
}: {
  /** 방금 보낸 요청의 실행 번호 */
  runId?: string;
  /** 서버 응답이 알려 준 이번 요청 사용량(원장보다 먼저 도착해요) */
  usedCredits?: number;
  usageHref: string;
  /** 지금 고른 모델의 제공사(로고용) */
  provider?: string;
  /** 지금 모델이 추천이 아닐 때만 */
  promo?: ComposerPromo;
  /** `/` 명령으로 고른 요청 종류 */
  command?: ComposerBannerCommand;
  onTryPromo?: () => void;
}) {
  const usage = useAIUsage();
  const credits = usage.isError ? undefined : usage.data?.credits;
  const used = runId
    ? (runCreditUsage(credits, runId) ?? usedCredits)
    : undefined;
  const navigate = useNavigate();
  const balance = credits
    ? t("내 잔액 · {credits}크레딧", {
        credits: formatCredits(credits.balance),
      })
    : usage.isError
      ? t("크레딧 정보를 불러오지 못했어요.")
      : usage.isPending
        ? t("크레딧 불러오는 중")
        : t("크레딧 정보는 서버 연결 후 표시돼요.");
  return promo ? (
    <PromoHeader
      model={promo.label}
      text={`${t("추천")} · ${promo.label}${promo.note ? " · " + promo.note : ""}`}
      action={t("시도하기")}
      canSwitch={!!onTryPromo}
      inUse={false}
      onAction={() => onTryPromo?.()}
    />
  ) : null;
}

export function AIComposerUsage({
  runId,
  usedCredits,
}: {
  runId?: string;
  usedCredits?: number;
}) {
  const usage = useAIUsage();
  const navigate = useNavigate();
  const credits = usage.data?.credits;
  const used = runId
    ? (runCreditUsage(credits, runId) ?? usedCredits)
    : undefined;
  return (
    <div className="composer-usage-footer" aria-live="polite">
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
        {used !== undefined && (
          <span className="composer-request-usage">
            {t("이번 요청 실제 사용 · {credits}크레딧", {
              credits: formatCredits(used),
            })}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() =>
          usage.isError ? void usage.refetch() : navigate("/account?tab=usage")
        }
      >
        {usage.isError ? t("다시 불러오기") : t("사용 내역")}
      </button>
    </div>
  );
}
