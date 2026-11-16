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
  const menu = page.getByRole("navigation").first();
  for (const [name, path, title] of [
    // 사이드바 메뉴 여섯(감사 F1). 검토 요청·자료는 피드백·문서 메뉴 안의 탭이에요.
    ["할 일", "tasks", "할 일"],
    ["피드백", "feedback", "피드백"],
    ["미팅", "meetings", "미팅"],
    ["문서", "writing", "글쓰기"],
    ["일정", "planning", "일정"],
  ] as const) {
    // 피드백 메뉴는 새 응답이 있으면 이름 뒤에 '새 응답 있음'이 붙어요(사이드바 점의 화면 낭독 문구).
    await menu
      .getByRole("link", { name: new RegExp(`^${name}( 새 응답 있음)?$`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(page).toHaveTitle(new RegExp(title));
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
    .getByRole("navigation")
    .first()
    .getByRole("link", { name: "할 일", exact: true })
    .click();
  // 연구 홈에도 같은 제목의 링크가 있어서, 할 일 화면에 도착한 뒤 목록 행 안에서 찾아요.
  await expect(page).toHaveURL(/\/tasks$/);
  const rows = page.locator(".student-task-row");
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
  await expect(page).toHaveURL(/\/settings/);
  await page.goto(`${page.url().split("?")[0]}?tab=members`);
  await expect(page.getByLabel("공동연구자 이메일")).toBeVisible();
  await expect(page.getByText("이메일로 초대")).toHaveCount(0);
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
