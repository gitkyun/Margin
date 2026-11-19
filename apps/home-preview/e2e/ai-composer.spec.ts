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
    // 연구 도우미는 사이드 창이라 폭마다 다시 엽니다(밀기 ↔ 겹치기가 바뀌면 겹친 창은 닫힘).
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/r/${RESEARCH_ID}/assistant`);
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

test("아이콘 줄의 연구 도우미는 사이드 창 안에서 묻고 답한다(IA v2 06 §2.1)", async ({
  page,
}) => {
  const { errors } = await open(page, 1440, 900, 0, `/r/${RESEARCH_ID}`);
  const rail = page.getByRole("toolbar", { name: "옆 창 열기" });
  const button = rail.getByRole("button", { name: "연구 도우미" });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const panel = page.locator(".assistant-side-panel");
  await expect(panel).toBeVisible();
  const panelInput = panel
    .locator("[data-kokonut-composer]")
    .getByRole("textbox", { name: "연구 도우미에게 질문" });
  await expect(panelInput).toBeVisible();
  // 빈 대화의 첫 화면은 지금 화면(홈, 남은 할 일 있음)에 맞춰 권합니다(06 §2.6).
  await expect(
    panel.getByRole("button", { name: "이번 주 할 일 정리하기" }),
  ).toBeVisible();
  await shot(page, "rail-assistant-panel");

  await panelInput.fill("이 연구의 핵심만 알려 줘");
  await panelInput.press("Enter");
  // 화면을 옮기지 않고 창 안에서 답을 받습니다.
  await expect(panel.getByText("핵심만").first()).toBeVisible();
  await expect(
    panel.getByText("이 연구의 핵심만 알려 줘").first(),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}$`));
  // 사이드 창이 312px 기본 폭이어도 입력창이 화면 밖으로 넘치지 않습니다(06 완료 기준 ③).
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);

  // 창에는 [전체 화면으로 열기]가 없습니다(연구 도우미 화면은 이 창으로 바뀜, 01 §3.3).
  await expect(
    panel.getByRole("button", { name: "전체 화면으로 열기" }),
  ).toHaveCount(0);
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
  // 요약할 파일이 하나도 없으면 AI를 부르지 않고 질문을 남긴다.
  await input(page).fill("/논문");
  await input(page).press("Enter");
  await input(page).fill("이 논문을 요약해 줘");
  await input(page).press("Enter");
  await expect(page.getByText(/요약할 파일이 없어요/)).toBeVisible();
  await expect(input(page)).toHaveValue("이 논문을 요약해 줘");
  expect(
    server.calls.filter(
      (call) =>
        call.name === "ai-assist" && (call.body as { mode?: string })?.mode,
    ),
  ).toHaveLength(0);
});

test("기록을 고르지 않아도 원고 검토 요청을 서버로 보낸다", async ({
  page,
}) => {
  const { server } = await open(page);
  await input(page).fill("/원고");
  await input(page).press("Enter");
  await input(page).fill("이 원고의 논리를 점검해 줘");
  await input(page).press("Enter");
  await expect
    .poll(
      () =>
        server.calls.find(
          (call) =>
            call.name === "ai-assist" &&
            (call.body as { mode?: string })?.mode === "review_writing",
        )?.body,
    )
    .toMatchObject({ mode: "review_writing", contexts: [] });
  await expect(page.getByRole("tab", { name: "근거" })).toHaveCount(0);
});

test("입력창 너비·크기 조절과 접힌 프로필이 원본 스타일을 침범하지 않는다", async ({
  page,
}) => {
  await open(page);
  await expect(input(page)).toHaveCSS("resize", "none");
  const size = await composer(page).boundingBox();
  expect(size!.width).toBeLessThanOrEqual(760);
  // IA v2 상단 줄의 계정 버튼은 아바타만 보이는 작은 버튼이에요(02 §3.6).
  const trigger = page.locator(".ia-topbar .kokonut-profile-trigger");
  if (await trigger.count()) {
    const box = await trigger.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(40);
    expect(box!.height).toBeLessThanOrEqual(40);
  }
});

