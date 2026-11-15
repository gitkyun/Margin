import { t } from "./i18n";

/**
 * 나만의 연구 도우미 설정 1개(계정 설정 › AI). 계정 메타데이터 preferences에 평평한 키로 저장해요.
 * 서버(ai-assist)는 화면이 보낸 값이 아니라 계정 메타데이터에서 지침·말투를 직접 읽습니다
 * (supabase/functions/ai-assist/prompts.ts의 readPersonalGuide와 길이 규칙을 맞춰 둡니다).
 */
export const AGENT_NAME_MAX = 20;
export const AGENT_INSTRUCTIONS_MAX = 1000;

export const AGENT_TONES = [
  "default",
  "concise",
  "friendly",
  "formal",
] as const;
export type AgentTone = (typeof AGENT_TONES)[number];

/**
 * 연구 도우미 봇 모양 12종: 마진이(`margin`, 기존 마스코트 윤곽) + libraries.dev Bot avatars 형태 11종.
 * 라이브러리 형태는 값이 라이브러리 이름 그대로예요. 생김새는 components/brand/bot-looks.ts,
 * 화면 이름은 pages/settings/AgentSettings.tsx에 있어요.
 */
export const BOT_TYPES = [
  "margin",
  "clover",
  "flower",
  "star",
  "ghost",
  "circle",
  "hexagon",
  "square",
  "triangle",
  "blob",
  "cloud",
  "puddle",
] as const;
export type BotType = (typeof BOT_TYPES)[number];

/** 아무것도 고르지 않은 사람에게 보이는 마진 기본 도우미 */
export const DEFAULT_BOT_TYPE: BotType = "margin";

/** preferences 안의 키 이름 */
export const AGENT_KEYS = {
  name: "agentName",
  instructions: "agentInstructions",
  tone: "agentTone",
  botType: "agentBotType",
} as const;

export interface AgentProfile {
  name: string;
  instructions: string;
  tone: AgentTone;
  botType: BotType;
}

export function agentToneOptions(): { value: AgentTone; label: string }[] {
  return [
    { value: "default", label: t("기본") },
    { value: "concise", label: t("간결하게") },
    { value: "friendly", label: t("친절하게") },
    { value: "formal", label: t("격식 있게") },
  ];
}

// 줄바꿈(\n)과 탭은 남기고 나머지 제어 문자는 지웁니다.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

/** 제어 문자를 지우고 앞뒤 공백을 다듬은 뒤 최대 길이로 자릅니다. */
export function cleanAgentText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL, "").trim().slice(0, max);
}

/** 저장된 preferences에서 도우미 설정을 읽습니다. 모르는 값은 기본값으로 봐요. */
export function readAgentProfile(
  preferences: Record<string, unknown> | undefined,
): AgentProfile {
  const prefs = preferences ?? {};
  const tone = AGENT_TONES.find((value) => value === prefs[AGENT_KEYS.tone]);
  const botType =
    BOT_TYPES.find((value) => value === prefs[AGENT_KEYS.botType]) ??
    DEFAULT_BOT_TYPE;
  return {
    name: cleanAgentText(prefs[AGENT_KEYS.name], AGENT_NAME_MAX).replace(
      /\s+/g,
      " ",
    ),
    instructions: cleanAgentText(
      prefs[AGENT_KEYS.instructions],
      AGENT_INSTRUCTIONS_MAX,
    ),
    tone: tone ?? "default",
    botType,
  };
}

/** 저장할 preferences 조각. 빈 값도 빈 글자로 보내 이전 값을 지웁니다. */
export function agentPreferencePatch(
  profile: AgentProfile,
): Record<string, string> {
  const clean = readAgentProfile({
    [AGENT_KEYS.name]: profile.name,
    [AGENT_KEYS.instructions]: profile.instructions,
    [AGENT_KEYS.tone]: profile.tone,
    [AGENT_KEYS.botType]: profile.botType,
  });
  return {
    [AGENT_KEYS.name]: clean.name,
    [AGENT_KEYS.instructions]: clean.instructions,
    [AGENT_KEYS.tone]: clean.tone,
    [AGENT_KEYS.botType]: clean.botType,
  };
}

export function sameAgentProfile(a: AgentProfile, b: AgentProfile): boolean {
  return (
    a.name === b.name &&
    a.instructions === b.instructions &&
    a.tone === b.tone &&
    a.botType === b.botType
  );
}
