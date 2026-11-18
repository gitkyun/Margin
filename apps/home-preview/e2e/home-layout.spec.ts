import { expect, test } from "@playwright/test";

test("새 연구의 시작하기 항목은 카드 폭 안에서 문구를 읽을 수 있다", async ({
  page,
}) => {
  await page.goto("/r/new");
  const intro = page.getByRole("button", { name: "소개 건너뛰기" });
  const name = page.getByPlaceholder("예: 대학원생의 연구 도구 사용 경험");
  await expect(intro.or(name)).toBeVisible();
  if (await intro.isVisible()) await intro.click();
  await name.fill("배치 확인");
  await page.getByRole("button", { name: "건너뛰고 빈 연구로 시작" }).click();
  const list = page.locator(".rh-start-list");
  await expect(list).toBeVisible();
  for (const width of [360, 390, 768, 864, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const labelsFit = await list
      .locator(".rh-start-copy")
      .evaluateAll((labels) =>
        labels.every(
          (label) =>
            label.clientWidth > 0 && label.scrollWidth <= label.clientWidth + 1,
        ),
      );
    expect(labelsFit, width.toString()).toBe(true);
    const columns = await list.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    if (width === 864) expect(columns).toBe(2);
    if (width >= 1024) expect(columns).toBe(1);
  }
});

test("홈 탭은 공간이 부족할 때만 가로로 이동한다", async ({ page }) => {
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const strip = page.locator(".hm-lists-head .margin-tabs");
  await expect(strip).toBeVisible();
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await strip.evaluate((el) => ({
      x: el.scrollWidth - el.clientWidth,
      y: el.scrollHeight - el.clientHeight,
    }));
    expect(overflow.y).toBe(0);
    if (width === 1440) expect(overflow.x).toBe(0);
    else expect(overflow.x).toBeGreaterThan(0);
    const last = strip.getByRole("tab").last();
    if (width === 360) {
      await strip.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
      const bounds = await strip.boundingBox();
      const tab = await last.boundingBox();
      expect(tab!.x + tab!.width).toBeLessThanOrEqual(
        bounds!.x + bounds!.width + 1,
      );
    }
  }
});

test("좁은 홈에서 End 키로 이동한 탭이 온전히 보인다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const strip = page.locator(".hm-lists-head .margin-tabs");
  await strip.getByRole("tab").first().focus();
  await page.keyboard.press("End");
  const last = strip.getByRole("tab").last();
  await expect(last).toBeFocused();
  await expect
    .poll(
      async () => {
        const bounds = await strip.boundingBox();
        const tab = await last.boundingBox();
        return tab!.x + tab!.width - bounds!.x - bounds!.width;
      },
      { timeout: 1000 },
    )
    .toBeLessThanOrEqual(1);
});
