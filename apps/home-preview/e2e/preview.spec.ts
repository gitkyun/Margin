import { expect, test } from "@playwright/test";

// 미리보기 모드(서버 없이 가상 기록을 이 브라우저에만 저장)로 주요 화면이 열리고 이어지는지 봅니다.
const RESEARCH = "연구 도구 사용 경험";

test("내 연구에서 연구 홈으로 들어가 주요 메뉴를 오간다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/);
  const menu = page.getByRole("navigation", { name: "주요 메뉴" }).first();
  for (const [name, path, title] of [
    // IA v2 상단 메뉴 넷(docs/design/ia-v2/02-shell.md §3.1). 0단계에는 지금 화면을 그대로 띄워요.
    ["할 일", "/tasks", "할 일"],
    ["미팅", "/meetings", "미팅"],
    ["글·자료", "/docs", "글·자료"],
    ["홈", "", "홈"],
  ] as const) {
    // 미팅 메뉴는 새 교수 응답이 있으면 이름 뒤에 '새 응답 있음'이 붙어요(점의 화면 낭독 문구).
    await menu
      .getByRole("link", { name: new RegExp(`^${name}( 새 응답 있음)?$`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/r/[0-9a-f-]{36}${path}$`));
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(
      menu.getByRole("link", { name: new RegExp(`^${name}`) }),
    ).toHaveAttribute("aria-current", "page");
  }
  expect(errors).toEqual([]);
});

test("할 일 목록에 가상 연구의 할 일이 보인다", async ({ page }) => {
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .first()
    .getByRole("link", { name: "할 일", exact: true })
    .click();
  // 연구 홈에도 같은 제목의 링크가 있어서, 할 일 화면에 도착한 뒤 목록 행 안에서 찾아요.
  await expect(page).toHaveURL(/\/tasks$/);
  // IA v2 할 일 화면(T1)의 공통 줄(TaskRow)
  const rows = page.locator(".tasks-groups .task-line");
  await expect(
    rows.getByText("선행연구 비교 기준 정리", { exact: true }),
  ).toBeVisible();
  await expect(
    rows.getByText("인터뷰 질문지 보완", { exact: true }),
  ).toBeVisible();
});

test("할 일 추가는 예전 화면 없이 할 일 목록의 빠른 추가로, 한 건은 상세에서 다룬다(06 §6.3)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  const base = new URL(page.url()).pathname;

  // 예전 추가 주소는 `new=task`로 옮겨 빠른 추가 줄을 엽니다.
  await page.goto(`${base}/tasks?new=1`);
  const input = page.getByRole("textbox", { name: "새 할 일 제목" });
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/tasks$/);
  await input.fill("표 단위 맞추기");
  await input.press("Enter");
  const row = page
    .locator(".tasks-groups .task-line")
    .filter({ hasText: "표 단위 맞추기" });
  await expect(row).toBeVisible();

  // 예전 한 건 전체 화면 주소는 항목 상세로 엽니다.
  await page.goto(`${base}/tasks`);
  await page
    .locator(".tasks-groups .task-line")
    .getByText("선행연구 비교 기준 정리", { exact: true })
    .click();
  await expect(page).toHaveURL(/detail=task%3A/);
  const detailUrl = new URL(page.url());
  const taskId = decodeURIComponent(
    detailUrl.searchParams.get("detail") ?? "",
  ).slice("task:".length);
  await page.goto(`${base}/tasks/${taskId}?full=1`);
  await expect(page).toHaveURL(new RegExp(`/tasks\\?detail=task%3A${taskId}$`));
  const detail = page.getByRole("complementary", { name: "항목 상세" });
  const priority = detail.getByRole("combobox", { name: "우선순위" });
  await priority.selectOption({ label: "높음" });
  await expect(priority).toHaveValue("high");
  await expect(
    detail.getByRole("button", { name: "수정 결과 추가" }),
  ).toBeVisible();
});

test("미리보기에서는 공동연구자 설정이 열리고, 메일 초대 대신 기존 안내를 보여 준다", async ({
  page,
}) => {
  await page.goto("/r");
  await page.getByRole("link", { name: "연구 설정" }).first().click();
  // IA v2: 연구 설정은 그 연구 홈 위의 설정 창(`?settings=`)으로 열립니다.
  await expect(page).toHaveURL(/\/r\/[^/?]+\?settings=research$/);
  const dialog = page.getByRole("dialog", { name: "설정" });
  await dialog.getByRole("button", { name: "함께하는 사람" }).click();
  await expect(page).toHaveURL(/\?settings=people$/);
  await expect(dialog.getByLabel("공동연구자 이메일")).toBeVisible();
  await expect(page.getByText("이메일로 초대")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/settings=/);
  // 예전 주소는 새 주소로 넘어갑니다(01 §3.3).
  const base = new URL(page.url()).pathname;
  await page.goto(`${base}/settings?tab=lifecycle`);
  await expect(page).toHaveURL(new RegExp(`${base}\\?settings=danger$`));
  await page.goto(`${base}/settings?tab=아무값`);
  await expect(page).toHaveURL(new RegExp(`${base}\\?settings=research$`));
});

test("없는 주소는 404 안내를, 초대 수락 주소는 미리보기에서 가입 안내로 보낸다", async ({
  page,
}) => {
  await page.goto("/no-such-page");
  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없어요" }),
  ).toBeVisible();
  await page.goto("/join?token=anything");
  await expect(page).toHaveURL(/\/signup$/);
});

test("휴대폰 너비에서 내 연구 화면이 가로로 넘치지 않는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/r");
  await expect(page.getByText(RESEARCH).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("일정 단계는 키보드로 순서를 저장하고 편집·현재 단계 설정을 따로 실행한다", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/r");
  await page
    .getByRole("link", { name: new RegExp(RESEARCH) })
    .first()
    .click();
  const home = page.url();
  await page.goto(`${home}/planning`);
  await page
    .getByRole("button", { name: "기본 단계로 시작", exact: true })
    .click();
  const cards = page.locator(".roadmap-sortable .phase-card");
  await expect(cards).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "현재 단계로 설정", exact: true }).first(),
  ).toBeEnabled();
  const handle = page.getByRole("button", { name: /^연구 설계 끌어서 옮기기/ });
  await handle.press("Alt+ArrowUp");
  await expect(cards.nth(1).getByRole("heading")).toHaveText("연구 설계");
  await expect(handle).toBeEnabled();
  await page.reload();
  await expect(cards.nth(1).getByRole("heading")).toHaveText("연구 설계");
  await cards
    .nth(1)
    .getByRole("button", { name: "현재 단계로 설정", exact: true })
    .click();
  await expect(cards.nth(1)).toHaveClass(/is-current/);
  await expect(
    cards.nth(1).getByRole("button", { name: "현재 단계로 설정", exact: true }),
  ).toHaveCount(0);
  await cards
    .nth(1)
    .getByRole("button", { name: "연구 설계 단계 편집", exact: true })
    .click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("textbox", { name: /단계 이름/ }) });
  await dialog
    .getByRole("textbox", { name: /단계 이름/ })
    .fill("연구 설계 수정");
  await dialog.getByRole("button", { name: "단계 저장", exact: true }).click();
  await expect(cards.nth(1).getByRole("heading")).toHaveText("연구 설계 수정");
  await page.goto(home);
  await page
    .locator(".rh-phase-track")
    .getByRole("link", { name: /연구 설계 수정/ })
    .click();
  await expect(cards.nth(1)).toBeFocused();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      `${width}px 넘침`,
    ).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("연결이 끊기면 상단 띠 하나만 연결 끊김으로 바뀐다", async ({
  page,
  context,
}) => {
  await page.goto("/r");
  await page.getByRole("link", { name: "연구 설정" }).first().click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".preview-banner")).toHaveCount(1);
  await context.setOffline(true);
  await expect(
    page.getByText("인터넷 연결이 끊겼어요. 연결되면 다시 저장해 주세요."),
  ).toBeVisible();
  await expect(page.locator(".preview-banner")).toHaveCount(1);
  await context.setOffline(false);
  await expect(
    page.getByText("인터넷 연결이 끊겼어요.", { exact: false }),
  ).toHaveCount(0);
});

test("사이드 창을 전환하거나 닫아도 각 창에서 고른 보기가 남는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const rail = page.getByRole("toolbar", { name: "옆 창 열기" });
  const assistant = rail.getByRole("button", {
    name: "연구 도우미",
    exact: true,
  });
  const log = rail.getByRole("button", { name: "결정·질문", exact: true });
  const panel = page.locator("#margin-panel");
  // 미리보기에는 AI 모델이 없어 입력창이 꺼져 있으므로, 창 안에서 고른 탭으로 보존을 확인합니다.
  await assistant.click();
  const suggestions = panel.getByRole("tab", { name: "제안", exact: true });
  await suggestions.click();
  await expect(suggestions).toHaveAttribute("aria-selected", "true");
  await log.click();
  const questions = panel.getByRole("radio", { name: /^질문/ });
  await questions.click();
  await assistant.click();
  await expect(suggestions).toHaveAttribute("aria-selected", "true");
  await assistant.click();
  await expect(suggestions).toBeHidden();
  await log.click();
  await expect(questions).toHaveAttribute("aria-checked", "true");
  await assistant.click();
  await expect(suggestions).toHaveAttribute("aria-selected", "true");
});

test("글·자료 창에서 찾아 훑어보고, 준비 중인 미팅에 자료를 가져간다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  // 준비 중인 다음 미팅 화면 위에서 창을 엽니다(06 §5).
  await page.getByRole("link", { name: "기록 열기" }).first().click();
  await expect(page).toHaveURL(/\/meetings\/[^/]+$/);
  const rail = page.getByRole("toolbar", { name: "옆 창 열기" });
  await rail.getByRole("button", { name: "글·자료", exact: true }).click();
  const panel = page.locator("#margin-panel");
  const list = panel.locator(".materials-panel-rows");
  await expect(list.getByRole("button")).toHaveCount(2);
  const search = panel.getByRole("searchbox", { name: "글·자료에서 찾기" });
  await search.fill("계획서");
  await expect(list.getByRole("button")).toHaveCount(1);

  // 훑어보기: [열기]는 자료 보기로, 보여 줄 자료에 없는 자료는 [이 미팅에 가져가기]
  await list.getByRole("button", { name: /연구계획서/ }).click();
  const peek = panel.locator(".materials-peek");
  await expect(peek.getByRole("heading", { name: "연구계획서" })).toBeVisible();
  await expect(peek.getByRole("link", { name: "열기" })).toHaveAttribute(
    "href",
    /\/docs\/m\//,
  );
  const take = peek.getByRole("button", { name: "이 미팅에 가져가기" });
  await take.click();
  await expect(
    peek.getByRole("button", { name: "이 미팅에 가져갔어요" }),
  ).toBeDisabled();

  // [← 목록]으로 돌아오면 찾던 말이 남아 있습니다.
  await peek.getByRole("button", { name: "목록" }).click();
  await expect(search).toHaveValue("계획서");
  await search.fill("");
  // 이미 보여 줄 자료에 든 자료는 처음부터 가져간 상태입니다.
  await list.getByRole("button", { name: /선행연구 비교표/ }).click();
  await expect(
    peek.getByRole("button", { name: "이 미팅에 가져갔어요" }),
  ).toBeDisabled();
});

test("휴대폰 홈의 바로가기 줄은 층을 그 세그먼트로 열고 뒤로 가기로 닫는다(03 §1, 02 §6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const shortcuts = page.getByRole("navigation", { name: "바로가기" });
  await shortcuts.getByRole("link", { name: "자료" }).click();
  const tab = page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("button", { name: "연구 도우미" });
  await expect(tab).toHaveAttribute("aria-pressed", "true");
  const segments = page.getByRole("radiogroup", { name: "옆 창 보기" });
  await expect(segments.getByRole("radio", { name: "자료" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page).not.toHaveURL(/panel=/);
  await page.goBack();
  await expect(tab).toHaveAttribute("aria-pressed", "false");
  await expect(shortcuts).toBeVisible();
});

test("피드백 상세에서 수정 방법을 직접 쓰고, 할 일로 만들고, 선택을 취소했다가 다시 고른다(06 §6.2)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .first()
    .getByRole("link", { name: "할 일", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks$/);
  await page.getByRole("tab", { name: /피드백/ }).click();
  await page
    .getByRole("link", { name: /선행연구 비교 기준 보완/ })
    .first()
    .click();
  const detail = page.getByRole("complementary", { name: "항목 상세" });
  const plans = detail
    .locator(".item-detail-section")
    .filter({ has: page.getByRole("heading", { name: "수정 방법" }) });
  // 예전 피드백 화면으로 가는 통로 대신 상세 안에서 씁니다.
  await expect(
    detail.getByRole("link", { name: "수정 방법 쓰기·제안받기" }),
  ).toHaveCount(0);
  await plans.getByRole("button", { name: "직접 쓰기" }).click();
  const dialog = page.getByRole("dialog", { name: "수정 방법 작성" });
  await dialog.getByRole("textbox", { name: /제목/ }).fill("비교 기준 열 추가");
  await dialog
    .getByRole("textbox", { name: /어떻게 고칠지/ })
    .fill("표 2에 자료 수집 방법 열을 더한다");
  await dialog.getByRole("button", { name: "저장" }).click();
  const plan = plans.locator(".item-detail-plan").filter({
    hasText: "비교 기준 열 추가",
  });
  await expect(plan).toBeVisible();

  await plan.getByRole("button", { name: "할 일 추가" }).click();
  await expect(plan).toContainText("할 일 1개");
  await expect(
    detail.getByRole("checkbox", { name: /비교 기준 열 추가/ }),
  ).toBeVisible();

  await plan.getByRole("button", { name: "선택 취소" }).click();
  await expect(plans.getByText("선택 취소한 방법 1개")).toBeVisible();
  await plans.getByText("선택 취소한 방법 1개").click();
  await plans.getByRole("button", { name: "다시 선택" }).click();
  await expect(plan).toBeVisible();
});

test("예전 피드백 전체 화면 주소는 항목 상세로 연다", async ({ page }) => {
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const base = new URL(page.url()).pathname;
  await page.goto(`${base}/feedback/missing-id?full=1`);
  await expect(page).toHaveURL(
    /\/tasks\?view=feedback&detail=feedback%3Amissing-id$/,
  );
});

test("피드백 입력은 예전 화면으로 가지 않고 그 자리의 창에서 쓰고, 저장하면 상세가 열린다(01 §3.3)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const base = new URL(page.url()).pathname;

  // 예전 입력 주소는 연구 홈 위의 창으로 옮겨 열립니다.
  await page.goto(`${base}/feedback?new=1`);
  const dialog = page.getByRole("dialog", { name: "피드백 직접 추가" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toBeHidden();

  // 할 일 화면 피드백 보기의 [피드백 추가]는 그 화면 위에서 창을 엽니다.
  await page.goto(`${base}/tasks?view=feedback`);
  await page
    .getByRole("main")
    .getByRole("link", { name: "피드백 추가" })
    .click();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/tasks\?view=feedback$/);
  await dialog.getByRole("textbox", { name: /제목/ }).fill("표 단위 맞추기");
  await dialog
    .getByRole("textbox", { name: /피드백 내용/ })
    .fill("표 2와 표 3의 단위를 같게 적어 주세요.");
  await dialog.getByRole("button", { name: /저장/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/detail=feedback%3A/);
  await expect(
    page.getByText("표 2와 표 3의 단위를 같게 적어 주세요.").first(),
  ).toBeVisible();
});

test("수정 결과는 예전 화면으로 가지 않고 그 자리의 창에서 쓰고 고친다(06 §6.6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const base = new URL(page.url()).pathname;

  // ⌘K '수정 결과 작성'과 같은 주소: 지금 화면(홈) 위에서 창이 열리고, 저장하면 그 상세가 열립니다.
  await page.goto(`${base}?new=result`);
  const dialog = page.getByRole("dialog", { name: "수정 결과 작성" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await dialog.getByRole("textbox", { name: /제목/ }).fill("비교표 연도 열");
  await dialog
    .getByRole("textbox", { name: /수정한 내용/ })
    .fill("비교표에 연도 열을 더했어요");
  await dialog.getByRole("button", { name: /저장/ }).click();
  const detail = page.getByRole("complementary", { name: "항목 상세" });
  await expect(
    detail.getByRole("textbox", { name: "수정 결과 제목" }),
  ).toHaveValue("비교표 연도 열");
  await expect(page).toHaveURL(/detail=result/);

  // 상세의 [편집]은 수정 결과 대화상자를 상세 위에서 엽니다.
  await detail.getByRole("button", { name: "편집" }).click();
  await expect(
    page.getByRole("dialog", { name: "수정 결과 편집" }),
  ).toBeVisible();
});

test("예전 수정 결과 목록은 미팅의 검토 보기에 있는 수정 결과 구획으로 열린다(04 §2.4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const base = new URL(page.url()).pathname;
  await page.goto(`${base}/results`);
  await expect(page).toHaveURL(new RegExp(`${base}/meetings\\?type=review$`));
  const section = page.locator(".record-results");
  await expect(
    section.getByRole("button", { name: /수정 결과 \d+개/ }),
  ).toBeVisible();
  const views = section.getByRole("radiogroup", { name: "수정 결과 보기" });
  await views.getByRole("radio", { name: "요청에 포함" }).click();
  await section.getByRole("button", { name: /선행연구 비교표 보완/ }).click();
  await expect(
    page
      .getByRole("complementary", { name: "항목 상세" })
      .getByRole("textbox", { name: "수정 결과 제목" }),
  ).toHaveValue("선행연구 비교표 보완");
});

test("검토 요청은 예전 화면으로 가지 않고 그 자리의 창에서 만든다(01 §3.3)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/r");
  await page
    .getByRole("link", { name: /연구 도구 사용 경험/ })
    .first()
    .click();
  const base = new URL(page.url()).pathname;
  // 예전 만들기 주소(피드백 상세의 '교수에게 보내기'와 같은 꼴)는 미팅 검토 보기 위의 창으로 엽니다.
  await page.goto(`${base}/reviews?new=1`);
  await expect(page).toHaveURL(new RegExp(`${base}/meetings\\?type=review$`));
  const dialog = page.getByRole("dialog", { name: "검토 요청 만들기" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "검토 요청 제목" })
    .fill("비교표 검토");
  await dialog
    .locator(".review-pick-row")
    .filter({ hasText: "선행연구 비교표 보완" })
    .getByRole("checkbox")
    .click();
  await dialog.getByRole("button", { name: /공유할 내용 확인/ }).click();
  await page.getByRole("button", { name: /검토 링크 만들기/ }).click();
  await expect(page).toHaveURL(/\/reviews\/[^/?]+/);
});
