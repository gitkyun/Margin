import { describe, expect, it } from "vitest";
import {
  attemptTimeoutFor,
  effectiveThinking,
  maxOutputFor,
  MODEL_BUDGET_MS,
  serverTiming,
  shouldRetry,
  stageClock,
  thinkingLevel,
} from "./tuning";

describe("생각 단계별 출력 상한", () => {
  it("high는 생각 토큰(실측 최대 7,860)과 답을 함께 담도록 예전 8192보다 넉넉하다", () => {
    expect(maxOutputFor("ask_research", "high")).toBe(24576);
    expect(maxOutputFor("ask_research", "medium")).toBe(16384);
    expect(maxOutputFor("ask_research", "low")).toBe(8192);
  });
  it("이어쓰기·부분 수정은 짧은 상한을 쓰되 예전 2048보다 크다", () => {
    expect(maxOutputFor("continue_writing", "low")).toBe(4096);
    // inline_edit는 최대 thinking이 low로 제한되므로 상한은 low의 short인 4096
    expect(maxOutputFor("inline_edit", "high")).toBe(4096);
  });
  it("생각 단계를 보내지 않으면 모델 기본값(가장 깊음)으로 보고 high 기준을 쓴다", () => {
    expect(thinkingLevel(undefined)).toBe("high");
    expect(thinkingLevel("minimal")).toBe("low");
    expect(maxOutputFor("ask_research", undefined)).toBe(24576);
  });
});

describe("작업별 Thinking 보정 (effectiveThinking)", () => {
  it("원고 검토와 로드맵 제안은 최소 medium으로 보장해 품질을 지킨다", () => {
    expect(effectiveThinking("review_writing", "low")).toBe("medium");
    expect(effectiveThinking("review_writing", "medium")).toBe("medium");
    expect(effectiveThinking("review_writing", "high")).toBe("high");
    expect(effectiveThinking("propose_roadmap", "low")).toBe("medium");
  });
  it("이어쓰기와 인라인 수정은 최대 low로 제한해 속도를 지킨다", () => {
    expect(effectiveThinking("continue_writing", "high")).toBe("low");
    expect(effectiveThinking("continue_writing", "medium")).toBe("low");
    expect(effectiveThinking("continue_writing", "low")).toBe("low");
    expect(effectiveThinking("inline_edit", "high")).toBe("low");
  });
  it("일반 대화와 미팅 정리는 사용자가 고른 값을 그대로 따른다", () => {
    expect(effectiveThinking("ask_research", "low")).toBe("low");
    expect(effectiveThinking("ask_research", "medium")).toBe("medium");
    expect(effectiveThinking("ask_research", "high")).toBe("high");
    expect(effectiveThinking("organize_meeting", "low")).toBe("low");
  });
});

describe("제한 시간과 한 번 재시도", () => {
  it("생각이 얕을수록 빨리 끊되, low는 큰 입력 대비 45초로 둔다", () => {
    expect(attemptTimeoutFor("low")).toBe(45_000);
    expect(attemptTimeoutFor("medium")).toBe(60_000);
    expect(attemptTimeoutFor("high")).toBe(90_000);
  });
  it("작업 mode를 전달하면 보정된 effectiveThinking 기준 제한 시간을 쓴다", () => {
    // review_writing은 low 요청이어도 medium으로 보정되어 60초
    expect(attemptTimeoutFor("low", "review_writing")).toBe(60_000);
    // continue_writing은 high 요청이어도 low로 보정되어 45초
    expect(attemptTimeoutFor("high", "continue_writing")).toBe(45_000);
  });
  const base = {
    attempt: 1,
    cancelled: false,
    elapsedMs: 45_000,
    nextTimeoutMs: 45_000,
  };
  it("시간 초과만 한 번 다시 시도한다", () => {
    expect(shouldRetry({ ...base, outcome: "timeout" })).toBe(true);
    expect(shouldRetry({ ...base, outcome: "network" })).toBe(false);
    expect(shouldRetry({ ...base, outcome: 503 })).toBe(false);
    expect(shouldRetry({ ...base, attempt: 2, outcome: "timeout" })).toBe(
      false,
    );
  });
  it("사용 한도·모델 없음·요청 오류는 다시 보내지 않는다", () => {
    for (const status of [400, 404, 429])
      expect(shouldRetry({ ...base, outcome: status })).toBe(false);
  });
  it("사용자가 중단했으면 다시 보내지 않는다", () => {
    expect(shouldRetry({ ...base, cancelled: true, outcome: "timeout" })).toBe(
      false,
    );
  });
  it("남은 시간이 모자라면(high 90초 뒤) 다시 보내지 않는다", () => {
    expect(
      shouldRetry({
        ...base,
        elapsedMs: 90_000,
        nextTimeoutMs: 90_000,
        outcome: "timeout",
      }),
    ).toBe(false);
    expect(
      shouldRetry({
        ...base,
        elapsedMs: 60_000,
        nextTimeoutMs: 60_000,
        outcome: "timeout",
      }),
    ).toBe(60_000 + 60_000 <= MODEL_BUDGET_MS);
  });
});

describe("구간 시간", () => {
  it("구간마다 앞 구간이 끝난 뒤부터 잰다", () => {
    let now = 0;
    const clock = stageClock(() => now);
    now = 120;
    clock.mark("auth");
    now = 450;
    clock.mark("context");
    now = 9450;
    clock.mark("model");
    expect(clock.marks).toEqual({ auth: 120, context: 330, model: 9000 });
    expect(clock.total()).toBe(9450);
  });
  it("Server-Timing 값으로 바꾸고 이상한 이름은 뺀다", () => {
    expect(serverTiming({ auth: 12.4, model: 900, "bad name": 1 })).toBe(
      "auth;dur=12, model;dur=900",
    );
  });
});
