import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  HANDLED,
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

async function open(
  page: Page,
  width = 1440,
  height = 900,
  delayMs = 0,
  path = `/r/${RESEARCH_ID}/assistant`,
) {
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
  await page.goto(path);
  if (path.endsWith("/assistant"))
    await expect(page.locator("[data-kokonut-composer]")).toBeVisible();
  return { errors, server };
}

// 휴대폰 AI 패널 컴포저: 포인터로 실제 누를 수 있는지, 여러 줄·짧은 화면에서도 접근되는지 봅니다.
// 연결 모드(가짜 서버)에서 실제 전송까지 확인합니다. 미리보기 모드는 전송이 막혀 있어 여기서 다룹니다.
const composerRoot = (page: Page) => page.locator("[data-kokonut-composer]");
const reachable = (page: Page, locatorText: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return "missing";
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return "hidden";
    if (r.bottom > innerHeight || r.top < 0) return "offscreen";
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return top && (top === el || el.contains(top)) ? "ok" : "covered";
  }, locatorText);

for (const [w, h] of [[390, 844], [320, 700], [390, 500]]) {
  test(`RQA-002 ${w}×${h}: 컴포저는 Dock 위에 있고 첨부·모델·전송을 포인터로 누를 수 있다`, async ({ page }) => {
    await open(page, w, h);
    const comp = composerRoot(page);
    await expect(comp).toBeVisible();
    const g = await page.evaluate(() => {
      const c = document.querySelector("[data-kokonut-composer]")!.getBoundingClientRect();
      const d = document.querySelector(".ia-dock")!.getBoundingClientRect();
      return { compBottom: Math.round(c.bottom), dockTop: Math.round(d.top) };
    });
    expect(g.compBottom, "컴포저 하단이 Dock 아래로 내려감").toBeLessThanOrEqual(g.dockTop);
    const attach = "[data-kokonut-composer] button[aria-label='첨부 및 입력 도구 열기']";
    const model = "[data-kokonut-composer] [role='combobox'][aria-label^='AI 모델']";
    const send = "[data-kokonut-composer] button[aria-label='질문 보내기']";
    expect(await reachable(page, attach)).toBe("ok");
    expect(await reachable(page, send)).toBe("ok");
    await comp.getByRole("combobox", { name: /AI 모델/ }).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await reachable(page, model)).toBe("ok");
  });

  test(`RQA-002 ${w}×${h}: 여러 줄 입력 후에도 전송 버튼이 닿고 실제로 보내진다`, async ({ page }) => {
    await open(page, w, h);
    const box = composerRoot(page).getByRole("textbox", { name: "연구 도우미에게 질문" });
    await box.fill("첫 줄 질문입니다\n둘째 줄\n셋째 줄");
    await expect.poll(async () => box.evaluate((el) => (el as HTMLTextAreaElement).value.split("\n").length)).toBe(3);
    const sendSel = "[data-kokonut-composer] button[aria-label='질문 보내기']";
    await expect.poll(() => reachable(page, sendSel)).toBe("ok");
    const pt = await page.evaluate((s) => {
      const b = document.querySelector<HTMLElement>(s)!.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, sendSel);
    await page.mouse.click(pt.x, pt.y);
    await expect(page.getByText("핵심만")).toBeVisible({ timeout: 5000 });
    // 입력 내용이 비워졌는지(전송 완료 신호)
    await expect(box).toHaveValue("");
  });
}
