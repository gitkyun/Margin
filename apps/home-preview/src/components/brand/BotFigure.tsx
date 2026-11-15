import {
  BotAvatar as LibraryBot,
  type BotAvatarProps,
  type BotAvatarState,
} from "bot-avatars";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BOT_MOTION, type BotLook } from "./bot-looks";
import { useBotFinish, type BotFinish } from "./bot-finish";
import "./bot-avatar.css";

/** 캔버스는 CSS 변수를 못 읽으므로 지금 테마에서 계산된 색 값으로 바꿔요. */
function useTokenValue(name: string | undefined, theme: string) {
  const [value, setValue] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!name) {
      setValue(undefined);
      return;
    }
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    setValue(raw || undefined);
  }, [name, theme]);
  return value;
}

export interface BotFigureProps {
  look: BotLook;
  /** 봇 조절실에서 생김새를 덮어써 볼 때만 써요. */
  overrides?: Partial<BotAvatarProps>;
  finish?: BotFinish;
  state: BotAvatarState;
  size: number;
  paused?: boolean;
  interactive?: boolean;
  theme: "light" | "dark";
  className?: string;
}

/**
 * 생김새(BotLook) 하나를 그리는 바탕 부품. 앱은 MarginBot(BotAvatar.tsx)으로, 봇 조절실은 이 부품을 바로 써요.
 * 꾸밈용이라 aria-hidden이에요.
 */
export function BotFigure({
  look,
  overrides,
  finish = look.finish,
  state,
  size,
  paused = false,
  interactive = false,
  theme,
  className = "",
}: BotFigureProps) {
  const color = useTokenValue(look.colorToken, theme);
  const ink = useTokenValue(look.inkToken, theme);
  const body = useRef<HTMLSpanElement>(null);
  const finishCanvas = useRef<HTMLCanvasElement>(null);
  const finished = useBotFinish(body, finishCanvas, finish, !paused, theme);
  // 브랜드 색을 계산하기 전 한 프레임 동안 라이브러리 기본색이 비치지 않게 기다려요.
  const ready = !look.colorToken || !!color;
  const shift: CSSProperties | undefined = look.offset && {
    transform: `translate(${look.offset.x}%, ${look.offset.y}%)`,
  };
  return (
    <span
      className={`margin-bot ${finished ? "is-finished" : ""} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span ref={body} className="margin-bot-body" style={shift}>
        {ready && (
          <LibraryBot
            {...BOT_MOTION}
            {...look.props}
            {...overrides}
            type={look.base}
            path={look.path}
            color={color}
            ink={ink}
            state={state}
            size={size}
            paused={paused}
            interactive={interactive}
            theme={theme}
          />
        )}
        {finish && <canvas ref={finishCanvas} className="bot-finish" />}
      </span>
    </span>
  );
}
