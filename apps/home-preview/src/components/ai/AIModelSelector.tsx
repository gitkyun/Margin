import { useId, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icons";
import { Choice } from "@/components/experience";
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
import "./ai-controls.css";

/** Kokonut AI Model Selector / AI Input Selector: searchable models, separate effort. */
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = models.find((item) => item.id === model);
  const recommended = models.find(
    (item) => item.recommended && isAIModelAvailable(item),
  );
  const matching = models.filter((item) =>
    `${item.label} ${item.id} ${item.description ?? ""} ${t(item.description ?? "")} ${item.provider ?? ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const label = selected
    ? researchModelLabel(selected)
    : loading
      ? t("모델 불러오는 중")
      : failed
        ? t("모델을 불러오지 못했어요")
        : t("선택 가능한 모델이 없어요");
  function choose(item: AIModelCapability) {
    if (disabled || failed || !isAIModelAvailable(item)) return;
    const selection = resolveAISelection(models, { model: item.id, thinking });
    if (!selection.model) return;
    onChange({ model: selection.model, thinking: selection.thinking ?? "" });
    setOpen(false);
    setSearch("");
  }
  return (
    <div className={`ai-model-controls${compact ? " is-compact" : ""}`}>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="ai-model-trigger"
            disabled={disabled || loading || !models.length}
            aria-label={t("AI 모델 · {model}", { model: label })}
          >
            <Icon name="sparkles" size={16} />
            <span>{label}</span>
            {selected?.recommended && <small>{t("추천")}</small>}
            <Icon name="chevron-down" size={14} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="ai-model-popover"
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={16}
            aria-labelledby={titleId}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              searchRef.current?.focus();
            }}
          >
            <div className="ai-model-menu-heading">
              <strong id={titleId}>{t("AI 모델")}</strong>
              <Popover.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("닫기")}
                >
                  <Icon name="close" size={16} />
                </Button>
              </Popover.Close>
            </div>
            <Input
              ref={searchRef}
              fieldSize="medium"
              aria-label={t("모델 검색")}
              placeholder={t("이름·제공사·설명으로 검색")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const first = matching.find(isAIModelAvailable);
                  if (first) choose(first);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  event.currentTarget
                    .closest(".ai-model-popover")
                    ?.querySelector<HTMLButtonElement>(
                      ".ai-model-option:not(:disabled)",
                    )
                    ?.focus();
                }
              }}
            />
            <div
              className="ai-model-options"
              role="group"
              aria-label={t("AI 모델")}
              onKeyDown={(event) => {
                if (
                  !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                )
                  return;
                const buttons = [
                  ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                ];
                if (!buttons.length) return;
                event.preventDefault();
                const index = buttons.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                buttons[
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? buttons.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          buttons.length) %
                        buttons.length
                ]?.focus();
              }}
            >
              {matching.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ai-model-option"
                  aria-pressed={item.id === model}
                  disabled={disabled || failed || !isAIModelAvailable(item)}
                  onClick={() => choose(item)}
                >
                  <span>
                    <strong>{researchModelLabel(item)}</strong>
                    {item.recommended && (
                      <small className="ai-model-recommendation">
                        {t("추천")}
                      </small>
                    )}
                    {item.provider && <small>{item.provider}</small>}
                  </span>
                  {item.description && <small>{t(item.description)}</small>}
                  {!isAIModelAvailable(item) && (
                    <small>
                      {typeof item.availability === "string" &&
                      item.availability !== "available"
                        ? t(item.availability)
                        : t("연결 확인 전에는 선택할 수 없어요.")}
                    </small>
                  )}
                  {item.id === model && <Icon name="check" size={16} />}
                </button>
              ))}
              {!matching.length && (
                <p role="status">{t("검색한 모델이 없어요.")}</p>
              )}
            </div>
            <p className="ai-model-note">
              {t("모델과 답변 깊이에 따라 시간과 크레딧 사용량이 달라져요.")}
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {!!selected?.thinking.length && (
        <Choice
          compact
          label={t("답변 깊이")}
          value={thinking ?? ""}
          disabled={disabled || failed || !isAIModelAvailable(selected)}
          options={reviewDepthOptions(selected.thinking)}
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
      {recommended && recommended.id !== model && !disabled && !failed && (
        <button
          type="button"
          className="ai-model-quick-pick"
          onClick={() => choose(recommended)}
        >
          {t("추천 모델로 선택 · {model}", {
            model: researchModelLabel(recommended),
          })}
        </button>
      )}
    </div>
  );
}
