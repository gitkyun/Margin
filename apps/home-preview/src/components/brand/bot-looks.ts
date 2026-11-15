import type { BotAvatarProps, BotAvatarType } from "bot-avatars";
import type { BotType } from "@/lib/research-agent";
import type { BotFinish } from "./bot-finish";
import { MARGIN_BOT_OFFSET, MARGIN_BOT_PATH } from "./margin-bot-path";

/**
 * 봇마다 생김새(2026-11-15 봇 조절실·재질 비교판에서 고른 값).
 * - 모두 같은 움직임(눈만 있는 얼굴, 12초마다 깡충)이라 한 가족처럼 보여요.
 * - 폭신한 모양은 털, 단단한 모양은 매끈한 재질. 플라스틱·선명 재질은 쓰지 않아요.
 * - 색은 모양마다 정해진 라이브러리 기본색. 마진이만 브랜드 파랑과 흰 눈이에요.
 */
export interface BotLook {
  /** 라이브러리 형태(얼굴 자리·기본색을 정함) */
  base: BotAvatarType;
  props: Partial<BotAvatarProps>;
  /** 직접 그린 몸 윤곽 */
  path?: string;
  /** 몸 색·눈 색 토큰(CSS 변수 이름). 캔버스는 CSS 변수를 못 읽어 계산된 값으로 넘겨요. */
  colorToken?: string;
  inkToken?: string;
  /** 몸 상자에 대한 백분율 이동(윤곽을 옮겨 그린 마진이를 가운데로) */
  offset?: { x: number; y: number };
  finish?: BotFinish;
}

/** 모든 봇이 같이 쓰는 얼굴·움직임 */
export const BOT_MOTION = {
  face: "eyes",
  roundness: 1,
  speed: 0.9,
  jumpEvery: 12,
  jumpHeight: 30,
  jumpSquash: 1.1,
} as const satisfies Partial<BotAvatarProps>;

/** 매끈: 탁하지 않게 채도와 광택을 올렸어요. */
const SMOOTH = {
  shading: "smooth",
  brightness: 1.08,
  shadow: 0.5,
  saturation: 1.9,
  highlight: 1.5,
} as const satisfies Partial<BotAvatarProps>;

/** 털: 작은 크기에서도 윤곽이 보이게 털을 조금 짧게, 은은한 광택. */
const PLUSH = {
  shading: "fabric",
  brightness: 1.12,
  shadow: 0.55,
  furLength: 0.75,
  furFuzz: 0.7,
  sheen: 0.6,
} as const satisfies Partial<BotAvatarProps>;

/**
 * 마진이: 기존 마스코트처럼 브랜드 파랑 몸에 흰 눈. 빛을 거의 정수리(358°)에서 받는 밝고 진한 매끈한 몸에,
 * 가장자리에만 얇은 흰 테두리 빛(2026-11-15 봇 조절실에서 사용자가 고른 값).
 */
const MARGIN: BotLook = {
  base: "square",
  path: MARGIN_BOT_PATH,
  offset: MARGIN_BOT_OFFSET,
  colorToken: "--atomic-blue-50",
  inkToken: "--atomic-common-100",
  props: {
    shading: "smooth",
    brightness: 1.5,
    saturation: 1.96,
    shadow: 0.55,
    highlight: 2,
    spread: 1.32,
    depth: 1,
    light: 358,
  },
  finish: {
    glow: 0.85,
    glowWidth: 2,
    glowToken: "--atomic-common-100",
    tint: 0,
    tintToken: "--atomic-cyan-50",
  },
};

export const BOT_LOOKS: Record<BotType, BotLook> = {
  margin: MARGIN,
  clover: { base: "clover", props: PLUSH },
  flower: { base: "flower", props: PLUSH },
  star: { base: "star", props: PLUSH },
  ghost: { base: "ghost", props: SMOOTH },
  circle: { base: "circle", props: PLUSH },
  hexagon: { base: "hexagon", props: SMOOTH },
  square: { base: "square", props: SMOOTH },
  triangle: { base: "triangle", props: SMOOTH },
  blob: { base: "blob", props: SMOOTH },
  cloud: { base: "cloud", props: PLUSH },
  puddle: { base: "puddle", props: SMOOTH },
};
