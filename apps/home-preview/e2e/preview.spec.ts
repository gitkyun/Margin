import { expect, test } from "@playwright/test";

// 미리보기 모드(서버 없이 가상 기록을 이 브라우저에만 저장)로 주요 화면이 열리고 이어지는지 봅니다.
const RESEARCH = "연구 도구 사용 경험";

test("내 연구에서 연구 홈으로 들어가 주요 메뉴를 오간다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/);
  const menu = page.getByRole("navigation", { name: "주요 메뉴" }).first();
  for (const [name, path, title] of [
    // IA v2 상단 메뉴 넷(docs/design/ia-v2/02-shell.md §3.1). 0단계에는 지금 화면을 그대로 띄워요.
    ["할 일", "/tasks", "할 일"],
    ["미팅", "/meetings", "미팅"],
    ["글·자료", "/docs", "글·자료"],
    ["홈", "", "홈"],
  ] as const) {
    // 미팅 메뉴는 새 교수 응답이 있으면 이름 뒤에 '새 응답 있음'이 붙어요(점의 화면 낭독 문구).
    await menu
      .getByRole("link", { name: new RegExp(`^${name}( 새 응답 있음)?$`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/r/[0-9a-f-]{36}${path}$`));
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(
      menu.getByRole("link", { name: new RegExp(`^${name}`) }),
    ).toHaveAttribute("aria-current", "page");
  }
  expect(errors).toEqual([]);
});

test("할 일 목록에 가상 연구의 할 일이 보인다", async ({ page }) => {
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .first()
    .getByRole("link", { name: "할 일", exact: true })
    .click();
  // 연구 홈에도 같은 제목의 링크가 있어서, 할 일 화면에 도착한 뒤 목록 행 안에서 찾아요.
  await expect(page).toHaveURL(/\/tasks$/);
  // IA v2 할 일 화면(T1)의 공통 줄(TaskRow)
  const rows = page.locator(".tasks-groups .task-line");
  await expect(
    rows.getByText("선행연구 비교 기준 정리", { exact: true }),
  ).toBeVisible();
  await expect(
    rows.getByText("인터뷰 질문지 보완", { exact: true }),
  ).toBeVisible();
});

test("미리보기에서는 공동연구자 설정이 열리고, 메일 초대 대신 기존 안내를 보여 준다", async ({
  page,
}) => {
  await page.goto("/r");
  await page.getByRole("link", { name: "연구 설정" }).first().click();
  // IA v2: 연구 설정은 그 연구 홈 위의 설정 창(`?settings=`)으로 열립니다.
  await expect(page).toHaveURL(/\/r\/[^/?]+\?settings=research$/);
  const dialog = page.getByRole("dialog", { name: "설정" });
  await dialog.getByRole("button", { name: "함께하는 사람" }).click();
  await expect(page).toHaveURL(/\?settings=people$/);
  await expect(dialog.getByLabel("공동연구자 이메일")).toBeVisible();
  await expect(page.getByText("이메일로 초대")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/settings=/);
  // 예전 주소는 새 주소로 넘어갑니다(01 §3.3).
  const base = new URL(page.url()).pathname;
  await page.goto(`${base}/settings?tab=lifecycle`);
  await expect(page).toHaveURL(new RegExp(`${base}\\?settings=danger$`));
  await page.goto(`${base}/settings?tab=아무값`);
  await expect(page).toHaveURL(new RegExp(`${base}\\?settings=research$`));
});

test("없는 주소는 404 안내를, 초대 수락 주소는 미리보기에서 가입 안내로 보낸다", async ({
  page,
}) => {
  await page.goto("/no-such-page");
  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없어요" }),
  ).toBeVisible();
  await page.goto("/join?token=anything");
  await expect(page).toHaveURL(/\/signup$/);
});

test("휴대폰 너비에서 내 연구 화면이 가로로 넘치지 않는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/r");
  await expect(page.getByText(RESEARCH).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("일정 단계는 키보드로 순서를 저장하고 편집·현재 단계 설정을 따로 실행한다", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  const home = page.url();
  await page.goto(`${home}/planning`);
  await page
    .getByRole("button", { name: "기본 단계로 시작", exact: true })
    .click();
  const cards = page.locator(".roadmap-sortable .phase-card");
  await expect(cards).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "현재 단계로 설정", exact: true }).first(),
  ).toBeEnabled();
  const handle = page.getByRole("button", { name: /^연구 설계 끌어서 옮기기/ });
  await handle.press("Alt+ArrowUp");
  await expect(cards.nth(1).getByRole("heading")).toHaveText("연구 설계");
  await expect(handle).toBeEnabled();
  await page.reload();
  await expect(cards.nth(1).getByRole("heading")).toHaveText("연구 설계");
  await cards
    .nth(1)
    .getByRole("button", { name: "현재 단계로 설정", exact: true })
    .click();
  await expect(cards.nth(1)).toHaveClass(/is-current/);
  await expect(
    cards.nth(1).getByRole("button", { name: "현재 단계로 설정", exact: true }),
  ).toHaveCount(0);
  await cards
    .nth(1)
    .getByRole("button", { name: "연구 설계 단계 편집", exact: true })
    .click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("textbox", { name: /단계 이름/ }) });
  await dialog
    .getByRole("textbox", { name: /단계 이름/ })
    .fill("연구 설계 수정");
  await dialog.getByRole("button", { name: "단계 저장", exact: true }).click();
  await expect(cards.nth(1).getByRole("heading")).toHaveText("연구 설계 수정");
  await page.goto(home);
  await page
    .locator(".rh-phase-track")
    .getByRole("link", { name: /연구 설계 수정/ })
    .click();
  await expect(cards.nth(1)).toBeFocused();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      `${width}px 넘침`,
    ).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("연결이 끊기면 상단 띠 하나만 연결 끊김으로 바뀐다", async ({
  page,
  context,
}) => {
  await page.goto("/r");
  await page.getByRole("link", { name: "연구 설정" }).first().click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".preview-banner")).toHaveCount(1);
  await context.setOffline(true);
  await expect(
    page.getByText("인터넷 연결이 끊겼어요. 연결되면 다시 저장해 주세요."),
  ).toBeVisible();
  await expect(page.locator(".preview-banner")).toHaveCount(1);
  await context.setOffline(false);
  await expect(
    page.getByText("인터넷 연결이 끊겼어요.", { exact: false }),
  ).toHaveCount(0);
});

test("일본어 태블릿 상단바에서도 계정 버튼이 화면 안에 보인다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 850 });
  await page.addInitScript(() => localStorage.setItem("margin-lang", "ja"));
  await page.goto("/r");
  await page
    .locator('main a[href^="/r/"]')
    .filter({ hasNotText: /新規/ })
    .first()
    .click();
  await expect(page.locator(".hm-home")).toBeVisible();

  const topbar = page.locator(".ia-topbar");
  const account = topbar.locator(".kokonut-profile-trigger");
  await expect(account).toBeVisible();
  const right = await account.evaluate(
    (el) => el.getBoundingClientRect().right,
  );
  expect(right).toBeLessThanOrEqual(768);
  const overflow = await topbar.evaluate(
    (el) => el.scrollWidth - el.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("사이드 창을 전환하거나 닫아도 질문 초안과 선택한 보기가 남는다", async ({
  page,
}) => {
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const rail = page.getByRole("toolbar", { name: "옆 창 열기" });
  const assistant = rail.getByRole("button", {
    name: "연구 도우미",
    exact: true,
  });
  const log = rail.getByRole("button", { name: "결정·질문", exact: true });
  await assistant.click();
  const draft = page.locator("#margin-panel .ia-panel-tab textarea").first();
  await draft.fill("패널을 바꿔도 남아 있어야 하는 질문");
  await log.click();
  const questions = page
    .locator("#margin-panel")
    .getByText("질문", { exact: true })
    .first();
  await questions.click();
  await assistant.click();
  await expect(draft).toHaveValue("패널을 바꿔도 남아 있어야 하는 질문");
  await assistant.click();
  await expect(draft).toBeHidden();
  await log.click();
  await expect(questions.locator("xpath=..")).toHaveAttribute(
    "data-active",
    "true",
  );
  await assistant.click();
  await expect(draft).toHaveValue("패널을 바꿔도 남아 있어야 하는 질문");
});
