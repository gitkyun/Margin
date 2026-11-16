import { expect, test, type Page } from "@playwright/test";
import {
  GUEST,
  HANDLED,
  OWNER,
  RESEARCH_ID,
  WORKSPACE,
  mockServer,
  signInAs,
  type ServerMock,
} from "./support/supabase-mock";

// 연구 초대 메일의 화면 흐름. 서버 응답은 가로채서 정하고, 서버 쪽 규칙(권한·만료·취소·멱등성)은
// supabase/tests/backend.test.mjs가 실제 SQL로 검증합니다.
const TOKEN = "e2eTokenE2eTokenE2eTokenE2eTokenE2eToken123";
const JOIN = `/join?token=${TOKEN}`;

const invitePreview = (overrides: Record<string, unknown> = {}) => ({
  email: GUEST.email,
  role: "editor",
  status: "pending",
  expiresAt: "2026-12-31T06:00:00Z",
  researchName: "초대 테스트 연구",
  invitedByName: "김학생",
  ...overrides,
});

async function open(page: Page, preview: unknown): Promise<ServerMock> {
  const server = await mockServer(page);
  server.rpc("rms_project_invite_preview", () => preview);
  server.rpc("rms_project_invite_accept", () => ({
    researchId: RESEARCH_ID,
    role: "editor",
    already: false,
  }));
  server.rpc("rms_bootstrap", () => WORKSPACE);
  return server;
}

