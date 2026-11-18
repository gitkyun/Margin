/**
 * 응답 속도 조정값(2026-11-19). 생각 단계마다 출력 상한·제한 시간·재시도 여부를 정합니다.
 * Gemini는 생각 토큰도 maxOutputTokens 안에서 쓰므로, 생각을 길게 하는 단계일수록 상한을 넉넉히 둡니다.
 * 수치는 실측(high 생각 토큰 2,266~7,860, low 응답 10~15초)에서 잡은 출발점이고, 품질 평가로 다시 맞춥니다.
 */
export type ThinkingLevel = "low" | "medium" | "high";

/** 이어쓰기·부분 수정처럼 짧은 글을 돌려주는 요청 */
const SHORT_MODES = new Set(["continue_writing", "inline_edit"]);

const OUTPUT_LIMIT: Record<ThinkingLevel, { short: number; long: number }> = {
  low: { short: 4096, long: 8192 },
  medium: { short: 8192, long: 16384 },
  high: { short: 16384, long: 24576 },
};

/** 한 번 호출의 제한 시간(ms). low는 큰 연구 기록 입력의 타임아웃을 방지하기 위해 45초로 둡니다. */
const ATTEMPT_TIMEOUT_MS: Record<ThinkingLevel, number> = {
  low: 45_000,
  medium: 60_000,
  high: 90_000,
};

/**
 * 작업별 최소 Thinking 수준.
 * 깊은 논리 점검이나 날짜 제약이 필요한 작업은 최소 medium으로 보장해 품질 저하를 방지합니다.
 */
const TASK_MINIMUM_THINKING: Partial<Record<string, ThinkingLevel>> = {
  review_writing: "medium",
  propose_roadmap: "medium",
};

/**
 * 작업별 최대 Thinking 수준.
 * 이어쓰기나 인라인 수정 같은 짧은 결과 작업은 high가 불필요하게 응답 시간을 늘리지 않도록 low로 제한합니다.
 */
const TASK_MAXIMUM_THINKING: Partial<Record<string, ThinkingLevel>> = {
  continue_writing: "low",
  inline_edit: "low",
};

const LEVEL_ORDER: ThinkingLevel[] = ["low", "medium", "high"];

/**
 * 작업 종류와 사용자의 요청 수준을 종합하여 실제 적용할 생각 단계를 결정합니다.
 * 사용자가 고른 값을 기본으로 존중하되, 작업 특성에 따른 최소/최대 안전 범위를 적용합니다.
 */
export function effectiveThinking(
  mode: string,
  requested: string | undefined,
): ThinkingLevel {
  const level = thinkingLevel(requested);
  const min = TASK_MINIMUM_THINKING[mode];
  const max = TASK_MAXIMUM_THINKING[mode];
  let effective = level;
  if (min && LEVEL_ORDER.indexOf(effective) < LEVEL_ORDER.indexOf(min)) {
    effective = min;
  }
  if (max && LEVEL_ORDER.indexOf(effective) > LEVEL_ORDER.indexOf(max)) {
    effective = max;
  }
  return effective;
}

/** 재시도를 포함한 전체 모델 대기 한도. Edge Function 실행 한도(150초) 안에 끝나도록 둡니다. */
export const MODEL_BUDGET_MS = 130_000;

/** 생각 단계를 보내지 않으면 모델 기본값(가장 깊은 생각)으로 동작하므로 high로 봅니다. */
export function thinkingLevel(thinking: string | undefined): ThinkingLevel {
  return thinking === "low" || thinking === "minimal"
    ? "low"
    : thinking === "medium"
      ? "medium"
      : "high";
}

export function maxOutputFor(
  mode: string,
  thinking: string | undefined,
): number {
  const limit = OUTPUT_LIMIT[effectiveThinking(mode, thinking)];
  return SHORT_MODES.has(mode) ? limit.short : limit.long;
}

export function attemptTimeoutFor(
  thinking: string | undefined,
  mode?: string,
): number {
  const level = mode
    ? effectiveThinking(mode, thinking)
    : thinkingLevel(thinking);
  return ATTEMPT_TIMEOUT_MS[level];
}

/**
 * 시간 초과일 때만 한 번 다시 시도합니다(무한 재시도 금지, 작업 문서 4장). 사용자가 중단했거나,
 * 남은 시간이 한 번 더 기다리기에 모자라면 다시 하지 않습니다.
 */
export function shouldRetry(input: {
  attempt: number;
  outcome: "timeout" | "network" | number;
  cancelled: boolean;
  elapsedMs: number;
  nextTimeoutMs: number;
}): boolean {
  if (input.attempt >= 2 || input.cancelled) return false;
  if (input.elapsedMs + input.nextTimeoutMs > MODEL_BUDGET_MS) return false;
  return input.outcome === "timeout";
}

/** 구간별 시간(ms)을 Server-Timing 머리글 값으로 바꿉니다. */
export function serverTiming(marks: Record<string, number>): string {
  return Object.entries(marks)
    .filter(([name, value]) => /^[a-z_]+$/.test(name) && Number.isFinite(value))
    .map(([name, value]) => `${name};dur=${Math.max(0, Math.round(value))}`)
    .join(", ");
}

/** 구간 시간 기록기. 각 구간은 앞 구간이 끝난 뒤부터 잰 시간입니다. */
export function stageClock(now: () => number = () => performance.now()) {
  const start = now();
  let last = start;
  const marks: Record<string, number> = {};
  return {
    marks,
    mark(name: string) {
      const at = now();
      marks[name] = Math.round((marks[name] ?? 0) + (at - last));
      last = at;
    },
    total() {
      return Math.round(now() - start);
    },
  };
}
