import { t } from "@/lib/i18n";
import type { NextStep } from "@/lib/assistant-next";

/**
 * 답 아래 '이어서'(IA v2 06 §2.4). 요청 종류별로 정해 둔 칩이고, 누르면 입력창이 채워질 뿐 보내지 않습니다.
 * [글로 저장]은 저장 창을, [수정 제안 받기]는 열어 둔 글의 수정 제안 창을 엽니다.
 */
export function NextSteps({
  steps,
  disabled,
  onPick,
}: {
  steps: NextStep[];
  disabled?: boolean;
  onPick: (step: NextStep) => void;
}) {
  if (!steps.length) return null;
  return (
    <div className="assistant-next" role="group" aria-label={t("이어서")}>
      <span className="assistant-next-label" aria-hidden="true">
        {t("이어서")}
      </span>
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(step)}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}
