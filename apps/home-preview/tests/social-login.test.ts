// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  finishSocialLogin,
  lineLoginEnabled,
  socialLoginProblem,
  startSocialLogin,
  takeSocialProblem,
} from "../src/lib/social-login";

afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/login");
});

function fakeClient() {
  return {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      setSession: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

describe("라인 로그인", () => {
  it("배포 설정이 켜져 있을 때만 버튼을 보여 준다", () => {
    expect(lineLoginEnabled(undefined)).toBe(false);
    expect(lineLoginEnabled("")).toBe(false);
    expect(lineLoginEnabled("1")).toBe(true);
    expect(lineLoginEnabled("true")).toBe(true);
  });

  it("사용자 지정 제공자 custom:line으로 이메일까지 요청한다", async () => {
    const client = fakeClient();
    await startSocialLogin(client as never, "line", "/r/abc");
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "custom:line",
      options: {
        redirectTo: `${window.location.origin}/r/abc`,
        scopes: "openid profile email",
      },
    });
  });

  it("카카오는 전과 같이 kakao 제공자로 보낸다", async () => {
    const client = fakeClient();
    await startSocialLogin(client as never, "kakao", "https://evil.example");
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/r` },
    });
  });

  it("라인에서 돌아온 실패는 라인 문구로 안내한다", async () => {
    const client = fakeClient();
    await startSocialLogin(client as never, "line", "/r");
    window.history.replaceState(
      null,
      "",
      "/login?error=access_denied&error_code=access_denied&error_description=access_denied",
    );
    const result = await finishSocialLogin(client as never);
    expect(result.handled).toBe(true);
    expect(takeSocialProblem()).toBe(
      "라인 로그인을 취소했어요. 다시 시도해 주세요.",
    );
    expect(window.location.search).toBe("");
  });

  it("이메일을 받지 못하면 동의를 안내한다(가입 허용에 이메일 확인이 필요)", () => {
    expect(
      socialLoginProblem(
        "Error getting user email from external provider",
        "line",
      ),
    ).toBe(
      "라인 계정의 이메일을 받지 못했어요. 라인 로그인 화면에서 이메일 제공에 동의해 주세요.",
    );
    expect(
      socialLoginProblem(
        "Unsupported provider: provider is not enabled",
        "line",
      ),
    ).toBe("라인 로그인을 아직 쓸 수 없어요. 이메일로 로그인해 주세요.");
    expect(socialLoginProblem("access_denied")).toBe(
      "카카오 로그인을 취소했어요. 다시 시도해 주세요.",
    );
  });
});
