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
  await expect(
    page.getByRole("link", { name: "선행연구 비교 기준 정리", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "인터뷰 질문지 보완", exact: true }),
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
