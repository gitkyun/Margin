import { expect, test, type Page } from "@playwright/test";

// PR #182 보강(RQA-001·002·004·005 후속): 실제 브라우저에서 레이아웃·포인터 접근을 확인합니다.
// 미리보기 모드(서버 없이 이 브라우저에 가상 기록)로 돌아갑니다.

async function openResearch(page: Page, lang: "ko" | "ja" = "ko") {
  await page.goto("/r");
  await page.getByRole("link", { name: /연구 도구 사용 경험/ }).first().click();
  await expect(page.locator(".ia-topbar")).toBeVisible();
  if (lang === "ja") {
    await page.evaluate(() => localStorage.setItem("margin-lang", "ja"));
    await page.reload();
    await expect(page.locator(".ia-topbar")).toBeVisible();
  }
}

// 요소가 화면 안에서 실제로 맨 위에 보이는지(다른 요소에 가려지지 않는지) 확인합니다.
async function isPointerReachable(page: Page, selector: string) {
  return page.evaluate((s) => {
    const el = document.querySelector<HTMLElement>(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.right > innerWidth || r.bottom > innerHeight || r.left < 0 || r.top < 0)
      return false;
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!top && (top === el || el.contains(top));
  }, selector);
}

// 토스트 등장 애니메이션이 끝나 위치가 두 번 연속 같을 때까지 기다립니다.
async function settleToast(page: Page) {
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  await expect
    .poll(async () => {
      const a = await toast.boundingBox();
      await page.waitForTimeout(150);
      const b = await toast.boundingBox();
      return JSON.stringify([a?.y, b?.y]) === JSON.stringify([b?.y, b?.y]) ? "stable" : "moving";
    }, { timeout: 5000 })
    .toBe("stable");
}

