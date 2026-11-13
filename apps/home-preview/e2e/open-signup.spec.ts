import { expect, test } from "@playwright/test";
import { GUEST, OWNER, mockServer, signInAs } from "./support/supabase-mock";

// 초대 없이 가입하기와 카카오 로그인의 화면 흐름. 서버 규칙(rms_join)은
// supabase/tests/backend.test.mjs가 실제 SQL로 검증합니다.
test.describe("누구나 가입", () => {
  test("초대 링크 없이 가입 화면을 열면 바로 계정을 만들 수 있다", async ({
    page,
  }) => {
    const server = await mockServer(page);
    server.account(GUEST);
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "마진 시작하기" }),
    ).toBeVisible();
    await page.getByLabel("이름").fill("새 사용자");
    await page.getByLabel("이메일").fill(GUEST.email);
    await page.getByLabel("비밀번호").fill("correct-horse-1!");
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect.poll(() => server.count("/auth/v1/signup")).toBe(1);
    const signup = server.calls.find((call) => call.name === "/auth/v1/signup");
    expect(JSON.stringify(signup?.body)).not.toContain("invite");
  });

  test("로그인한 계정은 첫 화면 전에 허용 목록에 들어간다", async ({
    page,
  }) => {
    const server = await mockServer(page);
    server.rpc("rms_join", () => true);
    await signInAs(page, OWNER);
    await page.goto("/r");
    await expect.poll(() => server.count("rms_join")).toBe(1);
  });

  test("로그인·가입 화면에 카카오 버튼이 있고 누르면 카카오 인증으로 간다", async ({
    page,
  }) => {
    await mockServer(page);
    let authorize = "";
    await page.route("**/auth/v1/authorize**", (route) => {
      authorize = route.request().url();
      return route.fulfill({ status: 200, body: "kakao" });
    });
    await page.goto("/signup");
    await expect(
      page.getByRole("button", { name: "카카오로 시작하기" }),
    ).toBeVisible();
    await page.goto("/login?next=%2Fr");
    await page.getByRole("button", { name: "카카오로 시작하기" }).click();
    await expect.poll(() => authorize).toContain("provider=kakao");
    expect(decodeURIComponent(authorize)).toMatch(/redirect_to=[^&]*\/r(&|$)/);
  });

  test("카카오에서 실패해 돌아오면 로그인 화면이 이유를 알려 준다", async ({
    page,
  }) => {
    await mockServer(page);
    await page.goto(
      "/r#error=server_error&error_description=Error+getting+user+email+from+external+provider",
    );
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("alert")).toContainText(
      "카카오 계정의 이메일을 받지 못했어요",
    );
  });
});
