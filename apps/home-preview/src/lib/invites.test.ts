import { describe, expect, it } from "vitest";
import {
  inviteCodeFrom,
  inviteLink,
  isUnregisteredReviewer,
  signupProblem,
} from "./invites";

const CODE = "0123456789abcdef0123456789abcdef";

describe("inviteCodeFrom", () => {
  it("reads a bare code, ignoring case and surrounding space", () => {
    expect(inviteCodeFrom(`  ${CODE.toUpperCase()} `)).toBe(CODE);
  });

  it("reads the code out of a pasted invite link", () => {
    expect(inviteCodeFrom(inviteLink("https://margin.example", CODE))).toBe(
      CODE,
    );
  });

  it("returns null for anything that is not a 32-character code", () => {
    expect(inviteCodeFrom("")).toBeNull();
    expect(inviteCodeFrom(null)).toBeNull();
    expect(inviteCodeFrom("https://margin.example/signup")).toBeNull();
    expect(inviteCodeFrom(`${CODE}0`)).toBeNull();
    expect(
      inviteCodeFrom("https://margin.example/signup?invite=abc"),
    ).toBeNull();
  });
});

describe("signupProblem", () => {
  it("tells an existing account to log in", () => {
    expect(signupProblem("User already registered")).toContain("로그인");
  });

  it("explains a mail limit without blaming the input", () => {
    expect(signupProblem("email rate limit exceeded")).toContain("조금 뒤");
  });

  it("falls back to a plain retry message for unknown errors", () => {
    expect(signupProblem("unexpected_failure")).toBe(
      "가입하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
    );
  });
});

describe("isUnregisteredReviewer", () => {
  it("recognises the server message for an email that has no account", () => {
    expect(
      isUnregisteredReviewer(
        "아직 마진에 가입하지 않은 이메일이에요. 초대 링크를 보내 가입을 부탁해 주세요.",
      ),
    ).toBe(true);
    expect(isUnregisteredReviewer("본인 계정을 지정할 수 없어요.")).toBe(false);
  });
});
