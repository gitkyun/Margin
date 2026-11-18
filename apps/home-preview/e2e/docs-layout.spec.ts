import { expect, test } from "@playwright/test";

test("긴 비공개 글 제목 옆의 자물쇠가 목록 안에 보인다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const docsUrl = page.url() + "/docs";
  const title = "연구도구의장기적인사용경험에서관찰한행동변화".repeat(9);
  await page.goto(docsUrl + "?new=1");
  const dialog = page.getByRole("dialog", { name: "새 글" });
  await dialog.getByPlaceholder("예: 연구 방법 초안").fill(title);
  await dialog.getByRole("button", { name: "만들기", exact: true }).click();
  await page.waitForURL("**/docs/w/*");
  await page.goto(docsUrl + "?kind=writing");
  const row = page.getByRole("link", { name: new RegExp(title) });
  const lock = row.locator(".docs-row-lock");
  await expect(lock).toBeVisible();
  const fullyInside = await lock.evaluate((el) => {
    const icon = el.getBoundingClientRect();
    const link = el.closest("a")!.getBoundingClientRect();
    return icon.left >= link.left - 1 && icon.right <= link.right + 1;
  });
  expect(fullyInside).toBe(true);
});