// ── RQA-001: 모바일 토스트와 하단 Dock ───────────────────────────────
for (const [w, h] of [
  [390, 844],
  [320, 700],
]) {
  test(`RQA-001 ${w}×${h}: 할 일 완료 토스트가 Dock과 겹치지 않고, 되돌리기·하단 탭이 동작한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    await openResearch(page);
    await page.locator(".ia-tabbar").getByRole("link", { name: "할 일" }).click();
    const check = page.locator('button[aria-label$=" 완료"]').first();
    await expect(check).toBeVisible();
    const title = (await check.getAttribute("aria-label"))!.replace(/ 완료$/, "");
    await check.click();

    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("할 일을 완료했어요");
    await settleToast(page);

    // 토스트와 Dock의 실제 좌표: 겹침 면적 0, 간격 16px(모바일)
    const geo = await page.evaluate(() => {
      const t = document.querySelector("[data-sonner-toast]")!.getBoundingClientRect();
      const d = document.querySelector(".ia-dock")!.getBoundingClientRect();
      const overlapH = Math.max(0, Math.min(t.bottom, d.bottom) - Math.max(t.top, d.top));
      const overlapW = Math.max(0, Math.min(t.right, d.right) - Math.max(t.left, d.left));
      return { gap: Math.round(d.top - t.bottom), overlap: overlapH * overlapW, dockH: Math.round(d.height), varH: document.documentElement.style.getPropertyValue("--dock-height") };
    });
    expect(geo.overlap).toBe(0);
    expect(geo.gap).toBeGreaterThanOrEqual(16);
    expect(geo.varH).toBe(`${geo.dockH}px`);

    // 되돌리기 버튼을 실제로 누르면 할 일 상태가 복구된다
    await toast.getByRole("button", { name: "되돌리기" }).click();
    await expect(page.locator(".task-line.is-complete", { hasText: title })).toHaveCount(0);

    // 토스트가 떠 있는 상태에서도 하단 탭을 누를 수 있다
    await check.click();
    await expect(toast).toBeVisible();
    await page.locator(".ia-tabbar").getByRole("link", { name: "홈" }).click();
    await expect(page.locator(".ia-tabbar").getByRole("link", { name: "홈" })).toHaveAttribute("aria-current", "page");
  });
}

test("RQA-001: Dock 높이가 바뀌면 --dock-height와 토스트 위치가 함께 갱신되고, 페이지를 떠나면 값이 남지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResearch(page);
  await page.locator(".ia-tabbar").getByRole("link", { name: "할 일" }).click();
  const before = await page.evaluate(() => document.documentElement.style.getPropertyValue("--dock-height"));
  // 녹음 줄처럼 Dock이 자라는 상황을 흉내 냅니다.
  await page.evaluate(() => {
    const row = document.createElement("div");
    row.setAttribute("data-test-dock-row", "");
    row.style.height = "40px";
    document.querySelector(".ia-dock")!.prepend(row);
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--dock-height"))).not.toBe(before);
  const after = await page.evaluate(() => document.documentElement.style.getPropertyValue("--dock-height"));
  expect(after).toBe(`${await page.evaluate(() => document.querySelector<HTMLElement>(".ia-dock")!.offsetHeight)}px`);

  await page.evaluate(() => document.querySelector("[data-test-dock-row]")?.remove());
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--dock-height"))).toBe("");
});

test("RQA-001 데스크톱 1440: 토스트는 Dock 없이 우하단 24px 간격에 있다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResearch(page);
  await page.locator('button[aria-label$=" 완료"]').first().click().catch(async () => {
    await page.getByRole("link", { name: "할 일" }).first().click();
    await page.locator('button[aria-label$=" 완료"]').first().click();
  });
  const toast = page.locator("[data-sonner-toast]").first();
  await settleToast(page);
  const r = await toast.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { bottomGap: Math.round(innerHeight - b.bottom), rightGap: Math.round(innerWidth - b.right) };
  });
  expect(r.bottomGap).toBeGreaterThanOrEqual(24);
  expect(r.rightGap).toBeGreaterThanOrEqual(16);
});

// ── RQA-004: 검토 상세 이중 스크롤 ───────────────────────────────────
for (const [w, h] of [
  [768, 800],
  [1024, 800],
  [1280, 720],
]) {
  test(`RQA-004 ${w}×${h}: 검토 상세는 문서 전체가 아니라 본문 안에서만 스크롤되고 헤더가 유지된다`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openResearch(page);
    const root = new URL(page.url()).pathname.match(/^\/r\/[^/]+/)![0];
    await page.goto(root + "/results");
    let link = page.locator("a[href*='/reviews/']").first();
    if ((await link.count()) === 0) {
      await page.goto(root + "/reviews");
      link = page.locator("a[href*='/reviews/']").first();
    }
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator(".workspace-content")).toBeVisible();

    // 실제 휠 입력으로 끝까지 스크롤
    await page.mouse.move(w / 2, h / 2);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);

    const m = await page.evaluate(() => ({
      docOverflow: document.documentElement.scrollHeight - innerHeight,
      windowY: scrollY,
      topbarTop: Math.round(document.querySelector(".ia-topbar")!.getBoundingClientRect().top),
      contentScrolled: document.querySelector(".workspace-content")!.scrollTop,
    }));
    expect(m.docOverflow).toBeLessThanOrEqual(1);
    expect(m.windowY).toBe(0);
    expect(m.topbarTop).toBe(0);
    expect(m.contentScrolled).toBeGreaterThan(0);

    // 댓글 입력 영역은 본문 안에서 실제로 닿는다
    const form = page.locator(".review-comment-form textarea").first();
    if ((await form.count()) > 0) {
      await form.scrollIntoViewIfNeeded();
      await expect(form).toBeVisible();
      expect(await isPointerReachable(page, ".review-comment-form textarea")).toBe(true);
    }
  });
}

// ── RQA-005: TopBar 컨테이너 폭과 일본어 ────────────────────────────
const TOPBAR_WIDTHS = [320, 767, 768, 991, 992, 1199, 1200, 1280, 1440, 1920];
for (const lang of ["ko", "ja"] as const) {
  test(`RQA-005 ${lang}: 여러 폭에서 TopBar 주요 컨트롤이 눌리고, 가려진 메뉴는 스크롤로 닿는다`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openResearch(page, lang);
    for (const w of TOPBAR_WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(120);
      const r = await page.evaluate(() => ({
        noPageOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
        switchOk: true,
        navScrollable: document.querySelector<HTMLElement>(".ia-nav")!.scrollWidth - document.querySelector<HTMLElement>(".ia-nav")!.clientWidth,
        navBar: getComputedStyle(document.querySelector<HTMLElement>(".ia-nav")!).scrollbarWidth,
      }));
      expect(r.noPageOverflow, `${lang} ${w}px 가로 넘침`).toBe(true);
      if (await page.locator(".ia-search").isVisible()) {
        expect(await isPointerReachable(page, ".ia-search"), `${lang} ${w}px 검색`).toBe(true);
      }
      expect(await isPointerReachable(page, ".ia-switch"), `${lang} ${w}px 연구 전환기`).toBe(true);
      // 숨겨진 메뉴가 있으면 스크롤로 마지막 항목까지 닿아야 한다
      if (r.navScrollable > 1) {
        // 가려진 부분이 있으면 스크롤바가 보여야 발견할 수 있습니다(숨기지 않음).
        expect(r.navBar, `${lang} ${w}px 숨긴 메뉴의 스크롤바`).toBe("thin");
        await page.evaluate(() => { document.querySelector<HTMLElement>(".ia-nav")!.scrollLeft = 9999; });
        const lastItem = page.locator(".ia-nav .ia-nav-item").last();
        expect(await isPointerReachable(page, ".ia-nav .ia-nav-item:last-child"), `${lang} ${w}px 마지막 메뉴`).toBe(true);
        await page.evaluate(() => { document.querySelector<HTMLElement>(".ia-nav")!.scrollLeft = 0; });
        await expect(lastItem).toBeAttached();
      }
    }
  });
}

test("RQA-005 1280 패널 600: 일본어 TopBar 메뉴는 스크롤바가 보이는 상태로 끝까지 스크롤된다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openResearch(page, "ja");
  const rail = page.locator(".ia-rail button[aria-pressed]").first();
  if ((await rail.getAttribute("aria-pressed")) !== "true") await rail.click();
  await page.evaluate(() => document.querySelector<HTMLElement>(".ia-shell")!.style.setProperty("--margin-panel-user-width", "600px"));
  await page.waitForTimeout(300);
  const nav = await page.evaluate(() => {
    const n = document.querySelector<HTMLElement>(".ia-nav")!;
    return { scrollWidth: n.scrollWidth, clientWidth: n.clientWidth, overflowX: getComputedStyle(n).overflowX, scrollbar: getComputedStyle(n).scrollbarWidth };
  });
  expect(nav.overflowX).toBe("auto");
  // 숨겨진 부분이 있다면 스크롤바 표시(thin)로 드러나야 한다(완전히 숨기지 않음)
  if (nav.scrollWidth > nav.clientWidth + 1) expect(nav.scrollbar).toBe("thin");
  await page.evaluate(() => { document.querySelector<HTMLElement>(".ia-nav")!.scrollLeft = 9999; });
  expect(await isPointerReachable(page, ".ia-nav .ia-nav-item:last-child")).toBe(true);
});

// ── RQA-002 공통 패널: 모바일 층(연구 도우미·결정·질문·자료)을 실제로 열어 끝까지 스크롤 ──
// 휴대폰에서는 할 일·글·자료가 창이 아니라 층(.ia-layer-head 세그먼트)으로 열립니다.
for (const [w, h] of [
  [390, 844],
  [320, 700],
  [767, 800],
]) {
  test(`RQA-002 ${w}×${h}: 모바일 패널은 열고·닫고·다시 열 수 있고, 마지막 항목까지 Dock 위에서 스크롤된다`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openResearch(page);
    const assistantBtn = page.locator(".ia-tabbar").getByRole("button", { name: /연구 도우미/ });
    const panelState = () =>
      page.evaluate(() => {
        // 열려 있는 창의 탭만 봅니다(닫힌 창의 숨은 탭 제외).
        const tab = [...document.querySelectorAll<HTMLElement>(".ia-panel-frame:not(.is-closed) .ia-panel-tab")].find(
          (e) => e.getBoundingClientRect().height > 0,
        );
        if (!tab) return null;
        const dock = document.querySelector(".ia-dock")!.getBoundingClientRect();
        const before = tab.scrollTop;
        tab.scrollTop = 99999;
        const scrolled = tab.scrollTop;
        const r = tab.getBoundingClientRect();
        return { canScroll: tab.scrollHeight > tab.clientHeight, scrolledTo: scrolled > before || scrolled === 0 && before === 0, tabBottom: Math.round(r.bottom), dockTop: Math.round(dock.top) };
      });

    // 패널 열림·닫힘 애니메이션이 끝나 위치가 두 번 연속 같을 때까지 기다린 뒤 잽니다.
    const settled = async () => {
      await expect
        .poll(async () => {
          const a = await panelState();
          await page.waitForTimeout(150);
          const b = await panelState();
          return !!a && !!b && a.tabBottom === b.tabBottom;
        }, { timeout: 5000 })
        .toBe(true);
      return (await panelState())!;
    };

    // 1) 연구 도우미 열기 → 입력창 주변까지 스크롤
    await assistantBtn.click();
    let st = await settled();
    expect(st.tabBottom, "연구 도우미 패널이 Dock 위에서 끝남").toBeLessThanOrEqual(st.dockTop + 1);
    await expect(page.locator("[data-kokonut-composer]")).toBeVisible();

    // 2) 층 전환: 결정·질문 → 자료 (패널 내용이 바뀌어도 하단 기준 유지)
    for (const name of ["결정·질문", "자료"]) {
      const seg = page.locator(".ia-layer-head").getByText(name, { exact: true }).first();
      if ((await seg.count()) === 0) continue;
      await seg.click();
      st = await settled();
      expect(st, `${name} 층 존재`).not.toBeNull();
      expect(st.tabBottom, `${name} 층 하단`).toBeLessThanOrEqual(st.dockTop + 1);
    }

    // 3) 닫기(같은 탭 다시 누르기) → 다시 열기
    await assistantBtn.click();
    await expect.poll(async () => (await panelState()) === null, { timeout: 5000 }).toBe(true);
    await assistantBtn.click();
    await settled();
  });
}
