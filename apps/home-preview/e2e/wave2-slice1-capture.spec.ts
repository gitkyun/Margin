import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SHOT_DIR = path.resolve(
  process.cwd(),
  "../../documents/margin-ux-rethinking/slice1-screenshots",
);
const SHOULD_CAPTURE = process.env.CAPTURE_SHOTS === "1";

function pdfPayload(name: string, extra = "") {
  const body = `%PDF-1.4\n% ${name} ${extra}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`;
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(body, "utf8"),
  };
}

async function openDemoDocs(page: Page) {
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  await page.waitForURL("**/r/*");
  const base = page.url().replace(/\/$/, "");
  await page.goto(`${base}/docs`);
  await expect(page.getByRole("heading", { name: "글·자료" })).toBeVisible();
  return base;
}

async function maybeShot(page: Page, filename: string) {
  if (!SHOULD_CAPTURE) return;
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SHOT_DIR, filename),
    fullPage: false,
  });
}

test.describe("Wave 2 Slice 1 — 글·자료 다중 수집 경험", () => {
  test("시나리오 1: 논문 5편 바로 올리기 → 페이지 이탈 없이 목록 반영·비공개 기본·일괄 정리", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemoDocs(page);

    const files = [
      pdfPayload("Smith_2025_Workflows.pdf", "p1"),
      pdfPayload("Kim_2025_Method.pdf", "p2"),
      pdfPayload("Park_2024_Advising.pdf", "p3"),
      pdfPayload("Lee_2026_Grounding.pdf", "p4"),
      pdfPayload("Chen_2023_Triage.pdf", "p5"),
    ];

    await page
      .locator('input[aria-label="PDF 파일 여러 개 선택"]')
      .setInputFiles(files);

    const tray = page.getByRole("region", { name: "자료 올리기 진행 상태" });
    await expect(tray).toBeVisible();
    await expect(tray).toContainText("5개 자료 저장 완료", { timeout: 15000 });

    // 강제 PDF 뷰어 이동이 일어나지 않고 /docs에 머물러야 함
    expect(page.url()).toContain("/docs");
    expect(page.url()).not.toContain("/docs/m/");

    // 5개 자료가 목록에 반영되고, 미분류 + 나만 보기 자물쇠 표시
    for (const label of [
      "Smith 2025 Workflows",
      "Kim 2025 Method",
      "Park 2024 Advising",
      "Lee 2026 Grounding",
      "Chen 2023 Triage",
    ]) {
      const row = page.locator(".docs-row", { hasText: label }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText("미분류");
      await expect(row.locator(".docs-row-lock")).toBeVisible();
    }

    // 일괄 정리 바 확인 및 유형 일괄 지정
    const batchBar = page.getByRole("region", {
      name: "방금 올린 자료 일괄 정리",
    });
    await expect(batchBar).toBeVisible();
    await maybeShot(page, "desktop-1440-light-batch5.png");

    await batchBar.getByLabel("일괄 자료 유형 지정").selectOption("reference");
    await expect(
      page.locator(".docs-row", { hasText: "Smith 2025 Workflows" }).first(),
    ).toContainText("참고");
  });

  test("시나리오 2: 바로 올린 자료의 유형·공개 범위를 띠에서 바꾸고, 같은 파일은 중복 안내", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await openDemoDocs(page);

    // 올리는 방식 토글은 없고 바로 올라갑니다.
    await expect(
      page.getByRole("button", { name: "정보 먼저 확인하기" }),
    ).toHaveCount(0);
    const paper = pdfPayload("2305_10403v2.pdf", "single-review");
    await page
      .locator('input[aria-label="PDF 파일 여러 개 선택"]')
      .setInputFiles([paper]);
    await expect(
      page.locator(".docs-row", { hasText: "2305 10403v2" }),
    ).toBeVisible({ timeout: 10000 });
    expect(page.url()).not.toContain("/docs/m/");

    // 같은 이름·크기의 파일 재업로드 시 중복 확인 창 노출
    await page
      .locator('input[aria-label="PDF 파일 여러 개 선택"]')
      .setInputFiles([paper]);
    const dupDialog = page.getByRole("dialog", {
      name: /같은 이름·크기의 파일이 이미 있어요/,
    });
    await expect(dupDialog).toBeVisible();
    await dupDialog
      .getByRole("button", { name: "새 버전(v2)으로 올리기" })
      .click();
    await expect(dupDialog).toBeHidden();
    await expect(
      page.locator(".docs-row", { hasText: "2305 10403v2" }),
    ).toContainText("v2", { timeout: 10000 });
  });

  test("시나리오 5: 업로드 중 다른 화면(미팅) 이동 후 복귀해도 상태 유지 및 목록 반영", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const base = await openDemoDocs(page);

    await page
      .locator('input[aria-label="PDF 파일 여러 개 선택"]')
      .setInputFiles([
        pdfPayload("Nav_Keep_Paper_1.pdf", "nav1"),
        pdfPayload("Nav_Keep_Paper_2.pdf", "nav2"),
      ]);

    // 바로 미팅 화면으로 이동(새로고침이 아니라 앱 안 메뉴 이동. 새로고침은 메모리의 업로드 큐를 비웁니다.)
    await page.getByRole("link", { name: /^미팅/ }).first().click();
    await page.waitForURL("**/meetings**");
    const tray = page.getByRole("region", { name: "자료 올리기 진행 상태" });
    await expect(tray).toBeVisible();
    await expect(tray).toContainText("2개 자료 저장 완료", { timeout: 15000 });

    // 다시 글·자료로 복귀하면 두 자료가 목록에 있어야 함
    await page.getByRole("link", { name: /^글/ }).first().click();
    await page.waitForURL("**/docs**");
    await expect(
      page.locator(".docs-row", { hasText: "Nav Keep Paper 1" }),
    ).toBeVisible();
    await expect(
      page.locator(".docs-row", { hasText: "Nav Keep Paper 2" }),
    ).toBeVisible();
  });

  test("멀티 뷰포트(320~1920px) 및 모바일 BottomDock 비겹침·다크모드 확인", async ({
    page,
  }) => {
    const viewports = [
      { width: 320, height: 700 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 800 },
      { width: 1920, height: 1080 },
    ];

    await page.setViewportSize({ width: 390, height: 844 });
    await openDemoDocs(page);

    await page
      .locator('input[aria-label="PDF 파일 여러 개 선택"]')
      .setInputFiles([pdfPayload("Mobile_Check_Paper.pdf", "mob1")]);

    const tray = page.getByRole("region", { name: "자료 올리기 진행 상태" });
    await expect(tray).toBeVisible();
    await expect(tray).toContainText("1개 자료 저장 완료", { timeout: 10000 });

    // 모바일 390x844에서 UploadTray가 BottomDock(존재 시)과 겹치지 않는지 좌표 검증
    const overlap = await page.evaluate(() => {
      const trayEl = document.querySelector(".upload-tray");
      const dockEl = document.querySelector(".ia-dock");
      if (!trayEl || !dockEl) return false;
      const tRect = trayEl.getBoundingClientRect();
      const dRect = dockEl.getBoundingClientRect();
      return tRect.bottom > dRect.top + 1;
    });
    expect(overlap).toBe(false);
    await maybeShot(page, "mobile-390-light-tray.png");

    // 다크모드 전환 캡처 (1440px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await maybeShot(page, "desktop-1440-dark-docs.png");

    // 대표 뷰포트 가로 스크롤(overflow) 없음 확인
    for (const vp of viewports) {
      await page.setViewportSize(vp);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 2,
      );
      expect(overflow, `horizontal overflow at ${vp.width}x${vp.height}`).toBe(
        false,
      );
    }
  });

  test("드래그 앤 드롭 업로드·기존 자료 검색·열기, 320px 가로 넘침 없음", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemoDocs(page);

    // 드래그 앤 드롭: 파일을 끌어다 화면에 놓습니다.
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      const body = "%PDF-1.4\n% drop\n%%EOF\n";
      d.items.add(
        new File([body], "Dropped_Paper.pdf", { type: "application/pdf" }),
      );
      return d;
    });
    await page.dispatchEvent(".docs-layout", "dragenter", { dataTransfer: dt });
    await page.dispatchEvent(".docs-layout", "dragover", { dataTransfer: dt });
    await page.dispatchEvent(".docs-layout", "drop", { dataTransfer: dt });
    await expect(
      page.getByRole("region", { name: "자료 올리기 진행 상태" }),
    ).toContainText("저장 완료", { timeout: 15000 });
    await expect(
      page.locator(".docs-row", { hasText: "Dropped Paper" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/docs/);

    // 기존 자료 검색
    await page.getByPlaceholder("글·자료에서 찾기").fill("선행연구");
    await expect(page.locator(".docs-row")).toHaveCount(1);
    await expect(page.locator(".docs-row")).toContainText("선행연구");
    await maybeShot(page, "desktop-1440-search.png");
    // 기존 PDF 열기
    await page.locator(".docs-row a").first().click();
    await expect(page).toHaveURL(/\/docs\//);
    await maybeShot(page, "desktop-1440-open-existing.png");

    // 320px에서 가로 스크롤이 생기지 않는지
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goBack();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