test("웹 검색은 질문만 보내고 실제 반환된 웹 출처를 표시한다", async ({
  page,
}) => {
  const { errors, server } = await open(page);
  server.fn("ai-assist", async (_body, route) => {
    if (route.request().method() === "GET") return { models };
    return {
      runId: "web-run",
      candidates: [],
      model: models[0].id,
      answer: "웹에서 확인한 연구예요.",
      webGrounding: {
        sources: [
          { url: "https://example.org/research", title: "공개 연구 문서" },
        ],
        citations: [
          {
            startIndex: 0,
            endIndex: "웹에서 확인한 연구예요.".length,
            sourceIndices: [0],
          },
        ],
        queries: ["공개 연구 동향"],
        searchEntryPointHtml:
          '<a href="https://www.google.com/search?q=research">Google</a>',
      },
    };
  });
  await composer(page).getByRole("button", { name: "웹 검색 켜기" }).click();
  await expect(
    composer(page).getByRole("button", { name: "파일 첨부" }),
  ).toHaveCount(0);
  await input(page).fill("최근 연구 동향을 확인해 줘");
  await shot(page, "web-search-input");
  await input(page).press("Enter");
  await expect(page.getByLabel("웹 검색 답변", { exact: true })).toBeVisible();
  const request = server.calls.find(
    (call) =>
      call.name === "ai-assist" &&
      (call.body as { webSearch?: boolean })?.webSearch,
  )?.body;
  expect(request).toMatchObject({
    mode: "ask_research",
    webSearch: true,
    contexts: [],
    history: [],
    question: "최근 연구 동향을 확인해 줘",
  });
  await page.getByRole("button", { name: "근거 1개", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /공개 연구 문서/ }),
  ).toHaveAttribute("href", "https://example.org/research");
  await expect(page.getByTitle("Google 검색 추천")).toHaveAttribute(
    "sandbox",
    "allow-popups allow-popups-to-escape-sandbox",
  );
  await shot(page, "web-search-sources");
  expect(
    errors.filter(
      (error) =>
        !error.startsWith("Blocked script execution in 'about:srcdoc'"),
    ),
  ).toEqual([]);
});

test("웹 검색을 해제하면 기존 질문 입력으로 돌아오고 실패한 검색 질문은 남는다", async ({
  page,
}) => {
  const { server } = await open(page);
  await input(page).fill("지우면 안 되는 질문");
  await composer(page).getByRole("button", { name: "웹 검색 켜기" }).click();
  await expect(input(page)).toHaveValue("지우면 안 되는 질문");
  await composer(page)
    .getByRole("button", { name: "웹 검색 선택 해제" })
    .click();
  await expect(
    composer(page).getByRole("button", { name: "웹 검색 켜기" }),
  ).toBeVisible();
  await expect(input(page)).toHaveValue("지우면 안 되는 질문");
  await composer(page).getByRole("button", { name: "웹 검색 켜기" }).click();
  server.fn("ai-assist", async (_body, route) =>
    route.request().method() === "GET"
      ? { models }
      : {
          error: {
            message: "검색 연결을 확인해 주세요.",
            code: "PROVIDER_ERROR",
          },
          status: 502,
        },
  );
  await input(page).press("Enter");
  await expect(input(page)).toHaveValue("지우면 안 되는 질문");
});

test("슬래시에서 실제 연결된 여덟 기능을 고르고 일정 요청을 실행한다", async ({
  page,
}) => {
  const { server } = await open(page);
  await input(page).fill("/");
  for (const name of [
    "미팅 정리",
    "수정 방법",
    "원고 검토",
    "할 일 정리",
    "논문·자료 요약",
    "초안 쓰기",
    "웹 검색",
    "일정 확인",
  ]) {
    await expect(
      page.getByRole("option", { name: new RegExp("^" + name) }),
    ).toBeVisible();
  }
  await page.getByRole("option", { name: /일정 확인/ }).click();
  await input(page).fill("이번 주 미팅과 마감을 알려 줘");
  await input(page).press("Enter");
  await expect(page.locator(".ai-message.assistant")).toHaveCount(1);
  expect(
    server.calls.find(
      (call) =>
        call.name === "ai-assist" &&
        (call.body as { calendar?: boolean })?.calendar,
    )?.body,
  ).toMatchObject({ mode: "ask_research", calendar: true, webSearch: false });
});

