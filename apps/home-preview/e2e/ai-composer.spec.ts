import { expect, test, type Page } from "@playwright/test";
import {
  OWNER,
  RESEARCH_ID,
  WORKSPACE,
  mockServer,
  signInAs,
} from "./support/supabase-mock";

// 연구 도우미 입력창(모델·답변 깊이·명령·대기 줄·컨텍스트·첨부·보내기)의 화면 흐름. 서버 응답은 가로채서 정합니다.
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

async function open(page: Page, width = 1440, height = 900, delayMs = 0) {
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
  server.fn("ai-assist", async (body, route) => {
    if (route.request().method() === "GET") return { models };
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return {
      runId: "run-1",
      candidates: [],
      answer: "**핵심만** 말씀드릴게요 [근거 1].\n\n- 첫째 확인\n- 둘째 확인",
      creditsUsed: 0.831,
      creditStatus: "settled",
      model: (body as { model?: string }).model,
    };
  });
  await page.goto(`/r/${RESEARCH_ID}/assistant`);
  await expect(page.locator("[data-kokonut-composer]")).toBeVisible();
  return { errors, server };
}
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

// 원본 데모의 내부 장식용 클래스 대신 접근 가능한 이름/역할로 실제 흐름을 검증합니다.
// 모바일 검증은 사용자 요청으로 후속 작업으로 남깁니다.
const composer = (page: Page) => page.locator("[data-kokonut-composer]");
const input = (page: Page) =>
  composer(page).getByRole("textbox", { name: "연구 도우미에게 질문" });

test("원본 입력창이 데스크톱 너비에서 넘치지 않는다", async ({ page }) => {
  const { errors } = await open(page);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(input(page)).toBeVisible();
    await expect(
      composer(page).getByRole("combobox", {
        name: /AI 모델 · Gemini 3.8 Flash/,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
    await shot(page, `kokonut-composer-${width}`);
  }
  expect(errors).toEqual([]);
});

test("원본 모델 메뉴에서 선택하고 추천 모델로 돌아온다", async ({ page }) => {
  const { errors } = await open(page);
  await composer(page)
    .getByRole("combobox", { name: /AI 모델 · Gemini 3.8 Flash/ })
    .click();
  await page.getByRole("option", { name: /Gemini 4 Carbon/ }).click();
  await expect(
    composer(page).getByRole("combobox", { name: /AI 모델 · Gemini 4 Carbon/ }),
  ).toBeVisible();
  await composer(page).getByRole("button", { name: "시도하기" }).click();
  const trigger = composer(page).getByRole("combobox", {
    name: /AI 모델 · Gemini 3.8 Flash/,
  });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("Enter로 보내면 비고 중단하면 질문이 복원된다", async ({ page }) => {
  const { errors } = await open(page, 1440, 900, 3000);
  await input(page).fill("이 연구의 핵심만 알려 줘");
  await input(page).press("Enter");
  await expect(input(page)).toHaveValue("");
  await composer(page)
    .getByRole("button", { name: "답변 중단", exact: true })
    .click();
  await expect(input(page)).toHaveValue("이 연구의 핵심만 알려 줘");
  expect(errors).toEqual([]);
});

test("슬래시 명령을 고르고 원본 검색 입력창에서 해제한다", async ({ page }) => {
  const { errors } = await open(page);
  await input(page).fill("/원고");
  await expect(page.getByRole("option", { name: /원고 검토/ })).toBeVisible();
  await input(page).press("Enter");
  await expect(
    composer(page).getByRole("button", { name: "원고 검토 선택 해제" }),
  ).toBeVisible();
  await expect(input(page)).toHaveValue("");
  await composer(page)
    .getByRole("button", { name: "원고 검토 선택 해제" })
    .click();
  await expect(
    composer(page).getByRole("button", { name: "원고 검토 선택 해제" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("대기 질문이 원본 대기 줄에 쌓여 순서대로 전송된다", async ({ page }) => {
  const { errors } = await open(page, 1440, 900, 1500);
  await input(page).fill("첫 번째 질문");
  await input(page).press("Enter");
  await input(page).fill("두 번째 대기 질문");
  await input(page).press("Enter");
  await expect(
    composer(page).getByText("두 번째 대기 질문", { exact: true }),
  ).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: "대기 줄에서 삭제" }),
  ).toBeVisible();
  await expect(page.locator(".ai-message.user")).toHaveCount(2, {
    timeout: 10000,
  });
  await expect(
    composer(page).getByRole("button", { name: "대기 줄에서 삭제" }),
  ).toHaveCount(0);
  await expect(composer(page)).toContainText("내 잔액");
  await expect(
    composer(page).getByRole("button", { name: "사용 내역" }),
  ).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: /보내는 내용 .* 자세히 보기/ }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("다크 모드에서 원본 모델 메뉴가 열린다", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const { errors } = await open(page);
  await composer(page)
    .getByRole("combobox", { name: /AI 모델 · Gemini 3.8 Flash/ })
    .click();
  await expect(
    page.getByRole("option", { name: /Gemini 4 Carbon/ }),
  ).toBeVisible();
  await shot(page, "kokonut-dark-selector");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("AI 기본 설정에서 원본 선택기의 모델과 답변 깊이를 바꾼다", async ({
  page,
}) => {
  const { errors } = await open(page);
  await page.goto("/account?tab=ai");
  const trigger = page.getByRole("button", { name: /AI 모델 · Gemini/ });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(
    page
      .getByRole("radiogroup", { name: "AI 모델", exact: true })
      .getByRole("radio"),
  ).toHaveCount(4);
  await page.getByRole("radio", { name: /Gemini 4 Carbon/ }).click();
  await expect(trigger).toHaveAccessibleName(/Gemini 4 Carbon/);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("입력 검증에 실패해도 적은 질문을 잃지 않는다", async ({ page }) => {
  const { server } = await open(page);
  await input(page).fill("/원고");
  await input(page).press("Enter");
  await input(page).fill("이 원고의 논리를 점검해 줘");
  await input(page).press("Enter");
  await expect(input(page)).toHaveValue("이 원고의 논리를 점검해 줘");
  expect(
    server.calls.filter(
      (call) =>
        call.name === "ai-assist" && (call.body as { mode?: string })?.mode,
    ),
  ).toHaveLength(0);
});

test("입력창 너비·크기 조절과 접힌 프로필이 원본 스타일을 침범하지 않는다", async ({
  page,
}) => {
  await open(page);
  await expect(input(page)).toHaveCSS("resize", "none");
  const size = await composer(page).boundingBox();
  expect(size!.width).toBeLessThanOrEqual(760);
  await expect(
    composer(page).getByRole("button", { name: "연구 기록 고르기" }),
  ).toHaveCount(0);
  const trigger = page.locator(".sidebar-collapsed .kokonut-profile-trigger");
  if (await trigger.count()) {
    const box = await trigger.boundingBox();
    expect(box!.width).toBe(40);
    expect(box!.height).toBe(40);
  }
});
