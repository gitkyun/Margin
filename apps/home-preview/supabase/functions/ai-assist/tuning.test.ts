import { describe, expect, it } from "vitest";
import {
  attemptTimeoutFor,
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
    expect(maxOutputFor("inline_edit", "high")).toBe(16384);
  });
  it("생각 단계를 보내지 않으면 모델 기본값(가장 깊음)으로 보고 high 기준을 쓴다", () => {
    expect(thinkingLevel(undefined)).toBe("high");
    expect(thinkingLevel("minimal")).toBe("low");
    expect(maxOutputFor("ask_research", undefined)).toBe(24576);
  });
});

describe("제한 시간과 한 번 재시도", () => {
  it("생각이 얕을수록 빨리 끊는다", () => {
    expect(attemptTimeoutFor("low")).toBe(35_000);
    expect(attemptTimeoutFor("medium")).toBe(60_000);
    expect(attemptTimeoutFor("high")).toBe(90_000);
  });
  const base = {
    attempt: 1,
    cancelled: false,
    elapsedMs: 35_000,
    nextTimeoutMs: 35_000,
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
