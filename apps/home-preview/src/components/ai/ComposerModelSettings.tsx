import { ChipSelect } from "./ChipSelect";
import { DepthBars } from "./DepthBars";
import { ModelLogo } from "./ModelLogo";
import {
  isAIModelAvailable,
  resolveAISelection,
  type AIModelCapability,
} from "@/lib/ai-capabilities";
import {
  researchModelLabel,
  reviewDepthHints,
  reviewDepthOptions,
} from "@/lib/assistant-presentation";
import { t } from "@/lib/i18n";

/** 사용자 요청으로 연구 도우미 입력창은 이전의 두 선택 칩을 유지합니다. */
export function ComposerModelSettings({
  models,
  model,
  thinking,
  onChange,
  loading,
  failed,
  disabled,
}: {
  models: AIModelCapability[];
  model?: string;
  thinking?: string;
  onChange: (value: { model: string; thinking: string }) => void;
  loading?: boolean;
  failed?: boolean;
  disabled?: boolean;
}) {
  const selection = resolveAISelection(models, { model, thinking });
  const selected = models.find((item) => item.id === selection.model);
  const status = loading
    ? t("모델 불러오는 중")
    : failed
      ? t("모델을 불러오지 못했어요")
      : t("선택 가능한 모델이 없어요");
  return (
    <div className="ai-model-controls is-compact">
      <ChipSelect
        label={t("AI 모델")}
        className="ai-model-trigger"
        value={selection.model}
        placeholder={status}
        disabled={disabled || loading || failed || !selected}
        options={models.map((item) => ({
          value: item.id,
          label: researchModelLabel(item),
          description: item.description ? t(item.description) : undefined,
          leading: <ModelLogo provider={item.provider} />,
          badge: item.recommended ? t("추천") : undefined,
          disabled: !isAIModelAvailable(item),
        }))}
        onChange={(id) => {
          const next = resolveAISelection(models, {
            model: id,
            thinking: selection.thinking,
          });
          if (!disabled && next.model)
            onChange({ model: next.model, thinking: next.thinking ?? "" });
        }}
      />
      {!!selected?.thinking.length && (
        <ChipSelect
          label={t("답변 깊이")}
          className="ai-depth-trigger"
          value={selection.thinking}
          disabled={disabled || loading || failed}
          leading={<DepthBars level={selection.thinking} />}
          options={reviewDepthOptions(selected.thinking).map((option) => ({
            ...option,
            description: reviewDepthHints[option.value],
            leading: <DepthBars level={option.value} />,
          }))}
          onChange={(value) => {
            if (!disabled) onChange({ model: selected.id, thinking: value });
          }}
        />
      )}
    </div>
  );
}
