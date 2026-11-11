/**
 * 온보딩 미리보기 창이 실제 연구 홈으로 커지는 전환. 세 박자입니다.
 *  1) 바뀌기: 미리보기 창이 화면 가운데로 옮겨 가며 실제 홈으로 바뀝니다. 홈은 작게 줄여 둡니다.
 *  2) 멈춤: 작은 실제 홈을 잠깐 보여 줍니다.
 * 기본값은 사용자가 시안 화면(/lab/expand)에서 직접 맞춘 값입니다(2026-11-11).
 *  3) 커지기: 그 화면이 그대로 화면 전체로 커집니다. 같은 화면을 키우는 것이라 끊기지 않습니다.
 * 화면 전환 기능이 없거나 동작 줄이기 설정이면 바로 이동합니다.
 */
export interface ExpandTiming {
  /** 미리보기 창이 가운데의 작은 홈으로 바뀌는 시간(ms). 0이면 작은 화면 없이 바로 커집니다. */
  reveal: number;
  /** 작은 홈을 보여 주며 멈춰 있는 시간(ms) */
  hold: number;
  /** 화면 전체로 커지는 시간(ms) */
  grow: number;
  /** 커질 때의 속도 곡선 */
  ease: string;
  /** 모형 그림과 실제 화면이 서로 바뀌는 시간(ms) */
  fade: number;
  /** 가운데에 둘 작은 홈의 크기(화면 대비 배율, 0~1) */
  scale: number;
}

export const EXPAND_TIMING: ExpandTiming = {
  reveal: 1000,
  hold: 300,
  grow: 1200,
  ease: "cubic-bezier(0.45, 0, 0.15, 1)",
  fade: 300,
  scale: 0.7,
};

/** 전환이 도는 동안 html에 붙는 클래스. 홈은 이 클래스가 있으면 화면 안내를 미룹니다. */
export const EXPANDING_CLASS = "ob-expanding";
/** 실제 홈을 작게 줄여 가운데에 둔 상태 */
const FRAMED_CLASS = "ob-framed";
/** 작은 홈이 화면 전체로 커지는 중 */
const GROWING_CLASS = "ob-growing";

const SHELL_SELECTOR = ".app-shell";
const SHELL_WAIT_MS = 1500;
/** 전환이 이 시간만큼 더 걸리면 건너뜁니다(가려진 창에서는 화면이 그려지지 않아 멈춥니다). */
const STALL_MARGIN_MS = 1500;

const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function canExpand(): boolean {
  return (
    typeof document.startViewTransition === "function" &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * 실제 홈의 바깥 틀이 화면에 들어올 때까지 기다립니다.
 * 라우터가 이동을 조금 늦게 반영하기 때문에, 기다리지 않으면 전환이 이전 화면을 새 화면으로
 * 찍고 곧바로 끊깁니다. 브라우저는 이 약속이 끝난 뒤에 새 화면을 찍습니다.
 */
function untilShell(): Promise<void> {
  if (document.querySelector(SHELL_SELECTOR)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (document.querySelector(SHELL_SELECTOR)) done();
    });
    const timer = window.setTimeout(done, SHELL_WAIT_MS);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/** 화면 전환 하나를 돌리고 끝날 때까지 기다립니다. 멈추면 건너뛰고, 화면 변경은 그대로 적용됩니다. */
async function runTransition(
  update: () => void | Promise<void>,
  duration: number,
) {
  const transition = document.startViewTransition(update);
  const stall = window.setTimeout(
    () => transition.skipTransition(),
    duration + STALL_MARGIN_MS,
  );
  try {
    await transition.finished;
  } catch {
    // 건너뛴 전환입니다. 화면 변경은 이미 적용됐습니다.
  } finally {
    window.clearTimeout(stall);
  }
}

/** @param go 실제 홈으로 이동하는 함수. 홈의 바깥 틀이 들어올 때까지 전환이 기다립니다. */
export async function expandIntoHome(
  go: () => void,
  timing: ExpandTiming = EXPAND_TIMING,
): Promise<void> {
  if (!canExpand()) {
    go();
    return;
  }
  const root = document.documentElement;
  const set = (name: string, value: string) =>
    root.style.setProperty(`--ob-vt-${name}`, value);
  const framed = timing.reveal > 0;
  root.classList.add(EXPANDING_CLASS);
  if (framed) root.classList.add(FRAMED_CLASS);
  set("ease", timing.ease);
  set("fade", `${timing.fade}ms`);
  set("grow", `${timing.grow}ms`);
  set("scale", String(timing.scale));
  set("duration", `${framed ? timing.reveal : timing.grow}ms`);
  try {
    await runTransition(
      () => {
        go();
        return untilShell();
      },
      framed ? timing.reveal : timing.grow,
    );
    if (!framed) return;
    if (timing.hold > 0) await wait(timing.hold);
    root.classList.replace(FRAMED_CLASS, GROWING_CLASS);
    await wait(timing.grow);
  } finally {
    root.classList.remove(EXPANDING_CLASS, FRAMED_CLASS, GROWING_CLASS);
    for (const name of ["duration", "ease", "fade", "grow", "scale"])
      root.style.removeProperty(`--ob-vt-${name}`);
  }
}