test("기존 PDF 전체 본문을 다시 추출하고 보낸 첨부와 후속 질문의 기록 연결을 관리한다", async ({
  page,
}) => {
  const { server } = await open(page);
  let attachment = {
    id: "00000000-0000-4000-8000-000000000031",
    researchId: RESEARCH_ID,
    ownerId: OWNER.id,
    title: "전체본문검증.pdf",
    fileName: "전체본문검증.pdf",
    storagePath: `${OWNER.id}/${RESEARCH_ID}/existing.pdf`,
    mimeType: "application/pdf",
    size: 5000,
    text: "기존에 표지만 읽은 내용",
    visibility: "private",
    createdAt: "2026-11-16T00:00:00Z",
    updatedAt: "2026-11-16T00:00:00Z",
  } as Record<string, unknown>;
  const saves: { p_kind: string; p_value: Record<string, unknown> }[] = [];
  server.rpc("rms_bootstrap", () => ({
    ...WORKSPACE,
    attachments: [attachment],
  }));
  server.rpc("rms_save_record", (body) => {
    const saved = body as { p_kind: string; p_value: Record<string, unknown> };
    saves.push(saved);
    if (saved.p_kind === "attachments") attachment = saved.p_value;
    return saved.p_value;
  });
  const pdf = await readFile(
    new URL("../public/demo/research-sample.pdf", import.meta.url),
  );
  await page.route(
    "https://margin-files.rlgus801-dad.workers.dev/**",
    (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "content-type": "application/pdf",
        },
        body: route.request().method() === "OPTIONS" ? "" : pdf,
      }),
  );
  await page.reload();
  // 기록을 고르지 않아도 자료 요약은 가장 최근에 올린 파일을 전체 본문으로 읽는다.
  await input(page).fill("/");
  await page.getByRole("option", { name: /^논문·자료 요약/ }).click();
  await input(page).fill("이 논문의 내용을 요약해 줘");
  await input(page).press("Enter");
  await expect
    .poll(() => saves.filter((save) => save.p_kind === "attachments").length)
    .toBe(1);
  expect(attachment.textExtractionVersion).toBe(2);
  expect(String(attachment.text)).not.toBe("기존에 표지만 읽은 내용");
  expect(String(attachment.text)).toMatch(/\[1쪽\]/);
  await expect(page.locator(".ai-message.assistant")).toHaveCount(1);
  await expect(
    composer(page).getByRole("group", { name: "첨부한 기록" }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".ai-message.user")
      .first()
      .getByRole("list", { name: "첨부한 파일" }),
  ).toContainText("전체본문검증.pdf");
  await expect(
    page.getByText("이 대화에서 참고하는 기록 1개", { exact: true }),
  ).toBeVisible();
  await shot(page, "pdf-sent-linked-sources");
  await input(page).fill("이 논문의 결과를 더 설명해 줘");
  await input(page).press("Enter");
  await expect(page.locator(".ai-message.assistant")).toHaveCount(2);
  const requests = () =>
    server.calls
      .filter(
        (call) =>
          call.name === "ai-assist" && (call.body as { mode?: string })?.mode,
      )
      .map((call) => call.body as { contexts: { id: string }[] });
  expect(requests()[1].contexts).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: attachment.id })]),
  );
  await page
    .getByRole("button", { name: "기록 연결 해제", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "기록 연결 해제", exact: true }),
  ).toHaveCount(0);
  await input(page).fill("자료 없이 일반적으로 설명해 줘");
  await input(page).press("Enter");
  await expect(page.locator(".ai-message.assistant")).toHaveCount(3);
  expect(requests()[2].contexts).toEqual([]);
  await expect(
    page
      .locator(".ai-message.user")
      .nth(2)
      .getByRole("list", { name: "첨부한 파일" }),
  ).toHaveCount(0);
});

