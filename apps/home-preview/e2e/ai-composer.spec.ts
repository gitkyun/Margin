import { expect, test, type Page } from "@playwright/test";
import {
  OWNER,
  RESEARCH_ID,
  WORKSPACE,
  mockServer,
  signInAs,
} from "./support/supabase-mock";

// 연구 도우미 입력창(모델·답변 깊이·첨부·보내기)의 화면 흐름. 서버 응답은 가로채서 정합니다.
const SHOTS = process.env.SHOTS_DIR;
const models = [
  "gemini-3.8-flash",
  "gemini-4-hydrogen",
  "gemini-4-carbon",
  "gemini-4-argon",
].map((id, index) => ({
  id,
  label: [
    "Gemini 3.8 Flash",
    "Gemini 4 Hydrogen",
    "Gemini 4 Carbon",
    "Gemini 4 Argon",
  ][index],
  provider: "google",
  description: [
    "일반 대화와 기록 정리에 추천해요.",
    "빠른 문서 이해와 정리에 써 볼 수 있어요.",
    "문서 분석과 원고 검토에 써 볼 수 있어요.",
    "복잡한 분석과 긴 검토에 써 볼 수 있어요.",
  ][index],
  recommended: index === 0,
  thinking: ["high", "medium", "low"],
}));
const credits = {
  total: 0,
  complete: 0,
  failed: 0,
  running: 0,
  cancelled: 0,
  limit: 100,
  windowHours: 24,
  perMinuteLimit: 6,
  credits: {
    balance: 19992.969,
    allowance: 20000,
    reserved: 0,
    used: 7.031,
    grant: 0,
    resetsAt: "2026-12-01T00:00:00Z",
    ledger: [],
  },
};

async function open(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      errors.push(m.text().slice(0, 160));
  });
  await signInAs(page, OWNER);
  const server = await mockServer(page);
  server.rpc("rms_bootstrap", () => WORKSPACE);
  server.rpc("rms_ai_usage", () => credits);
  server.rpc(
    "rms_save_record",
    (body) => (body as { p_value: unknown }).p_value,
  );
  server.fn("ai-assist", (body, route) =>
    route.request().method() === "GET"
      ? { models }
      : {
          runId: "run-1",
          candidates: [],
          answer:
            "**핵심만** 말씀드릴게요 [근거 1].\n\n- 첫째 확인\n- 둘째 확인",
          creditsUsed: 0.831,
          creditStatus: "settled",
          model: (body as { model?: string }).model,
        },
  );
  await page.goto(`/r/${RESEARCH_ID}/assistant`);
  await expect(page.locator("form.ai-composer")).toBeVisible();
  return { errors, server };
}
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

test("입력창이 한 줄 도구 막대로 보이고 화면 밖으로 넘치지 않는다", async ({
  page,
}) => {
  for (const [w, h] of [
    [1440, 900],
    [768, 900],
    [390, 800],
  ]) {
    const { errors } = await open(page, w, h);
    await expect(page.locator("button.ai-model-trigger")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${w}px 가로 넘침`).toBe(false);
    await shot(page, `composer-${w}`);
    expect(errors).toEqual([]);
    await page.reload();
  }
});

test("모델 목록을 열고 고르고 닫는 동작을 빠르게 반복해도 상태가 맞다", async ({
  page,
}) => {
  const { errors } = await open(page);
  const trigger = page.locator("button.ai-model-trigger");
  await expect(trigger).toContainText("Gemini 3.8 Flash");
  await trigger.click();
  await expect(page.locator(".chip-select-popup")).toBeVisible();
  await page.waitForTimeout(350);
  await shot(page, "selector-open");
  await page.getByRole("option", { name: /Gemini 4 Carbon/ }).click();
  await expect(page.locator(".chip-select-popup")).toBeHidden();
  await expect(trigger).toContainText("Gemini 4 Carbon");
  for (let i = 0; i < 4; i += 1) {
    await trigger.click();
    await page.keyboard.press("Escape");
  }
  await expect(page.locator(".chip-select-popup")).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("질문을 보내면 서식 있는 답변과 출처가 보인다", async ({ page }) => {
  const { errors, server } = await open(page);
  await page
    .locator("form.ai-composer textarea")
    .fill("이 연구의 핵심만 알려 줘");
  await page.getByRole("button", { name: "질문 보내기" }).click();
  await expect(page.locator(".ai-message-body strong").first()).toHaveText(
    "핵심만",
  );
  await shot(page, "answered");
  expect(server.count("ai-assist")).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("다크 모드에서도 입력창과 모델 목록이 읽힌다", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const { errors } = await open(page);
  await page.getByRole("combobox", { name: /AI 모델/ }).click();
  const popup = page.locator(".chip-select-popup");
  await expect(popup).toBeVisible();
  await page.waitForTimeout(350);
  await shot(page, "dark-selector");
  const colors = await popup.evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(colors.background).not.toBe(colors.color);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("설정의 AI 기본 설정에서도 같은 선택 칩을 쓴다", async ({ page }) => {
  const { errors } = await open(page);
  await page.goto(`/account?tab=ai`);
  const chip = page.getByRole("combobox", { name: /AI 모델/ });
  await expect(chip).toBeVisible();
  await page.waitForTimeout(350);
  await shot(page, "settings-ai");
  await chip.click();
  await expect(page.getByRole("option")).toHaveCount(4);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
