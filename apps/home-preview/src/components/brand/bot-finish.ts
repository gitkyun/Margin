import { useEffect, useState, type RefObject } from "react";
import { BOT_AVATAR_OVERSCAN } from "bot-avatars";

/**
 * 봇 마감 칠(마진이 전용으로 시작). 라이브러리가 그린 캔버스를 매 프레임 옆 캔버스에 옮겨 그리고,
 * 몸 모양 안쪽에만 ① 위에서 내려오는 물빛 그라데이션 ② 가장자리에서 안으로 번지는 흰 테두리 빛을 얹어
 * 기존 마진 마스코트의 '속이 비치는 듯한' 인상을 냅니다.
 * 실제로 뒤를 비추거나 굴절시키지 않아요(로그인 후 유리·굴절 효과 금지, AGENTS.md). 그림 안의 칠일 뿐이에요.
 */
export interface BotFinish {
  /** 흰 테두리 빛 세기 0–1 */
  glow: number;
  /** 빛이 안쪽으로 번지는 폭(몸 상자 100 기준) */
  glowWidth: number;
  /** 빛 색 토큰(CSS 변수 이름) */
  glowToken: string;
  /** 위쪽 물빛 세기 0–1 */
  tint: number;
  /** 물빛 색 토큰(CSS 변수 이름) */
  tintToken: string;
}

/** 라이브러리 캔버스는 몸 상자의 1.5배로 그려져요(몸 상자 100 = 캔버스 150). */
const CANVAS_UNITS = 100 * BOT_AVATAR_OVERSCAN;
/**
 * 멈춘 봇(고르기 목록·동작 줄이기)은 1초에 4번만 옮겨 그려요. 라이브러리가 화면에 들어온 뒤
 * 그림을 여러 번에 나눠 완성하므로, 몇 프레임만 그리고 멈추면 덜 그린 순간이 남아요.
 */
const STILL_INTERVAL_MS = 250;

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function paint(
  ctx: CanvasRenderingContext2D,
  glowCtx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  finish: BotFinish,
  colors: { glow: string; tint: string },
) {
  const { width, height } = source;
  const glowCanvas = glowCtx.canvas;
  if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
    ctx.canvas.width = glowCanvas.width = width;
    ctx.canvas.height = glowCanvas.height = height;
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);

  // ① 위쪽 물빛: 몸 위쪽에서 가운데까지 옅어지는 색. 몸 안에만(source-atop) 칠해요.
  if (finish.tint > 0) {
    const gradient = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.7);
    gradient.addColorStop(0, colors.tint);
    gradient.addColorStop(1, "transparent");
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = finish.tint;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // ② 흰 테두리 빛: 빛 색으로 채운 판에서 흐리게 한 몸을 파내면 가장자리 안쪽만 남아요.
  if (finish.glow > 0) {
    const blur = (finish.glowWidth * width) / CANVAS_UNITS;
    glowCtx.globalCompositeOperation = "source-over";
    glowCtx.filter = "none";
    glowCtx.clearRect(0, 0, width, height);
    glowCtx.fillStyle = colors.glow;
    glowCtx.fillRect(0, 0, width, height);
    glowCtx.globalCompositeOperation = "destination-out";
    glowCtx.filter = `blur(${blur}px)`;
    glowCtx.drawImage(source, 0, 0);
    glowCtx.filter = "none";
    glowCtx.globalCompositeOperation = "destination-in";
    glowCtx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = finish.glow;
    ctx.drawImage(glowCanvas, 0, 0);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/**
 * `body` 안의 라이브러리 캔버스를 `out`에 마감 칠과 함께 옮겨 그려요.
 * 돌려주는 값이 true일 때만 원래 캔버스를 숨겨요(캔버스 필터를 못 쓰는 브라우저는 원래 그림 그대로).
 */
export function useBotFinish(
  body: RefObject<HTMLElement | null>,
  out: RefObject<HTMLCanvasElement | null>,
  finish: BotFinish | undefined,
  animate: boolean,
  theme: string,
): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = body.current;
    // 테스트(jsdom)처럼 캔버스·관찰자가 없는 환경에서는 원래 그림을 그대로 둬요.
    if (
      !finish ||
      typeof IntersectionObserver === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      setReady(false);
      return;
    }
    const ctx = out.current?.getContext("2d");
    const glowCtx = document.createElement("canvas").getContext("2d");
    if (!host || !ctx || !glowCtx || !("filter" in ctx)) {
      setReady(false);
      return;
    }
    const colors = {
      glow: token(finish.glowToken, "white"),
      tint: token(finish.tintToken, "transparent"),
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let timer = 0;
    let painted = false;
    let visible = true;
    const tick = () => {
      frame = 0;
      timer = 0;
      const source = host.querySelector<HTMLCanvasElement>(
        "canvas:not(.bot-finish)",
      );
      if (source && source.width > 0) {
        paint(ctx, glowCtx, source, finish, colors);
        if (!painted) setReady(true);
        painted = true;
      }
      if (!visible || document.hidden) return;
      if (animate && !reduce.matches) frame = requestAnimationFrame(tick);
      else timer = window.setTimeout(tick, STILL_INTERVAL_MS);
    };
    const start = () => {
      if (!frame && !timer) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
    });
    observer.observe(host);
    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [body, out, finish, animate, theme]);
  return ready;
}
