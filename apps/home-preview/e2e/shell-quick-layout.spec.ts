import { expect, test, type Page } from "@playwright/test";

// 화면 위계 정리(2026-11-18): 아이콘 줄의 화면 배치 메뉴, 사이드 창 머리, 도구 줄 칸 높이,
// 할 일 줄 시작선이 화면·너비가 바뀌어도 같은 규칙을 지키는지 봅니다.

async function openResearch(page: Page, path = "") {
  await page.goto("/r");
  const link = page.getByRole("link", { name: /연구 도구 사용 경험/ }).first();
  await link.click();
  await expect(page.locator(".ia-topbar")).toBeVisible();
  if (path) {
    const base = new URL(page.url()).pathname.match(/^\/r\/[^/]+/)![0];
    await page.goto(base + path);
  }
}

test("화면 배치 메뉴로 사이드 창을 왼쪽으로 옮기고 화면 설정으로 갈 수 있다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResearch(page);
  const rail = page.getByRole("toolbar", { name: "옆 창 열기" });
  const tasks = rail.getByRole("button", { name: "할 일", exact: true });
  if ((await tasks.getAttribute("aria-pressed")) !== "true")
    await tasks.click();
  await expect(page.locator("#margin-panel")).toBeVisible();

  await rail.getByRole("button", { name: "화면 배치" }).click();
  await page.getByRole("menuitemradio", { name: "왼쪽" }).click();
  await expect(page.locator(".ia-shell")).toHaveAttribute(
    "data-panel-side",
    "left",
  );
  const boxes = await page.evaluate(() =>
    [".ia-rail", ".margin-panel", ".main-shell"].map(
      (selector) => document.querySelector(selector)!.getBoundingClientRect().x,
    ),
  );
  // 왼쪽 배치: 아이콘 줄 < 사이드 창 < 본문
  expect(boxes[0]).toBeLessThan(boxes[1]);
  expect(boxes[1]).toBeLessThan(boxes[2]);

  await rail.getByRole("button", { name: "화면 배치" }).click();
  await page
    .getByRole("menuitemradio", { name: "화면 설정 모두 보기" })
    .click();
  await expect(page).toHaveURL(/settings=display/);
});

test("사이드 창 머리 제목은 탭이 바뀌어도 같은 높이에 있다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResearch(page);
  const rail = page.getByRole("toolbar", { name: "옆 창 열기" });
  const tops: number[] = [];
  for (const name of ["연구 도우미", "할 일", "결정·질문"]) {
    const tab = rail.getByRole("button", { name, exact: true });
    if ((await tab.getAttribute("aria-pressed")) !== "true") await tab.click();
    const heading = page
      .locator("#margin-panel")
      .getByRole("heading", { level: 2, name, exact: true });
    await expect(heading).toBeVisible();
    tops.push(
      await heading.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return Math.round(box.top + box.height / 2);
      }),
    );
  }
  expect(new Set(tops).size).toBe(1);
});

test("목록 위 찾기·고르기 칸은 화면마다 높이 40이다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResearch(page);
  for (const path of ["/meetings", "/docs", "/tasks"]) {
    const base = new URL(page.url()).pathname.match(/^\/r\/[^/]+/)![0];
    await page.goto(base + path);
    const fields = page.locator(
      "main .record-list-search, main .record-list-filter select, main .docs-search, main .docs-filters select, main .tasks-filters .rms-choice",
    );
    await expect(fields.first()).toBeVisible();
    const heights = await fields.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().height)),
    );
    for (const height of heights) expect(height, path).toBe(40);
  }
});

test("우선순위가 있는 할 일도 제목 시작선이 같다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResearch(page, "/tasks");
  const titles = page.locator("main .task-line-text strong");
  await expect(titles.nth(1)).toBeVisible();
  const starts = await titles.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().left)),
  );
  expect(new Set(starts).size).toBe(1);
  await expect(page.locator("main .priority-dot").first()).toBeVisible();
});

test("휴대폰 할 일 목록은 묶음 제목 바로 아래에 첫 줄이 온다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResearch(page, "/tasks");
  const group = page.locator(".tasks-group").first();
  await expect(group.locator(".task-line").first()).toBeVisible();
  const gap = await group.evaluate((el) => {
    const title = el.querySelector("h2")!.getBoundingClientRect();
    const row = el.querySelector(".task-line")!.getBoundingClientRect();
    return row.top - title.bottom;
  });
  expect(gap).toBeLessThanOrEqual(12);
});

test("아이콘 줄 맨 위 밀기 버튼으로 사이드 창을 접고 다시 편다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResearch(page);
  const rail = page.getByRole("toolbar", { name: "옆 창 열기" });
  const tasks = rail.getByRole("button", { name: "할 일", exact: true });
  if ((await tasks.getAttribute("aria-pressed")) !== "true")
    await tasks.click();
  const panel = page.locator("#margin-panel");
  await expect(panel).toBeVisible();
  // 768 이상에서는 창 머리의 닫기(×) 대신 밀기 버튼을 씁니다.
  await expect(
    panel.getByRole("button", { name: "할 일 창 닫기" }),
  ).toBeHidden();

  await rail.getByRole("button", { name: "사이드 창 접기" }).click();
  await expect(panel).toBeHidden();
  const mainWidth = await page
    .locator(".main-shell")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(mainWidth).toBeGreaterThan(1300);

  await rail.getByRole("button", { name: "사이드 창 펼치기" }).click();
  await expect(panel).toBeVisible();
  await expect(tasks).toHaveAttribute("aria-pressed", "true");
});
