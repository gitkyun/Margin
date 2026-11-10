import { useLayoutEffect, useRef, type RefObject } from "react";

export interface ZoomInput {
  /** 틀 안쪽 크기 */
  frame: { width: number; height: number };
  /** 틀 안에서 그림(캔버스)이 놓인 자리 */
  canvas: { left: number; top: number };
  /** 그림 안에서 확대해 들어갈 컴포넌트의 자리 */
  target: { left: number; top: number; width: number; height: number };
  /** 전체 모습일 때의 배율. 이보다 작게는 줄이지 않습니다. */
  minScale?: number;
}

export interface ZoomTransform {
  x: number;
  y: number;
  scale: number;
}

const MAX_SCALE = 2.6;

/**
 * 전체 그림에서 한 컴포넌트로 확대해 들어가는 변환. 컴포넌트가 틀 가운데에 오고
 * 틀 폭의 78%, 높이의 60%를 넘지 않을 만큼만 키웁니다(틀 밖으로 넘치지 않게).
 */
export function zoomTransform({
  frame,
  canvas,
  target,
  minScale = 1,
}: ZoomInput): ZoomTransform {
  const fit = Math.min(
    (frame.width * 0.78) / Math.max(target.width, 1),
    (frame.height * 0.6) / Math.max(target.height, 1),
  );
  const scale = Math.max(minScale, Math.min(MAX_SCALE, fit));
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  return {
    x: frame.width / 2 - canvas.left - scale * centerX,
    y: frame.height / 2 - canvas.top - scale * centerY,
    scale,
  };
}

/**
 * 전체 모습의 변환. 그림이 틀보다 크면(좁은 화면의 위쪽 띠) 전체가 보이도록 줄여 가운데에 둡니다.
 */
export function restTransform(input: {
  frame: { width: number; height: number };
  canvas: { left: number; top: number; width: number; height: number };
}): ZoomTransform {
  const { frame, canvas } = input;
  const scale = Math.min(
    1,
    (frame.width - canvas.left * 2) / Math.max(canvas.width, 1),
    (frame.height - canvas.top * 2) / Math.max(canvas.height, 1),
  );
  return {
    x: (frame.width - scale * canvas.width) / 2 - canvas.left,
    y: (frame.height - scale * canvas.height) / 2 - canvas.top,
    scale,
  };
}

/** 변환과 상관없는 배치 좌표로 그림 안에서의 자리를 잽니다. */
function offsetWithin(element: HTMLElement, ancestor: HTMLElement) {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return {
    left,
    top,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}

function toCss({ x, y, scale }: ZoomTransform): string {
  if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(scale - 1) < 0.001)
    return "none";
  return `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
}

/** 전체로 물러나는 시간, 전체 모습에 머무는 시간, 천천히 확대해 들어가는 시간(ms) */
export const ZOOM_OUT_MS = 400;
export const ZOOM_HOLD_MS = 1000;
export const ZOOM_IN_MS = 1600;
const REFIT_MS = 300;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";

/**
 * 틀(frame) 안의 그림(`[data-zoom-canvas]`)을 전체 모습에서 `selector` 컴포넌트로 확대합니다.
 * - `zoomKey`가 바뀌면 전체로 물러나 1초 머문 뒤 새 자리로 천천히 들어갑니다.
 * - `refitKey`만 바뀌면(같은 컴포넌트의 내용·크기가 달라짐) 물러나지 않고 자리만 다시 맞춥니다.
 * - selector가 없으면 전체로 돌아옵니다.
 * 확대된 동안 그림에 `data-zoomed`가 붙어 나머지를 흐리게 하는 스타일이 걸립니다.
 */
export function useZoomInto(
  frameRef: RefObject<HTMLElement | null>,
  selector: string | undefined,
  zoomKey: string,
  options: { zoomedValue?: string; refitKey?: string } = {},
) {
  const { zoomedValue = "true", refitKey = "" } = options;
  const lastZoom = useRef<{ key: string | null; at: number }>({
    key: null,
    at: 0,
  });
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = frame?.querySelector<HTMLElement>("[data-zoom-canvas]");
    if (!frame || !canvas) return;
    let animation: Animation | undefined;
    let blurTimer: number | undefined;

    function apply(mode: "zoom" | "refit" | "instant") {
      if (!frame || !canvas || frame.clientWidth === 0) return;
      const frameSize = {
        width: frame.clientWidth,
        height: frame.clientHeight,
      };
      const place = { left: canvas.offsetLeft, top: canvas.offsetTop };
      const rest = restTransform({
        frame: frameSize,
        canvas: {
          ...place,
          width: canvas.offsetWidth,
          height: canvas.offsetHeight,
        },
      });
      const target = selector
        ? canvas.querySelector<HTMLElement>(selector)
        : null;
      const previous = canvas.style.transform || "none";
      const restCss = toCss(rest);
      const next = target
        ? toCss(
            zoomTransform({
              frame: frameSize,
              canvas: place,
              target: offsetWithin(target, canvas),
              minScale: rest.scale,
            }),
          )
        : restCss;
      canvas.style.transform = next;
      animation?.cancel();
      window.clearTimeout(blurTimer);
      const setZoomed = () => {
        if (target) canvas.dataset.zoomed = zoomedValue;
        else delete canvas.dataset.zoomed;
      };
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (
        mode === "instant" ||
        mode === "refit" ||
        reduced ||
        typeof canvas.animate !== "function"
      ) {
        setZoomed();
        if (mode === "refit" && !reduced && previous !== next)
          animation = canvas.animate?.(
            [{ transform: previous }, { transform: next }],
            { duration: REFIT_MS, easing: EASING },
          );
        return;
      }
      // 전체 화면으로 물러나 1초 동안 전체를 보여 준 뒤, 핵심 컴포넌트로 천천히 들어갑니다.
      // 나머지를 흐리게 하는 표시는 확대가 시작될 때 붙입니다.
      delete canvas.dataset.zoomed;
      const out = previous === restCss ? 0 : ZOOM_OUT_MS;
      const total = out + ZOOM_HOLD_MS + ZOOM_IN_MS;
      blurTimer = window.setTimeout(setZoomed, out + ZOOM_HOLD_MS);
      animation = canvas.animate(
        [
          { transform: previous, easing: EASING },
          { transform: restCss, offset: out / total },
          {
            transform: restCss,
            offset: (out + ZOOM_HOLD_MS) / total,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          },
          { transform: next },
        ],
        { duration: total },
      );
    }

    const first = lastZoom.current.key === null;
    const now = performance.now();
    // 개발 모드에서 효과가 곧바로 한 번 더 돌 때도 같은 확대의 시작으로 봅니다.
    const changed =
      lastZoom.current.key !== zoomKey || now - lastZoom.current.at < 50;
    if (lastZoom.current.key !== zoomKey)
      lastZoom.current = { key: zoomKey, at: now };
    // 처음 그릴 때 전체 모습에서 시작하도록 먼저 전체 자리를 잡습니다.
    if (first) {
      canvas.style.transform = toCss(
        restTransform({
          frame: { width: frame.clientWidth, height: frame.clientHeight },
          canvas: {
            left: canvas.offsetLeft,
            top: canvas.offsetTop,
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
          },
        }),
      );
    }
    apply(changed ? "zoom" : "refit");
    const onResize = () => apply("instant");
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(blurTimer);
      animation?.cancel();
    };
  }, [frameRef, selector, zoomKey, zoomedValue, refitKey]);
}
