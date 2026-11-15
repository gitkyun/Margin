import { t } from "@/lib/i18n";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segments } from "@/components/experience";
import { useDisabledReason } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import { MarginBot, type AssistantState } from "@/components/brand/BotAvatar";
import {
  BOT_TYPES,
  AGENT_INSTRUCTIONS_MAX,
  AGENT_NAME_MAX,
  agentPreferencePatch,
  agentToneOptions,
  readAgentProfile,
  sameAgentProfile,
  type BotType,
  type AgentProfile,
  type AgentTone,
} from "@/lib/research-agent";
import type { usePreferences } from "./use-preferences";
import "./account-settings.css";

/** 봇 이름. 모양에서 떠오르는 느낌을 '-이' 별명으로 맞췄어요(마진이는 서비스 마스코트). */
const BOT_TYPE_NAMES: Record<BotType, string> = {
  margin: t("마진이"),
  clover: t("네잎이"),
  flower: t("꽃송이"),
  star: t("반짝이"),
  ghost: t("깜짝이"),
  circle: t("동글이"),
  hexagon: t("또각이"),
  square: t("반듯이"),
  triangle: t("뾰족이"),
  blob: t("말랑이"),
  cloud: t("몽실이"),
  puddle: t("찰랑이"),
};

const PREVIEW_STATES: { value: AssistantState; label: string }[] = [
  { value: "idle", label: t("대기") },
  { value: "thinking", label: t("생각 중") },
  { value: "rest", label: t("쉬는 중") },
];

/**
 * 계정 설정 › AI의 '나만의 연구 도우미' 1개 설정: 이름·개인 지침·말투·아바타.
 * 저장은 계정 메타데이터(preferences)에 하고, 서버는 그 값을 직접 읽어 지침 끝에 붙입니다.
 * 개인 지침은 제품 규칙(선택한 원문만 근거로 쓰기 등)보다 우선하지 않아요.
 */
export function AgentSettings({
  preferences,
}: {
  preferences: ReturnType<typeof usePreferences>;
}) {
  const { mode } = useWorkspace();
  const { prefs, setPrefs, persist, busy, loaded } = preferences;
  const saved = readAgentProfile(prefs);
  const [draft, setDraft] = useState<AgentProfile>(saved);
  const nameId = useId();
  const guideId = useId();
  const guideCountId = useId();
  const avatarLabelId = useId();
  const [previewState, setPreviewState] = useState<AssistantState>("idle");
  // 불러온 값으로 입력을 한 번 채웁니다.
  useEffect(() => {
    if (loaded) setDraft(readAgentProfile(prefs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  const dirty = !sameAgentProfile(
    readAgentProfile(agentPreferencePatch(draft)),
    saved,
  );
  const saveReason = useDisabledReason(
    !busy &&
      (mode === "preview"
        ? t("미리보기에서는 설정을 저장할 수 없어요.")
        : !loaded
          ? t("설정을 불러오는 중이에요.")
          : !dirty && t("바뀐 내용이 없어요.")),
  );
  const update = (patch: Partial<AgentProfile>) =>
    setDraft((current) => ({ ...current, ...patch }));

  async function save() {
    const patch = agentPreferencePatch(draft);
    if (!(await persist(patch))) {
      toast.error(t("도우미 설정을 저장하지 못했어요. 다시 시도해 주세요."));
      return;
    }
    setPrefs({ ...prefs, ...patch });
    setDraft(readAgentProfile(patch));
    toast.success(t("나만의 연구 도우미를 저장했어요."));
  }

  return (
    <section className="settings-section agent-settings">
      <h2>{t("나만의 연구 도우미")}</h2>
      <p>
        {t(
          "연구 도우미의 모양, 답할 때 참고할 말투와 개인 지침을 정해요. 고른 모습은 연구 도우미 화면에 보여요. 지침은 내 계정에만 저장되고 다른 사람에게 보이지 않아요.",
        )}
      </p>
      <div className="agent-preview">
        <MarginBot
          type={draft.botType}
          state={previewState}
          size={72}
          interactive
        />
        <span>
          <strong>{draft.name.trim() || t("연구 도우미")}</strong>
          <small>
            {BOT_TYPE_NAMES[draft.botType]} ·{" "}
            {agentToneOptions().find((o) => o.value === draft.tone)?.label}
          </small>
          <Segments
            label={t("움직임 미리 보기")}
            value={previewState}
            onChange={(value) => setPreviewState(value as AssistantState)}
            options={PREVIEW_STATES}
          />
        </span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && dirty) void save();
        }}
      >
        <div className="field">
          <span id={avatarLabelId}>{t("모양")}</span>
          <div
            className="agent-avatar-grid"
            role="radiogroup"
            aria-labelledby={avatarLabelId}
          >
            {BOT_TYPES.map((type) => (
              <label key={type} className="agent-avatar-option">
                <input
                  type="radio"
                  name="agent-bot-type"
                  className="sr-only"
                  checked={draft.botType === type}
                  onChange={() => update({ botType: type })}
                />
                {/* 12마리가 한꺼번에 움직이면 산만해서 고른 것만 움직여요. */}
                <MarginBot
                  type={type}
                  size={44}
                  paused={draft.botType !== type}
                />
                <small>{BOT_TYPE_NAMES[type]}</small>
              </label>
            ))}
          </div>
        </div>
        <label className="field" htmlFor={nameId}>
          {t("이름")}{" "}
          <small>{t("선택 · {max}자까지", { max: AGENT_NAME_MAX })}</small>
          <Input
            id={nameId}
            value={draft.name}
            maxLength={AGENT_NAME_MAX}
            onChange={(event) => update({ name: event.target.value })}
            placeholder={t("예: 콩이")}
          />
        </label>
        <div className="field">
          <span>{t("말투")}</span>
          <Segments
            label={t("말투")}
            value={draft.tone}
            onChange={(value) => update({ tone: value as AgentTone })}
            options={agentToneOptions()}
          />
        </div>
        <label className="field" htmlFor={guideId}>
          {t("개인 지침")} <small>{t("선택")}</small>
          <Textarea
            id={guideId}
            rows={5}
            value={draft.instructions}
            maxLength={AGENT_INSTRUCTIONS_MAX}
            aria-describedby={guideCountId}
            onChange={(event) => update({ instructions: event.target.value })}
            placeholder={t(
              "예: 질적 연구 용어로 설명해 주세요. 고칠 문장은 예시를 하나씩 보여 주세요.",
            )}
          />
          <small id={guideCountId}>
            {t("{count} / {max}자 · 제품 규칙보다 우선하지 않아요.", {
              count: draft.instructions.length,
              max: AGENT_INSTRUCTIONS_MAX,
            })}
          </small>
        </label>
        <div className="bottom-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !dirty}
            onClick={() => setDraft(saved)}
          >
            {t("취소")}
          </Button>
          <Button
            type="submit"
            disabled={busy || !dirty || !loaded}
            aria-describedby={saveReason.describedBy}
          >
            {busy ? t("저장 중") : t("저장")}
          </Button>
        </div>
        {saveReason.node}
      </form>
    </section>
  );
}
