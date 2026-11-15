import { Icon } from "@/components/icons";
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
import { ChipSelect, type ChipOption } from "./ChipSelect";
import { DepthBars } from "./DepthBars";
import "./ai-controls.css";

/** 제공사 이름을 화면용으로 다듬어요(서버는 소문자 식별자를 보내요). */
function providerLabel(provider?: string) {
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "";
}

/**
 * AI 모델·답변 깊이 선택(Kokonut AI Model Selector 패턴). 두 칩으로 나뉘고,
 * 목록 접근성은 Base UI Select가 맡아요. 서버가 허용한 모델만 고를 수 있어요.
 */
export function AIModelSelector({
  models,
  model,
  thinking,
  onChange,
  disabled = false,
  loading = false,
  failed = false,
  compact = false,
}: {
  models: AIModelCapability[];
  model?: string;
  thinking?: string;
  onChange: (selection: { model: string; thinking: string }) => void;
  disabled?: boolean;
  loading?: boolean;
  failed?: boolean;
  compact?: boolean;
}) {
  const selected = models.find((item) => item.id === model);
  const recommended = models.find(
    (item) => item.recommended && isAIModelAvailable(item),
  );
  const status = loading
    ? t("모델 불러오는 중")
    : failed
      ? t("모델을 불러오지 못했어요")
      : t("선택 가능한 모델이 없어요");
  const modelOptions: ChipOption[] = models.map((item) => ({
    value: item.id,
    label: researchModelLabel(item),
    description: [
      providerLabel(item.provider),
      item.description && t(item.description),
    ]
      .filter(Boolean)
      .join(" · "),
    badge: item.recommended ? t("추천") : undefined,
    disabled: !isAIModelAvailable(item),
    note: isAIModelAvailable(item)
      ? undefined
      : typeof item.availability === "string" &&
          item.availability !== "available"
        ? t(item.availability)
        : t("연결 확인 전에는 선택할 수 없어요."),
  }));
  function choose(id: string) {
    const item = models.find((candidate) => candidate.id === id);
    if (disabled || failed || !item || !isAIModelAvailable(item)) return;
    const selection = resolveAISelection(models, { model: id, thinking });
    if (!selection.model) return;
    onChange({ model: selection.model, thinking: selection.thinking ?? "" });
  }
  const depthOptions: ChipOption[] = reviewDepthOptions(
    selected?.thinking ?? [],
  ).map((option) => ({
    value: option.value,
    label: option.label,
    description: reviewDepthHints[option.value],
    leading: <DepthBars level={option.value} />,
  }));
  return (
    <div className={`ai-model-controls${compact ? " is-compact" : ""}`}>
      <ChipSelect
        className="ai-model-trigger"
        label={t("AI 모델")}
        value={model}
        options={modelOptions}
        placeholder={status}
        leading={
          <Icon name="sparkles" size={18} className="composer-chip-icon" />
        }
        disabled={disabled || loading || failed || !models.length}
        onChange={choose}
      />
      {!!selected?.thinking.length && (
        <ChipSelect
          className="ai-depth-trigger"
          label={t("답변 깊이")}
          value={thinking}
          options={depthOptions}
          leading={<DepthBars level={thinking} />}
          disabled={disabled || failed || !isAIModelAvailable(selected)}
          onChange={(value) =>
            onChange({ model: selected.id, thinking: value })
          }
        />
      )}
      {!compact && thinking && reviewDepthHints[thinking] && (
        <small className="ai-model-depth-hint">
          {reviewDepthHints[thinking]}
        </small>
      )}
      {!compact &&
        recommended &&
        recommended.id !== model &&
        !disabled &&
        !failed && (
          <button
            type="button"
            className="ai-model-quick-pick"
            onClick={() => choose(recommended.id)}
          >
            {t("추천 모델로 선택 · {model}", {
              model: researchModelLabel(recommended),
            })}
          </button>
        )}
    </div>
  );
}