test.describe("초대받은 사람", () => {
  test("로그인 전: 초대 내용을 보여 주고 로그인·가입을 고르게 한다", async ({
    page,
  }) => {
    await open(page, invitePreview());
    await page.goto(JOIN);
    await expect(
      page.getByRole("heading", { name: "연구에 초대받았어요" }),
    ).toBeVisible();
    const summary = page.locator(".join-summary");
    await expect(summary).toContainText("초대 테스트 연구");
    await expect(summary).toContainText("김학생");
    await expect(summary).toContainText("공동연구자");
    await expect(summary).toContainText(GUEST.email);
    await expect(page.getByRole("button", { name: "초대 수락" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "로그인하고 수락" }),
    ).toHaveAttribute("href", `/login?next=${encodeURIComponent(JOIN)}`);
    await expect(page).toHaveTitle(/연구 초대/);
  });

  test("기존 회원: 로그인한 뒤 초대 화면으로 돌아와 수락하고 연구로 이동한다", async ({
    page,
  }) => {
    const server = await open(page, invitePreview());
    server.account(GUEST);
    await page.goto(JOIN);
    await page.getByRole("link", { name: "로그인하고 수락" }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("이메일").fill(GUEST.email);
    await page.getByLabel("비밀번호").fill("correct-horse-1!");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    // 로그인 뒤에도 초대 수락 흐름이 이어진다
    await expect(page).toHaveURL(new RegExp(`/join\\?token=${TOKEN}$`));
    await page.getByRole("button", { name: "초대 수락" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}$`));
    expect(server.count("rms_project_invite_accept")).toBe(1);
    expect(
      server.calls.find((call) => call.name === "rms_project_invite_accept")
        ?.body,
    ).toEqual({ p_token: TOKEN });
  });

  test("신규 사용자: 초대받은 이메일로만 가입하고 이어서 수락한다", async ({
    page,
  }) => {
    const server = await open(page, invitePreview());
    server.account(GUEST);
    await page.goto(JOIN);
    await page.getByRole("button", { name: "처음이에요. 계정 만들기" }).click();
    const email = page.getByLabel("이메일");
    await expect(email).toHaveValue(GUEST.email);
    await expect(email).not.toBeEditable();
    await page.getByLabel("이름").fill("초대받은 사람");
    await page.getByLabel("비밀번호").fill("correct-horse-1!");
    await page.getByRole("button", { name: "가입하고 계속" }).click();
    await page.getByRole("button", { name: "초대 수락" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}$`));
    const signup = server.calls.find((call) => call.name === "/auth/v1/signup");
    expect(signup?.body).toMatchObject({ email: GUEST.email });
    // 초대 토큰을 계정 정보에 싣지 않는다
    expect(JSON.stringify(signup?.body)).not.toContain(TOKEN);
  });

  test("다른 이메일로 로그인한 사람은 수락할 수 없고 계정을 바꾸게 안내한다", async ({
    page,
  }) => {
    const server = await open(page, invitePreview());
    await signInAs(page, OWNER);
    await page.goto(JOIN);
    await expect(
      page.getByRole("heading", { name: "다른 이메일로 로그인되어 있어요" }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(OWNER.email);
    await expect(page.getByRole("alert")).toContainText(GUEST.email);
    await expect(page.getByRole("button", { name: "초대 수락" })).toHaveCount(
      0,
    );
    await page
      .getByRole("button", { name: "로그아웃하고 다시 로그인" })
      .click();
    await expect(
      page.getByRole("link", { name: "로그인하고 수락" }),
    ).toBeVisible();
    expect(server.count("rms_project_invite_accept")).toBe(0);
  });

  for (const [status, heading] of [
    ["expired", "초대가 만료됐어요"],
    ["revoked", "취소된 초대예요"],
    ["closed", "지금은 수락할 수 없는 초대예요"],
    ["accepted", "이미 수락한 초대예요"],
  ] as const)
    test(`${status} 초대는 수락 버튼 없이 이유와 다음 행동을 알려 준다`, async ({
      page,
    }) => {
      await open(page, invitePreview({ status }));
      await page.goto(JOIN);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByRole("button", { name: "초대 수락" })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("link", { name: "마진으로 이동" }),
      ).toBeVisible();
    });

  test("모르는 토큰과 모양이 틀린 주소는 초대 내용을 보여 주지 않는다", async ({
    page,
  }) => {
    const server = await open(page, null);
    await page.goto(JOIN);
    await expect(
      page.getByRole("heading", { name: "초대 링크를 확인해 주세요" }),
    ).toBeVisible();
    await page.goto("/join?token=short");
    await expect(
      page.getByRole("heading", { name: "초대 링크를 확인해 주세요" }),
    ).toBeVisible();
    // 모양이 틀린 토큰은 서버에 묻지도 않는다
    expect(server.count("rms_project_invite_preview")).toBe(1);
  });

  test("수락하는 사이 초대가 닫히면 서버가 알려 준 이유를 보여 준다", async ({
    page,
  }) => {
    const server = await open(page, invitePreview());
    server.rpc("rms_project_invite_accept", () => ({
      error: "초대 링크가 만료됐습니다. 초대한 사람에게 다시 요청해 주세요.",
      code: "22023",
    }));
    await signInAs(page, GUEST);
    await page.goto(JOIN);
    await page.getByRole("button", { name: "초대 수락" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "초대 링크가 만료됐어요. 초대한 사람에게 다시 요청해 주세요.",
    );
    await expect(page).toHaveURL(new RegExp(`/join\\?token=${TOKEN}$`));
  });

  test("서버에 연결하지 못하면 다시 시도할 수 있다", async ({ page }) => {
    const server = await open(page, invitePreview());
    let fail = true;
    server.rpc("rms_project_invite_preview", async (_body, route) => {
      if (!fail) return invitePreview();
      fail = false;
      await route.abort("failed");
      return HANDLED;
    });
    await page.goto(JOIN);
    await expect(
      page.getByRole("heading", { name: "초대를 확인하지 못했어요" }),
    ).toBeVisible();
    // 불러오기 실패의 버튼 이름은 ‘다시 불러오기’예요(docs/product/user-flow.md 예외 상황).
    await page.getByRole("button", { name: "다시 불러오기" }).click();
    await expect(
      page.getByRole("heading", { name: "연구에 초대받았어요" }),
    ).toBeVisible();
  });

  test("휴대폰 너비와 다크 모드에서도 초대 내용과 버튼이 화면 안에 있다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, invitePreview({ role: "advisor" }));
    await signInAs(page, GUEST);
    await page.goto(JOIN);
    await expect(
      page.getByRole("heading", { name: "지도교수로 초대받았어요" }),
    ).toBeVisible();
    const button = page.getByRole("button", { name: "초대 수락" });
    await expect(button).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("초대한 사람: 연구 설정의 초대 관리", () => {
  const sent = (overrides: Record<string, unknown> = {}) => ({
    id: "11111111-1111-4111-8111-111111111111",
    researchId: RESEARCH_ID,
    email: GUEST.email,
    role: "editor",
    status: "pending",
    createdAt: "2026-11-11T05:00:00Z",
    expiresAt: "2026-11-18T05:00:00Z",
    emailStatus: "queued",
    lastSentAt: "2026-11-11T05:00:00Z",
    sendCount: 1,
    invitedBy: OWNER.id,
    invitedByName: OWNER.name,
    canManage: true,
    ...overrides,
  });

  async function openSettings(page: Page) {
    const server = await mockServer(page);
    let list: unknown[] = [];
    server.rpc("rms_bootstrap", () => WORKSPACE);
    server.rpc("rms_project_invite_list", () => list);
    await signInAs(page, OWNER);
    await page.goto(`/r/${RESEARCH_ID}/settings?tab=members`);
    await expect(page.getByText("아직 보낸 초대가 없어요.")).toBeVisible();
    return {
      server,
      setList: (next: unknown[]) => {
        list = next;
      },
    };
  }

  test("메일을 못 보내도 초대는 남고, 링크 복사·재발송·취소를 목록에서 한다", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const { server, setList } = await openSettings(page);
    const link = `http://127.0.0.1:4181${JOIN}`;
    // 1) 보내기: 메일 발송 실패(발신 도메인 미인증)
    server.fn("project-invite", () => {
      const invite = sent({ emailStatus: "failed" });
      setList([invite]);
      return {
        invite,
        emailStatus: "failed",
        emailFailure: "sender_not_verified",
        link,
      };
    });
    await page.getByLabel("초대할 이메일").fill(GUEST.email);
    await page.getByRole("button", { name: "초대 메일 보내기" }).click();
    // 원본 AI Send의 5초 되돌리기 창이 끝나야 실제 요청이 나갑니다.
    await expect.poll(() => server.count("project-invite"), { timeout: 10000 }).toBe(1);
    const result = page.locator(".project-invite-result");
    await expect(result).toContainText(
      "초대는 만들었지만 메일을 보내지 못했어요",
    );
    await expect(result).toContainText("초대 링크를 복사해 직접 전해 주세요");
    expect(
      server.calls.find((call) => call.name === "project-invite")?.body,
    ).toEqual({
      action: "send",
      researchId: RESEARCH_ID,
      email: GUEST.email,
      role: "editor",
    });
    const row = page.locator(".project-invite-row");
    await expect(row).toContainText(GUEST.email);
    await expect(row).toContainText("수락 대기");
    await expect(row).toContainText("메일을 보내지 못함");
    await result.getByRole("button", { name: "초대 링크 복사" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      link,
    );

    // 2) 다시 보내기: 이번에는 발송 요청 성공. 초대 상태는 여전히 '수락 대기'
    server.fn("project-invite", (body) => {
      expect(body).toEqual({
        action: "resend",
        inviteId: "11111111-1111-4111-8111-111111111111",
      });
      const invite = sent({ emailStatus: "sent", sendCount: 2 });
      setList([invite]);
      return { invite, emailStatus: "sent", emailFailure: null, link };
    });
    await row.getByRole("button", { name: "다시 보내기" }).click();
    await expect(result).toContainText("초대 메일 발송을 요청했어요");
    await expect(row).toContainText("메일 발송 요청함");
    await expect(row).toContainText("수락 대기");

    // 3) 취소
    server.rpc("rms_project_invite_revoke", () => {
      const invite = sent({ status: "revoked" });
      setList([invite]);
      return invite;
    });
    // 취소는 앱 확인 창(B6)에서 한 번 더 누릅니다.
    await row.getByRole("button", { name: "초대 취소" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "초대 취소" })
      .click();
    await expect(row).toContainText("취소함");
    await expect(row.getByRole("button", { name: "다시 보내기" })).toHaveCount(
      0,
    );
    expect(server.count("rms_project_invite_revoke")).toBe(1);
  });

  test("서버가 거절하면(중복 초대, 발송 한도) 이유를 폼 아래에 보여 준다", async ({
    page,
  }) => {
    const { server } = await openSettings(page);
    server.fn("project-invite", () => ({
      error: "이미 초대한 이메일입니다. 초대 목록에서 다시 보낼 수 있습니다.",
      status: 400,
    }));
    await page.getByLabel("초대할 이메일").fill(GUEST.email);
    await page.getByRole("button", { name: "초대 메일 보내기" }).click();
    // 원본 AI Send의 5초 되돌리기 창이 끝나야 실제 요청이 나갑니다.
    await expect.poll(() => server.count("project-invite"), { timeout: 10000 }).toBe(1);
    await expect(page.locator("#project-invite-error")).toHaveText(
      "이미 초대한 이메일이에요. 아래 초대 목록에서 다시 보낼 수 있어요.",
    );
    // 입력한 이메일은 그대로 남는다
    await expect(page.getByLabel("초대할 이메일")).toHaveValue(GUEST.email);
  });

  test("보내기를 누른 뒤 되돌리면 초대 요청이 서버로 나가지 않는다", async ({
    page,
  }) => {
    const { server } = await openSettings(page);
    await page.getByLabel("초대할 이메일").fill(GUEST.email);
    await page.getByRole("button", { name: "초대 메일 보내기" }).click();
    await page.getByRole("button", { name: "되돌리기" }).click();
    await expect(page.getByRole("button", { name: "되돌리기" })).toHaveCount(0);
    // 되돌리기 시간(5초)이 지나도 보내지 않아요.
    await page.waitForTimeout(5500);
    expect(
      server.calls.filter(
        (call) =>
          call.name === "project-invite" &&
          (call.body as { action?: string } | null)?.action === "send",
      ),
    ).toEqual([]);
    await expect(page.getByLabel("초대할 이메일")).toHaveValue(GUEST.email);
  });

  test("지도교수 역할을 고르면 볼 수 있는 범위 안내가 바뀌고 그 역할로 보낸다", async ({
    page,
  }) => {
    const { server, setList } = await openSettings(page);
    server.fn("project-invite", () => {
      const invite = sent({ role: "advisor", emailStatus: "sent" });
      setList([invite]);
      return {
        invite,
        emailStatus: "sent",
        emailFailure: null,
        link: `http://127.0.0.1:4181${JOIN}`,
      };
    });
    await page.getByRole("radio", { name: "지도교수" }).click();
    await expect(page.locator(".project-invites")).toContainText(
      "지도교수는 마진 계정만 열려요",
    );
    await page.getByLabel("초대할 이메일").fill(GUEST.email);
    await page.getByRole("button", { name: "초대 메일 보내기" }).click();
    // 원본 AI Send의 5초 되돌리기 창이 끝나야 실제 요청이 나갑니다.
    await expect.poll(() => server.count("project-invite"), { timeout: 10000 }).toBe(1);
    await expect(page.locator(".project-invite-row")).toContainText("지도교수");
    expect(
      server.calls.find((call) => call.name === "project-invite")?.body,
    ).toMatchObject({ role: "advisor" });
  });
});
