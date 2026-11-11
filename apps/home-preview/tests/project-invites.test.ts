// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emailFailureMessage,
  forgetPendingJoin,
  joinPath,
  joinTokenFrom,
  pendingJoin,
  rememberPendingJoin,
  roleLabel,
} from "../src/lib/project-invites";

const TOKEN = "Abc_def-0123456789Abc_def-0123456789Abc_def";

describe("연구 초대 수락 주소", () => {
  it("서버가 만든 모양의 토큰만 받는다", () => {
    expect(joinTokenFrom(TOKEN)).toBe(TOKEN);
    expect(joinTokenFrom(` ${TOKEN} `)).toBe(TOKEN);
    expect(joinTokenFrom(null)).toBeNull();
    expect(joinTokenFrom("short")).toBeNull();
    expect(joinTokenFrom(`${TOKEN}/../r`)).toBeNull();
    expect(joinTokenFrom(`${TOKEN}?next=//evil.example`)).toBeNull();
    expect(joinTokenFrom("a".repeat(129))).toBeNull();
  });

  it("수락 주소는 로그인 뒤 돌아갈 수 있는 /join 경로다", () => {
    expect(joinPath(TOKEN)).toBe(`/join?token=${TOKEN}`);
  });
});

describe("로그인·가입으로 화면을 떠났다 돌아올 때 초대 기억하기", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("기억한 초대를 돌려주고, 지우면 없어진다", () => {
    expect(pendingJoin()).toBeNull();
    rememberPendingJoin(TOKEN);
    expect(pendingJoin()).toBe(TOKEN);
    forgetPendingJoin();
    expect(pendingJoin()).toBeNull();
  });

  it("7일이 지났거나 모양이 틀린 값은 쓰지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T00:00:00Z"));
    rememberPendingJoin(TOKEN);
    vi.setSystemTime(new Date("2026-11-19T00:00:00Z"));
    expect(pendingJoin()).toBeNull();
    localStorage.setItem("margin-pending-join", "{not json");
    expect(pendingJoin()).toBeNull();
    localStorage.setItem(
      "margin-pending-join",
      JSON.stringify({ token: "//evil.example", until: Date.now() + 1000 }),
    );
    expect(pendingJoin()).toBeNull();
  });
});

describe("초대 화면 문구", () => {
  it("역할 이름", () => {
    expect(roleLabel("editor")).toBe("공동연구자");
    expect(roleLabel("advisor")).toBe("지도교수");
  });

  it("메일을 못 보냈을 때는 초대 링크를 직접 전하라고 알려 준다", () => {
    for (const reason of [
      "not_configured",
      "rate_limited",
      "sender_not_verified",
      "rejected",
      "unavailable",
      null,
    ] as const)
      expect(emailFailureMessage(reason)).toContain("초대 링크를 복사해");
  });
});