test("기존 대화의 표지 PDF를 재선택 없이 전체 추출하고 실패하면 후속 질문을 유지한다", async ({
  page,
}) => {
  const { server } = await open(page);
  const timestamp = "2026-11-16T00:00:00Z";
  const attachment = {
    id: "00000000-0000-4000-8000-000000000032",
    researchId: RESEARCH_ID,
    ownerId: OWNER.id,
    title: "기존대화논문.pdf",
    fileName: "기존대화논문.pdf",
    storagePath: `${OWNER.id}/${RESEARCH_ID}/old-conversation.pdf`,
    mimeType: "application/pdf",
    size: 5000,
    text: "과거 표지 텍스트",
    visibility: "private",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const context = {
    kind: "attachments",
    id: attachment.id,
    title: attachment.title,
    text: attachment.text,
  };
  const oldConversation = {
    id: "00000000-0000-4000-8000-000000000033",
    researchId: RESEARCH_ID,
    ownerId: OWNER.id,
    title: "기존 논문 대화",
    createdAt: timestamp,
    updatedAt: timestamp,
    contexts: [context],
    messages: [
      {
        role: "user",
        text: "이 논문 요약",
        contexts: [context],
        createdAt: timestamp,
      },
      {
        role: "assistant",
        text: "과거 표지 요약",
        contexts: [context],
        createdAt: timestamp,
      },
    ],
  };
  const saves: { p_kind: string; p_value: Record<string, unknown> }[] = [];
  server.rpc("rms_bootstrap", () => ({
    ...WORKSPACE,
    attachments: [attachment],
    conversations: [oldConversation],
  }));
  server.rpc("rms_save_record", (body) => {
    const saved = body as (typeof saves)[number];
    saves.push(saved);
    return saved.p_value;
  });
  const pdf = await readFile(
    new URL("../public/demo/research-sample.pdf", import.meta.url),
  );
  let available = false;
  await page.route(
    "https://margin-files.rlgus801-dad.workers.dev/**",
    (route) =>
      route.fulfill({
        status: available ? 200 : 500,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "content-type": "application/pdf",
        },
        body:
          route.request().method() === "OPTIONS"
            ? ""
            : available
              ? pdf
              : "unavailable",
      }),
  );
  await page.reload();
  await page.getByRole("button", { name: /대화 기록/ }).click();
  await page.getByRole("menuitemradio", { name: "기존 논문 대화" }).click();
  await input(page).fill("이 논문의 결과를 본문으로 다시 요약해 줘");
  await input(page).press("Enter");
  await expect(
    page.getByText(/PDF 전체 본문을 준비하지 못했어요/),
  ).toBeVisible();
  await expect(input(page)).toHaveValue(
    "이 논문의 결과를 본문으로 다시 요약해 줘",
  );
  expect(
    server.calls.filter(
      (call) =>
        call.name === "ai-assist" && (call.body as { mode?: string })?.mode,
    ),
  ).toHaveLength(0);
  expect(saves).toHaveLength(0);
  available = true;
  await input(page).press("Enter");
  await expect(page.locator(".ai-message.assistant")).toHaveCount(2);
  const upgraded = saves.find((save) => save.p_kind === "attachments")?.p_value;
  expect(upgraded?.textExtractionVersion).toBe(2);
  expect(upgraded?.text).toMatch(/\[1쪽\]/);
  const request = server.calls.find(
    (call) =>
      call.name === "ai-assist" && (call.body as { mode?: string })?.mode,
  )?.body as { contexts: { text: string }[] };
  expect(request.contexts[0].text).toBe(upgraded?.text);
  const savedConversation = saves
    .filter((save) => save.p_kind === "conversations")
    .at(-1)?.p_value as typeof oldConversation;
  expect(savedConversation.messages[0].contexts[0].text).toBe(
    "과거 표지 텍스트",
  );
  expect(savedConversation.contexts[0].text).toBe(upgraded?.text);
});

