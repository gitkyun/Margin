import type { BotAvatarState } from "bot-avatars";
import { useThemeControl } from "@montage-ui/core";
import { useOptionalWorkspace } from "@/lib/workspace";
import {
  DEFAULT_BOT_TYPE,
  readAgentProfile,
  type BotType,
} from "@/lib/research-agent";
import { BOT_LOOKS } from "./bot-looks";
import { BotFigure } from "./BotFigure";

/**
 * 마진의 연구 도우미 얼굴. libraries.dev Bot avatars(`bot-avatars`, MIT)를 씁니다.
 * 모양은 계정 설정 › AI의 '나만의 연구 도우미'에서 고르고(기본: 마진이), 모양별 재질·색은 bot-looks.ts에 있어요.
 * 꾸밈용이라 옆 글자가 실제 상태를 알려 줍니다(aria-hidden). 동작 줄이기면 라이브러리가 멈춘 자세로 그려요.
 */

/** 화면이 말하는 도우미 상태. 라이브러리 상태 세 가지(대기·작업 중·자는 중)로 옮겨 그려요. */
export type AssistantState =
  | "idle"
  | "ready"
  | "question"
  | "rest"
  | "working"
  | "thinking"
  | "searching"
  | "idea"
  | "chatting"
  | "processing"
  | "analyzing"
  | "writing"
  | "completed"
  | "happy"
  | "approved"
  | "attention";

const WORKING: ReadonlySet<AssistantState> = new Set([
  "working",
  "thinking",
  "searching",
  "processing",
  "analyzing",
  "writing",
]);

export function botState(
  state: AssistantState,
  active = false,
): BotAvatarState {
  if (active || WORKING.has(state)) return "working";
  if (state === "rest") return "sleeping";
  return "default";
}

export interface MarginBotProps {
  type?: BotType;
  state?: AssistantState;
  /** true면 일하는 중(깡충 뛰며 웃는 얼굴) */
  active?: boolean;
  size?: number;
  className?: string;
  /** 고르기 목록처럼 여럿이 함께 있을 때 멈춰 두기 */
  paused?: boolean;
  /** 눌러서 점프하거나 마우스를 따라보게 할지 */
  interactive?: boolean;
}

/** 모양을 직접 정해 그리는 봇(설정 미리보기·고르기 목록) */
export function MarginBot({
  type = DEFAULT_BOT_TYPE,
  state = "idle",
  active = false,
  size = 40,
  className = "",
  paused = false,
  interactive = false,
}: MarginBotProps) {
  const { theme } = useThemeControl();
  return (
    <BotFigure
      look={BOT_LOOKS[type]}
      state={botState(state, active)}
      size={size}
      paused={paused}
      interactive={interactive}
      theme={theme === "dark" ? "dark" : "light"}
      className={className}
    />
  );
}

/** 로그인한 사람이 고른 도우미(없으면 기본 봇). 워크스페이스 밖(공개 화면)에서는 기본 봇이에요. */
export function useAgentBotType(): BotType {
  const workspace = useOptionalWorkspace();
  return readAgentProfile(workspace?.user.preferences).botType;
}

/**
 * 연구 도우미 화면 전용 얼굴(대화·생각 중 표시). AI 패널·소개 화면은 이미지 마스코트(Brand.tsx)를 써요.
 * `state`가 일하는 상태이거나 `active`면 깡충 뛰고, 쉬는 상태면 졸아요.
 */
export function AssistantFace({
  state = "idle",
  size = 40,
  active = false,
  className = "",
}: {
  state?: AssistantState;
  size?: number;
  active?: boolean;
  /** 예전 이미지 마스코트용 값. 캔버스 봇은 바로 그려서 쓰지 않아요. */
  eager?: boolean;
  className?: string;
}) {
  const type = useAgentBotType();
  return (
    <MarginBot
      type={type}
      state={state}
      active={active}
      size={size}
      className={className}
    />
  );
}
