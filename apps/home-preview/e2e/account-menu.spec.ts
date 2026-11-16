import { expect, test, type Page } from "@playwright/test";
import {
  OWNER,
  RESEARCH_ID,
  WORKSPACE,
  mockServer,
  signInAs,
} from "./support/supabase-mock";

async function openAccountMenu(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await signInAs(page, OWNER);
  const server = await mockServer(page);
  server.rpc("rms_bootstrap", () => WORKSPACE);
  await page.goto(`/r/${RESEARCH_ID}`);
  const trigger = page.locator(".kokonut-profile-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator(".kokonut-profile-panel")).toBeVisible();
  return server;
}

test("계정 메뉴가 768px/900px 높이에서 잘리지 않고 지시된 항목만 보인다", async ({
  page,
}) => {
  for (const height of [900, 768]) {
    await openAccountMenu(page, 1280, height);
    const menu = page.locator(".kokonut-profile-panel");
    await expect(menu).toContainText("프로필 설정");
    await expect(menu).toContainText("AI 기본 설정");
    await expect(menu).toContainText("사용량·플랜");
    await expect(menu).toContainText("Free");
    await expect(menu).toContainText("사용 안내");
    await expect(menu).not.toContainText("화면 설정");
    const logoutBtn = menu.getByRole("menuitem", { name: /로그아웃/ });
    await expect(logoutBtn).toBeInViewport();
    await page.keyboard.press("Escape");
  }
});

test("계정 메뉴 인라인 테마 전환이 실제 테마를 바꾼다", async ({ page }) => {
  await openAccountMenu(page);
  const menu = page.locator(".kokonut-profile-panel");
  await menu.getByRole("menuitemradio", { name: "다크" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await menu.getByRole("menuitemradio", { name: "라이트" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("길게 눌러 로그아웃이 마우스와 키보드(동작 줄이기 포함)로 동작한다", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAccountMenu(page);
  const logoutBtn = page
    .locator(".kokonut-profile-panel")
    .getByRole("menuitem", { name: /로그아웃/ });

  // 짧게 눌렀다 떼면 로그아웃되지 않는다
  await logoutBtn.dispatchEvent("pointerdown", { button: 0, pointerId: 1 });
  await page.waitForTimeout(200);
  await logoutBtn.dispatchEvent("pointerup");
  await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}`));

  // 키보드로 길게 누르면 로그인 화면으로 이동한다
  await logoutBtn.focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(1300);
  await page.keyboard.up("Enter");
  await expect(page).toHaveURL(/\/login/);
});