test("초안 쓰기는 정해 둔 지시문을 붙여 보내고 답 아래 '이어서'로 입력창을 채운다(IA v2 06 §2.3·§2.4)", async ({
  page,
}) => {
  const { server, errors } = await open(page);
  await input(page).fill("/초안");
  await input(page).press("Enter");
  await expect(
    composer(page).getByRole("button", { name: "초안 쓰기 선택 해제" }),
  ).toBeVisible();
  await input(page).fill("서론 첫 문단");
  await input(page).press("Enter");
  await expect(page.locator(".ai-message.assistant")).toHaveCount(1);
  const body = server.calls.find(
    (call) => call.name === "ai-assist" && call.body,
  )?.body as { mode?: string; question?: string; webSearch?: boolean };
  expect(body).toMatchObject({ mode: "ask_research", webSearch: false });
  expect(body.question).toContain("글 초안을 써 줘");
  expect(body.question?.endsWith("요청: 서론 첫 문단")).toBe(true);
  // 대화에는 사용자가 쓴 요청만 남습니다.
  await expect(page.locator(".ai-message.user")).toContainText("서론 첫 문단");
  await expect(page.locator(".ai-message.user")).not.toContainText(
    "글 초안을 써 줘",
  );
  await expect(page.locator(".assistant-question-mode")).toHaveText(
    "초안 쓰기",
  );
  const next = page.getByRole("group", { name: "이어서" });
  await expect(next.getByRole("button")).toHaveText([
    "글로 저장",
    "더 짧게",
    "더 자세히",
  ]);
  await next.getByRole("button", { name: "더 짧게" }).click();
  await expect(input(page)).toHaveValue(
    "방금 초안을 핵심만 남겨 절반 길이로 줄여 줘",
  );
  await expect(
    composer(page).getByRole("button", { name: "초안 쓰기 선택 해제" }),
  ).toBeVisible();
  await next.getByRole("button", { name: "글로 저장" }).click();
  await expect(page.getByRole("dialog", { name: "글로 저장" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("예전 연구 도우미 주소는 화면을 옮기지 않고 사이드 창으로 연다(IA v2 01 §3.3)", async ({
  page,
}) => {
  const { errors } = await open(
    page,
    1440,
    900,
    0,
    `/r/${RESEARCH_ID}/assistant?tab=overview&mode=organize_meeting`,
  );
  // 홈 위에 창이 열리고, 주소에는 창을 여는 값이 남지 않습니다.
  await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}$`));
  const panel = page.locator(".assistant-side-panel");
  await expect(panel).toBeVisible();
  const views = panel.getByRole("tablist", { name: "연구 도우미 보기" });
  // 예전 제안 탭(tab=overview)은 창의 제안 보기로 엽니다.
  await expect(views.getByRole("tab", { name: "제안" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page
      .getByRole("toolbar", { name: "옆 창 열기" })
      .getByRole("button", { name: "연구 도우미" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("휴대폰 아래 탭의 연구 도우미는 화면을 옮기지 않고 창을 여닫는다(IA v2 02 §6)", async ({
  page,
}) => {
  const { errors } = await open(page, 390, 844, 0, `/r/${RESEARCH_ID}/tasks`);
  const tab = page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("button", { name: "연구 도우미" });
  await expect(tab).toHaveAttribute("aria-pressed", "false");
  await tab.click();
  await expect(tab).toHaveAttribute("aria-pressed", "true");
  const panel = page.locator(".assistant-side-panel");
  await expect(
    panel
      .locator("[data-kokonut-composer]")
      .getByRole("textbox", { name: "연구 도우미에게 질문" }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}/tasks$`));
  await shot(page, "mobile-tab-assistant");

  // 층(D16): 맨 위 세그먼트, 닫기(×)와 창 안 보기 줄은 없고 [⋯]가 대화 | 제안 | 실행 내역을 맡습니다.
  const layer = page.locator(".ia-layer-head");
  const segments = layer.getByRole("radiogroup", { name: "옆 창 보기" });
  await expect(segments.getByRole("radio")).toHaveText([
    "연구 도우미",
    "결정·질문",
    "자료",
  ]);
  await expect(
    panel.getByRole("button", { name: "연구 도우미 창 닫기" }),
  ).toBeHidden();
  await expect(
    panel.getByRole("tablist", { name: "연구 도우미 보기" }),
  ).toBeHidden();
  await layer.getByRole("button", { name: /^연구 도우미 보기/ }).click();
  await page.getByRole("menuitemradio", { name: "실행 내역" }).click();
  await expect(panel.getByText("아직 실행 내역이 없어요.")).toBeVisible();

  // 세그먼트를 바꾸고 뒤로 가기로 닫으면 화면은 그대로이고, 다시 열면 마지막 세그먼트로 열립니다.
  await segments.getByRole("radio", { name: "결정·질문" }).click();
  await expect(
    page.locator(".tasks-panel").filter({ hasText: "결정" }),
  ).toBeVisible();
  await page.goBack();
  await expect(tab).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}/tasks$`));
  await tab.click();
  await expect(
    segments.getByRole("radio", { name: "결정·질문" }),
  ).toHaveAttribute("aria-checked", "true");

  await tab.click();
  await expect(tab).toHaveAttribute("aria-pressed", "false");
  await expect(layer).toBeHidden();
  expect(errors).toEqual([]);
});

test("사이드 창의 대화 | 제안 | 실행 내역을 오가고, 실행 줄을 누르면 그 답으로 간다(IA v2 06 §2.1·§2.8)", async ({
  page,
}) => {
  const { server, errors } = await open(
    page,
    1440,
    900,
    0,
    `/r/${RESEARCH_ID}`,
  );
  const at = "2026-11-18T01:00:00.000Z";
  // 끝난 실행 둘: 하나는 답이 대화에 남아 있고(누를 수 있음), 하나는 갈 곳이 없습니다(누를 수 없음).
  server.rpc("rms_bootstrap", () => ({
    ...WORKSPACE,
    conversations: [
      {
        id: "conv-runs",
        researchId: RESEARCH_ID,
        createdAt: at,
        updatedAt: at,
        createdBy: OWNER.id,
        title: "지난 대화",
        contexts: [],
        messages: [
          { role: "user", text: "지난 질문", createdAt: at },
          {
            role: "assistant",
            text: "지난 답의 본문",
            createdAt: at,
            runId: "run-linked",
          },
        ],
      },
    ],
    aiRuns: [
      {
        id: "run-linked",
        researchId: RESEARCH_ID,
        userId: OWNER.id,
        mode: "ask_research",
        status: "complete",
        createdAt: at,
      },
      {
        id: "run-orphan",
        researchId: RESEARCH_ID,
        userId: OWNER.id,
        mode: "plan_research",
        status: "failed",
        createdAt: "2026-11-17T01:00:00.000Z",
      },
    ],
  }));
  // 쓴 크레딧은 정산 이력에 같은 실행이 있는 줄에만 보입니다(예약은 세지 않음).
  server.rpc("rms_ai_usage", () => ({
    ...credits,
    credits: {
      ...credits.credits,
      ledger: [
        {
          id: "ledger-charge",
          createdAt: at,
          amount: -1234.4,
          kind: "charge",
          runId: "run-linked",
        },
        {
          id: "ledger-reserve",
          createdAt: at,
          amount: -900,
          kind: "reserve",
          runId: "run-orphan",
        },
      ],
    },
  }));
  await page.reload();
  await page
    .getByRole("toolbar", { name: "옆 창 열기" })
    .getByRole("button", { name: "연구 도우미" })
    .click();
  const panel = page.locator(".assistant-side-panel");
  const views = panel.getByRole("tablist", { name: "연구 도우미 보기" });
  await expect(views.getByRole("tab")).toHaveText([
    "대화",
    "제안",
    "실행 내역",
  ]);
  const panelInput = panel
    .locator("[data-kokonut-composer]")
    .getByRole("textbox", { name: "연구 도우미에게 질문" });
  await panelInput.fill("쓰던 질문");

  // 제안·실행 내역을 보는 동안 입력창은 숨고, 돌아오면 쓰던 글이 그대로입니다.
  await views.getByRole("tab", { name: "제안" }).click();
  await expect(
    panel.getByText("AI 제안이 나오면 여기에 표시돼요."),
  ).toBeVisible();
  await expect(panelInput).toBeHidden();
  await views.getByRole("tab", { name: "실행 내역" }).click();
  await expect(panel.locator(".run-row")).toHaveCount(2);
  // 갈 곳이 있는 줄만 누를 수 있습니다.
  await expect(panel.locator(".run-row-link")).toHaveCount(1);
  await expect(panel.locator(".run-row-link")).toContainText("1,234크레딧");
  await expect(
    panel.locator(".run-row").filter({ hasText: "실패" }),
  ).not.toContainText("크레딧");
  await shot(page, "panel-views-runs");
  await views.getByRole("tab", { name: "대화" }).click();
  await expect(panelInput).toHaveValue("쓰던 질문");

  // 실행 줄을 누르면 그 답이 남은 대화로 바뀌고 대화 보기로 돌아옵니다.
  await views.getByRole("tab", { name: "실행 내역" }).click();
  await panel.locator(".run-row-link").click();
  await expect(views.getByRole("tab", { name: "대화" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel.getByText("지난 답의 본문")).toBeVisible();
  expect(errors).toEqual([]);
});

test("답 아래 [할 일 추가]는 할 일 제안을 펼치고 고른 줄만 할 일로 저장한다(IA v2 06 §2.4)", async ({
  page,
}) => {
  const { server, errors } = await open(page);
  server.fn("ai-assist", async (body, route) => {
    if (route.request().method() === "GET") return { models };
    return {
      runId: "run-tasks",
      candidates: [
        {
          title: "비교 기준을 좁히기",
          method: "비교표의 기준을 두 개로 줄여요.",
          suggestedTasks: [
            "비교표 기준 두 개로 줄이기",
            "교수님께 기준 확인하기",
          ],
        },
      ],
      creditsUsed: 0.5,
      creditStatus: "settled",
      model: (body as { model?: string }).model,
    };
  });
  await input(page).fill("/수정");
  await input(page).press("Enter");
  await input(page).fill("남은 피드백을 어떻게 고칠까?");
  await input(page).press("Enter");
  const answer = page.locator(".ai-message.assistant");
  await expect(answer).toHaveCount(1);
  const toggle = answer
    .getByRole("group", { name: "답변 동작" })
    .getByRole("button", { name: "할 일 추가" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // '이어서'의 할 일 추가도 같은 줄을 펼칩니다.
  await expect(
    page.getByRole("group", { name: "이어서" }).getByRole("button"),
  ).toHaveText(["할 일 추가", "초안 쓰기"]);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const list = page.getByRole("region", { name: "할 일 제안" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await list
    .getByRole("button", { name: "'비교표 기준 두 개로 줄이기' 할 일로 선택" })
    .click();
  await expect(list.getByText("추가함")).toHaveCount(1);
  const saves = server.calls
    .filter((call) => call.name === "rms_save_record")
    .map(
      (call) =>
        call.body as { p_kind: string; p_value: Record<string, unknown> },
    );
  const tasks = saves.filter((s) => s.p_kind === "tasks");
  expect(tasks).toHaveLength(1);
  expect(tasks[0].p_value).toMatchObject({
    title: "비교표 기준 두 개로 줄이기",
    origin: "ai",
    visibility: "private",
    status: "todo",
  });
  // 고르지 않은 줄은 할 일이 아니고, 대화에는 추가한 줄이 남습니다.
  const conversation = saves.filter((s) => s.p_kind === "conversations").at(-1)
    ?.p_value as { messages: { addedTasks?: unknown[] }[] };
  expect(conversation.messages.at(-1)?.addedTasks).toHaveLength(1);
  await expect(
    list.getByRole("button", { name: "'교수님께 기준 확인하기' 할 일로 선택" }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("미팅 정리 답 아래 [요약 저장]은 그 기록의 요약으로 저장하고 제안을 고른 것으로 남긴다(IA v2 06 §2.4)", async ({
  page,
}) => {
  const { server, errors } = await open(page);
  const meeting = WORKSPACE.meetings[0];
  let organized = false;
  const proposal = {
    id: "cand-summary",
    researchId: RESEARCH_ID,
    runId: "run-organize",
    mode: "organize_meeting",
    title: "요약",
    candidate: {
      title: "요약",
      category: "summary",
      body: "비교표 기준을 좁히기로 했어요.",
    },
    contexts: [{ kind: "meetings", id: meeting.id, title: meeting.title }],
    status: "pending",
    visibility: "private",
    createdBy: OWNER.id,
    updatedBy: OWNER.id,
    createdAt: "2026-11-18T00:00:00.000Z",
    updatedAt: "2026-11-18T00:00:00.000Z",
  };
  server.rpc("rms_bootstrap", () =>
    organized ? { ...WORKSPACE, aiCandidates: [proposal] } : WORKSPACE,
  );
  server.fn("ai-assist", async (body, route) => {
    if (route.request().method() === "GET") return { models };
    organized = true;
    return {
      runId: "run-organize",
      candidates: [proposal.candidate],
      creditsUsed: 0.5,
      creditStatus: "settled",
      model: (body as { model?: string }).model,
    };
  });
  await input(page).fill("/미팅");
  await input(page).press("Enter");
  await input(page).fill("지난 미팅 정리해 줘");
  await input(page).press("Enter");
  const actions = page
    .locator(".ai-message.assistant")
    .getByRole("group", { name: "답변 동작" });
  await actions.getByRole("button", { name: "요약 저장" }).click();
  await expect
    .poll(() =>
      server.calls
        .filter((call) => call.name === "rms_save_record")
        .map((call) => (call.body as { p_kind: string }).p_kind),
    )
    .toEqual(expect.arrayContaining(["meetings", "aiCandidates"]));
  const saves = server.calls
    .filter((call) => call.name === "rms_save_record")
    .map(
      (call) =>
        call.body as { p_kind: string; p_value: Record<string, unknown> },
    );
  expect(saves.find((s) => s.p_kind === "meetings")?.p_value).toMatchObject({
    id: meeting.id,
    summary: { text: "비교표 기준을 좁히기로 했어요.", runId: "run-organize" },
  });
  expect(saves.find((s) => s.p_kind === "aiCandidates")?.p_value).toMatchObject(
    { id: "cand-summary", status: "adopted" },
  );
  expect(errors).toEqual([]);
});

test("보고 있던 기록이 바뀌면 [다시 보내기]가 최신 판으로 같은 질문을 보낸다(IA v2 06 §2.2, 09 A7)", async ({
  page,
}) => {
  const meeting = WORKSPACE.meetings.find((m) => m.status === "recorded")!;
  const { server, errors } = await open(
    page,
    1440,
    900,
    0,
    `/r/${RESEARCH_ID}/meetings/${meeting.id}`,
  );
  // 첫 요청은 그 사이 메모가 바뀌어(판 1 → 2) 서버가 받지 않습니다. 화면은 다시 불러와 판 2를 압니다.
  let changed = false;
  server.rpc("rms_bootstrap", () =>
    changed
      ? {
          ...WORKSPACE,
          meetings: WORKSPACE.meetings.map((m) =>
            m.id === meeting.id ? { ...m, memoRevision: 2 } : m,
          ),
        }
      : WORKSPACE,
  );
  const sent: { contexts?: { kind: string; revision?: number }[] }[] = [];
  server.fn("ai-assist", async (body, route) => {
    if (route.request().method() === "GET") return { models };
    sent.push(body as (typeof sent)[number]);
    if (!changed) {
      changed = true;
      await route.fulfill({
        status: 409,
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          error: {
            code: "SOURCE_CHANGED",
            message: "자료가 변경되었습니다. 최신 내용을 다시 선택해 주세요.",
          },
        }),
      });
      return HANDLED;
    }
    return {
      runId: "run-fresh",
      candidates: [],
      answer: "최신 메모로 답했어요.",
      creditsUsed: 0.5,
      creditStatus: "settled",
      model: (body as { model?: string }).model,
    };
  });
  await page
    .getByRole("toolbar", { name: "옆 창 열기" })
    .getByRole("button", { name: "연구 도우미" })
    .click();
  const panel = page.locator(".assistant-side-panel");
  const panelInput = panel
    .locator("[data-kokonut-composer]")
    .getByRole("textbox", { name: "연구 도우미에게 질문" });
  await panelInput.fill("이 기록에서 남은 일은?");
  await panelInput.press("Enter");

  const alert = panel.getByRole("alert");
  await expect(alert).toContainText(
    "보고 있던 기록이 바뀌었어요. 최신 내용으로 다시 보낼까요?",
  );
  // 보낸 질문은 입력창에 그대로 돌아옵니다.
  await expect(panelInput).toHaveValue("이 기록에서 남은 일은?");
  await alert.getByRole("button", { name: "다시 보내기" }).click();
  await expect(panel.getByText("최신 메모로 답했어요.")).toBeVisible();
  expect(sent).toHaveLength(2);
  const meetingContext = (i: number) =>
    sent[i].contexts?.find((c) => c.kind === "meetings");
  expect(meetingContext(0)?.revision).toBe(1);
  expect(meetingContext(1)?.revision).toBe(2);
  // 같은 질문은 한 번만 남고, 그 메시지의 칩만 최신 판으로 바뀝니다.
  const saved = server.calls
    .filter((call) => call.name === "rms_save_record")
    .map(
      (call) =>
        (
          call.body as {
            p_kind: string;
            p_value: {
              messages?: {
                role: string;
                contexts?: { kind: string; revision?: number }[];
              }[];
            };
          }
        ).p_value,
    )
    .filter((value) => value.messages)
    .at(-1)!;
  const asked = saved.messages!.filter((m) => m.role === "user");
  expect(asked).toHaveLength(1);
  expect(asked[0].contexts?.find((c) => c.kind === "meetings")?.revision).toBe(
    2,
  );
  await expect(panelInput).toHaveValue("");
  expect(errors).toEqual([]);
});
