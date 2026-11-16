import { afterEach, expect, it, vi } from "vitest";
const researchId = "11111111-1111-4111-8111-111111111111",
  runId = "22222222-2222-4222-8222-222222222222";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
async function endpoint(calendar = false) {
  let handler: (request: Request) => Promise<Response>;
  const calls: { url: string; body: any; headers: Headers }[] = [];
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) =>
        (
          ({
            SUPABASE_URL: "https://test.supabase.co",
            SUPABASE_ANON_KEY: "public-key",
            SUPABASE_SERVICE_ROLE_KEY: "server-key",
            GEMINI_API_KEY: "test-google-key",
            GEMINI_PROVIDER: "vertex",
            GEMINI_PROJECT_ID: "project",
          }) as Record<string, string>
        )[key],
    },
    serve: (fn: any) => {
      handler = fn;
    },
  });
  vi.stubGlobal("fetch", async (input: any, init: any = {}) => {
    const url = String(input),
      body = init.body ? JSON.parse(init.body) : undefined,
      headers = new Headers(init.headers);
    calls.push({ url, body, headers });
    if (url.endsWith("/auth/v1/user"))
      return Response.json({
        id: "33333333-3333-4333-8333-333333333333",
        email_confirmed_at: "2026-01-01",
        user_metadata: {
          preferences: { instructions: "PRIVATE INSTRUCTIONS" },
        },
      });
    if (url.includes("/rpc/"))
      return Response.json(url.endsWith("rms_ai_begin_v2") ? runId : true);
    if (url.includes("/rms_ai_credit_ledger"))
      return Response.json([{ amount: -14.1 }]);
    if (url.includes("/rms_researches"))
      return Response.json([
        { data: { name: "PRIVATE RESEARCH", purpose: "PRIVATE PURPOSE" } },
      ]);
    if (url.includes("/rms_records"))
      return Response.json(
        calendar
          ? [
              {
                id: "44444444-4444-4444-8444-444444444444",
                kind: "meetings",
                data: {
                  title: "미팅",
                  date: "2026-11-20",
                  time: "14:00",
                  status: "preparing",
                },
              },
            ]
          : [],
      );
    if (url.includes("aiplatform.googleapis.com"))
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: calendar
                    ? '\u007b"answer":"11월 20일 14:00에 미팅이 있어요 [근거 1]."\u007d'
                    : "공식 표준이에요.",
                },
              ],
            },
            groundingMetadata: {
              webSearchQueries: ["official standard"],
              groundingChunks: [
                {
                  web: { uri: "https://www.w3.org/TR/WCAG22/", title: "WCAG" },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 10,
          totalTokenCount: 20,
        },
      });
    throw new Error("Unexpected route: " + url);
  });
  await import("./index.ts");
  return { handler: handler!, calls };
}
it("uses the real Google tool and never sends research/profile/history in a web request", async () => {
  const { handler, calls } = await endpoint();
  const response = await handler(
    new Request("https://test.supabase.co/functions/v1/ai-assist", {
      method: "POST",
      headers: {
        Authorization: "Bearer user-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "ask_research",
        researchId,
        clientRunId: runId,
        question: "공식 표준을 검색해 줘",
        sourceText: "",
        webSearch: true,
      }),
    }),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.webGrounding.sources).toHaveLength(1);
  expect(result.answer).toContain("공식 표준");
  const provider = calls.find((call) =>
    call.url.includes("aiplatform.googleapis.com"),
  )!;
  expect(provider.body.tools).toEqual([{ googleSearch: {} }]);
  expect(JSON.stringify(provider.body)).not.toContain("PRIVATE");
  expect(provider.body.generationConfig.responseSchema).toBeUndefined();
  expect(calls.some((call) => call.url.includes("/rms_researches"))).toBe(
    false,
  );
  const finish = calls.find((call) => call.url.endsWith("rms_ai_finish_v2"))!;
  expect(finish.body.p_contexts).toEqual([]);
  expect(finish.body.p_output.webGrounding.sources).toHaveLength(1);
});
it("loads calendar through the caller's RLS token and returns actual source snapshots", async () => {
  const { handler, calls } = await endpoint(true);
  const response = await handler(
    new Request("https://test.supabase.co/functions/v1/ai-assist", {
      method: "POST",
      headers: {
        Authorization: "Bearer user-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "ask_research",
        researchId,
        clientRunId: runId,
        question: "다음 일정은?",
        sourceText: "",
        calendar: true,
        history: [{ role: "user", text: "PRIVATE HISTORY" }],
      }),
    }),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.contexts[0].text).toContain("2026-11-20");
  const records = calls.find((call) => call.url.includes("/rms_records"))!;
  expect(records.headers.get("Authorization")).toBe("Bearer user-token");
  expect(records.headers.get("apikey")).toBe("public-key");
  const provider = calls.find((call) =>
    call.url.includes("aiplatform.googleapis.com"),
  )!;
  expect(JSON.stringify(provider.body)).not.toContain("PRIVATE");
  expect(provider.body.tools).toBeUndefined();
  expect(provider.body.generationConfig.responseSchema).toBeDefined();
});
