import { expect, test, type Locator, type Page } from "@playwright/test";

/** 휴대폰 폭에서 행을 왼쪽으로 밀어요(마우스 포인터로 손가락 끌기를 흉내). */
async function swipeLeft(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 60, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(box.x + box.width - 60 - i * 20, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}
test("휴대폰: 글·자료 행을 왼쪽으로 밀면 보관, 할 일 행을 왼쪽으로 밀면 내일로 미루기", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  await page.waitForURL("**/r/*");
  const base = page.url().replace(/\/$/, "");
  await page.goto(base + "/docs");
  await swipeLeft(
    page,
    page.locator(".docs-row", { hasText: "연구계획서" }).first(),
  );
  await expect(page.getByText("보관했어요.")).toBeVisible();
  await expect(page).toHaveURL(/\/docs$/);
  await page.goto(base + "/tasks");
  await swipeLeft(
    page,
    page.locator(".task-line", { hasText: "인터뷰 질문지 보완" }).first(),
  );
  await expect(page.getByText("내일로 미뤘어요.")).toBeVisible();
});
