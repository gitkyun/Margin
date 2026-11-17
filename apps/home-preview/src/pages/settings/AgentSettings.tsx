import { t } from "@/lib/i18n";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segments } from "@/components/experience";
import { useDisabledReason } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import {
  AGENT_INSTRUCTIONS_MAX,
  AGENT_NAME_MAX,
  agentPreferencePatch,
  agentToneOptions,
  readAgentProfile,
  sameAgentProfile,
  type AgentProfile,
  type AgentTone,
} from "@/lib/research-agent";
import type { usePreferences } from "./use-preferences";
import "./account-settings.css";

/**
 * 계정 설정 › AI의 '나만의 연구 도우미' 1개 설정: 이름·개인 지침·말투.
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
          "연구 도우미가 답할 때 참고할 이름, 말투와 개인 지침을 정해요. 지침은 내 계정에만 저장되고 다른 사람에게 보이지 않아요.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && dirty) void save();
        }}
      >
        <label className="field" htmlFor={nameId}>
          <span className="field-label">
            {t("이름")}{" "}
            <small>{t("선택 · {max}자까지", { max: AGENT_NAME_MAX })}</small>
          </span>
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
          <span className="field-label">
            {t("개인 지침")} <small>{t("선택")}</small>
          </span>
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
          <small id={guideCountId} className="field-hint">
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
