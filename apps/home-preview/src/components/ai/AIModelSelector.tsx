import KokonutModelSelector from "@/components/kokonut/ai-model-selector";
import {
  isAIModelAvailable,
  DEFAULT_THINKING,
  resolveAISelection,
  type AIModelCapability,
} from "@/lib/ai-capabilities";
import {
  researchModelLabel,
  reviewDepthHints,
  reviewDepthOptions,
} from "@/lib/assistant-presentation";
import { t } from "@/lib/i18n";

/** Kokonut 원본 선택기. 서버 모델/깊이만 연결하며 원본 트랙·메뉴·모션을 유지합니다. */
export function AIModelSelector({
  models,
  model,
  thinking,
  onChange,
  disabled = false,
  loading = false,
  failed = false,
  compact = false,
  placement,
}: {
  models: AIModelCapability[];
  model?: string;
  thinking?: string;
  onChange: (selection: { model: string; thinking: string }) => void;
  disabled?: boolean;
  loading?: boolean;
  failed?: boolean;
  compact?: boolean;
  /** 목록을 여는 방향(Kokonut 원본은 위). 설정 창처럼 위쪽에 놓이면 "bottom" */
  placement?: "top" | "bottom";
}) {
  const status = loading
    ? t("모델 불러오는 중")
    : failed
      ? t("모델을 불러오지 못했어요")
      : t("선택 가능한 모델이 없어요");
  if (!models.length)
    return (
      <button
        type="button"
        disabled
        className="flex h-11 items-center rounded-xl bg-[var(--surface-muted)] px-3 text-xs text-[var(--text-tertiary)]"
        aria-label={t("AI 모델 · {model}", { model: status })}
      >
        {status}
      </button>
    );
  const selection = resolveAISelection(models, { model, thinking });
  return (
    <KokonutModelSelector
      placement={placement}
      className={compact ? "kokonut-model-selector-compact" : undefined}
      models={models.map((item) => ({
        id: item.id,
        name: researchModelLabel(item),
        description: item.description ? t(item.description) : undefined,
        efforts: reviewDepthOptions(item.thinking ?? []).map((option) => ({
          id: option.value,
          label: option.label,
          hint: reviewDepthHints[option.value],
        })),
        defaultEffort: item.thinking?.includes(DEFAULT_THINKING)
          ? DEFAULT_THINKING
          : item.thinking?.[0],
        disabled: !isAIModelAvailable(item),
      }))}
      value={{
        model: selection.model ?? models[0].id,
        effort: selection.thinking ?? "",
      }}
      disabled={disabled || loading || failed}
      onChange={(next) => {
        const selected = models.find(
          (candidate) => candidate.id === next.model,
        );
        if (
          disabled ||
          loading ||
          failed ||
          !selected ||
          !isAIModelAvailable(selected)
        )
          return;
        const resolved = resolveAISelection(models, {
          model: next.model,
          thinking: next.effort,
        });
        if (resolved.model)
          onChange({
            model: resolved.model,
            thinking: resolved.thinking ?? "",
          });
      }}
    />
  );
}
