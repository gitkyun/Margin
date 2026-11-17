import { expect, test, type Page } from "@playwright/test";

// 대화상자 배치 규칙(docs/design/patterns.md §2-2, styles.css "대화상자 틀")을 미리보기 모드에서 봅니다.
// 버튼 줄 위 24 이상, 버튼 줄 오른쪽 끝 = 본문 오른쪽 끝, 버튼 사이 8, 뷰포트 안, 버튼 줄 아래 글자 없음.
const RESEARCH = "연구 도구 사용 경험";

async function openResearch(page: Page) {
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/);
  return page.url();
}

const cases: {
  name: string;
  open(page: Page): Promise<void>;
}[] = [
  {
    name: "휴지통 확인",
    async open(page) {
      await page.goto("/r");
      await page
        .getByRole("button", { name: new RegExp(`${RESEARCH} 더보기`) })
        .click();
      await page
        .getByRole("menuitemradio", { name: "휴지통으로 옮기기" })
        .click();
    },
  },
  {
    name: "미팅 만들기",
    async open(page) {
      // IA v2 미팅 화면은 기록 목록의 [+ 새 기록] 메뉴와 홈에서 `?new=1`로 엽니다.
      await page.goto(`${await openResearch(page)}/meetings?new=1`);
    },
  },
  {
    name: "서면 피드백 붙여넣기",
    async open(page) {
      await page.goto(`${await openResearch(page)}/meetings?new=written`);
    },
  },
  // 피드백 추가(`/feedback?new=1`)는 main(IA v2 1단계)에서 창이 열리자마자 `new`를 지운 주소가
  // 할 일 화면으로 다시 이동해 창이 닫힙니다. 고친 뒤 이 자리에 다시 넣습니다.
  {
    name: "자료 등록",
    async open(page) {
      await page.goto(`${await openResearch(page)}/materials`);
      await page
        .getByRole("button", { name: "자료 등록", exact: true })
        .first()
        .click();
    },
  },
  {
    name: "폴더 만들기",
    async open(page) {
      await page.goto(`${await openResearch(page)}/materials`);
      await page
        .getByRole("button", { name: "폴더 만들기", exact: true })
        .first()
        .click();
    },
  },
];

for (const width of [390, 1440]) {
  for (const item of cases) {
    test(`${width}px · ${item.name} 대화상자의 버튼 줄이 규칙대로 놓인다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await item.open(page);
      const footer = page.locator('[data-slot="dialog-footer"]').last();
      await expect(footer).toBeVisible();
      // 시트·팝업이 올라오는 움직임이 끝난 뒤 잽니다(대화상자 위치가 두 프레임 연속 같을 때).
      await expect
        .poll(() =>
          footer.evaluate(
            (node) =>
              new Promise<boolean>((resolve) => {
                const dialog = node.closest('[data-slot="dialog-content"]')!;
                const first = dialog.getBoundingClientRect().top;
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    resolve(dialog.getBoundingClientRect().top === first),
                  ),
                );
              }),
          ),
        )
        .toBe(true);
      const m = await footer.evaluate((footerNode) => {
        const dialog = footerNode.closest('[data-slot="dialog-content"]')!;
        const frame = dialog.querySelector(".margin-dialog")!;
        const style = getComputedStyle(frame);
        const frameRect = frame.getBoundingClientRect();
        const contentRight = frameRect.right - parseFloat(style.paddingRight);
        const buttons = [...footerNode.children].map((b) =>
          b.getBoundingClientRect(),
        );
        const top = Math.min(...buttons.map((b) => b.top));
        const bottom = Math.max(...buttons.map((b) => b.bottom));
        const body = frame.querySelector('[data-slot="dialog-body"]');
        const bodyRect = body?.getBoundingClientRect();
        let above = -Infinity;
        const below: string[] = [];
        for (const el of frame.querySelectorAll("*")) {
          if (footerNode.contains(el) || el.contains(footerNode)) continue;
          if (el.closest(".margin-dialog-close")) continue;
          const isLeaf =
            el.children.length === 0 ||
            ["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(el.tagName);
          if (!isLeaf) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.bottom <= top + 0.5) {
            // 본문이 스크롤되면 본문 칸의 아래 가장자리까지만 셉니다.
            const visibleBottom =
              bodyRect && body!.contains(el)
                ? Math.min(r.bottom, bodyRect.bottom - 4)
                : r.bottom;
            above = Math.max(above, visibleBottom);
          } else if (r.top >= bottom - 0.5 && el.textContent?.trim())
            below.push(el.textContent.trim());
        }
        const d = dialog.getBoundingClientRect();
        return {
          gapAbove: top - above,
          rightOffset: Math.abs(
            contentRight - buttons[buttons.length - 1].right,
          ),
          gaps: buttons.slice(1).map((b, i) => b.left - buttons[i].right),
          inViewport:
            d.left >= 0 &&
            d.top >= 0 &&
            d.right <= innerWidth + 0.5 &&
            d.bottom <= innerHeight + 0.5,
          below,
          count: buttons.length,
        };
      });
      expect(m.count).toBeGreaterThanOrEqual(2);
      expect(m.gapAbove).toBeGreaterThanOrEqual(23.5);
      expect(m.rightOffset).toBeLessThanOrEqual(1);
      for (const gap of m.gaps)
        expect(Math.abs(gap - 8)).toBeLessThanOrEqual(1);
      expect(m.inViewport).toBe(true);
      expect(m.below).toEqual([]);
    });
  }
}
