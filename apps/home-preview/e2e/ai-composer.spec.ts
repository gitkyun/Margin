import { readFile } from "node:fs/promises";
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

  // [전체 화면으로 열기]는 같은 대화를 연구 도우미 화면에서 이어 봅니다.
  await panel.getByRole("button", { name: "전체 화면으로 열기" }).click();
  await expect(page).toHaveURL(new RegExp(`/r/${RESEARCH_ID}/assistant$`));
  await expect(panel).toBeHidden();
  await expect(
    page.getByText("이 연구의 핵심만 알려 줘").first(),
  ).toBeVisible();
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

test("슬래시에서 실제 연결된 일곱 기능을 고르고 일정 요청을 실행한다", async ({
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
