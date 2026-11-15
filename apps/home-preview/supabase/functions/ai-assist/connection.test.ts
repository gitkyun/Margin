import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
let handle: (request: Request) => Promise<Response>;
const sent: { url: string; body: any; headers: Headers }[] = [];
const rpcCalls: { name: string; body: any }[] = [];
const ids = [
  "gemini-3.8-flash",
  "gemini-4-hydrogen",
  "gemini-4-carbon",
  "gemini-4-argon",
];
const env: Record<string, string> = {
  SUPABASE_URL: "https://backend.example.test",
  SUPABASE_ANON_KEY: "public-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "server-test-key",
  GEMINI_API_KEY: "google-test-key",
  GEMINI_PROVIDER: "vertex",
  GEMINI_PROJECT_ID: "test-project",
};
const researchId = "11111111-1111-4111-8111-111111111111";
const headers = {
  Authorization: "Bearer user-test-token",
  "Content-Type": "application/json",
};
const usage = {
  promptTokenCount: 100,
  candidatesTokenCount: 20,
  thoughtsTokenCount: 5,
};
const googleOk = (text = '{"answer":"OK"}', metadata: unknown = usage) =>
  Response.json({
    candidates: [{ content: { parts: text ? [{ text }] : [] } }],
    ...(metadata ? { usageMetadata: metadata } : {}),
  });
const rpcFailure = (code: string) =>
  Response.json({ code, message: "synthetic" }, { status: 500 });
let googleReply: () => Response = () => googleOk();
let rpcReply: (name: string) => Response | undefined = () => undefined;
const rpcNamed = (name: string) => rpcCalls.filter((c) => c.name === name);
const post = (model = "gemini-3.8-flash") =>
  handle(
    new Request("https://function.example.test", {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: "ask_research",
        researchId,
        clientRunId: crypto.randomUUID(),
        question: "Reply OK",
        model,
        thinking: "low",
      }),
    }),
  );
beforeAll(async () => {
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (handler: typeof handle) => {
      handle = handler;
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith("/auth/v1/user"))
        return Response.json({
          id: researchId,
          email_confirmed_at: "2026-11-15",
        });
      if (url.includes("/rpc/")) {
        const name = url.split("/rpc/")[1];
        rpcCalls.push({ name, body: JSON.parse(String(init.body)) });
        return (
          rpcReply(name) ??
          Response.json(name === "rms_ai_begin_v2" ? crypto.randomUUID() : true)
        );
      }
      if (url.includes("/rms_researches?"))
        return Response.json([{ data: { name: "Synthetic test" } }]);
      if (url.startsWith("https://aiplatform.googleapis.com/")) {
        sent.push({
          url,
          body: JSON.parse(String(init.body)),
          headers: new Headers(init.headers),
        });
        return googleReply();
      }
      throw Error("Unexpected request");
    }),
  );
  await import("./index");
});
beforeEach(() => {
  sent.length = 0;
  rpcCalls.length = 0;
  googleReply = () => googleOk();
  rpcReply = () => undefined;
});
afterAll(() => vi.unstubAllGlobals());
it("requires authentication before exposing models", async () => {
  expect(
    (await handle(new Request("https://function.example.test"))).status,
  ).toBe(401);
});
it("routes four Google models with the server key and settles actual usage", async () => {
  for (const model of ids) {
    rpcCalls.length = 0;
    const r = await post(model);
    expect(r.status, model).toBe(200);
    const result = await r.json();
    expect(result).toMatchObject({
      answer: "OK",
      model,
      creditStatus: "settled",
    });
    expect(result.creditsUsed).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("test-token");
    const request = sent.at(-1)!;
    expect(request.url).toContain("/locations/global/");
    expect(request.headers.get("x-goog-api-key")).toBe(env.GEMINI_API_KEY);
    const reserve = rpcNamed("rms_ai_reserve_credits").at(-1)!;
    const settle = rpcNamed("rms_ai_settle_credits").at(-1)!;
    expect(reserve.body.p_amount).toBeGreaterThan(settle.body.p_amount);
    expect(settle.body.p_refund).toBe(false);
  }
});
it("rejects untrusted model and invalid effort before Google or credit reservation", async () => {
  for (const [model, thinking] of [
    ["unknown", "low"],
    ["gemini-3.8-flash", "minimal"],
  ])
    expect(
      (
        await handle(
          new Request("https://function.example.test", {
            method: "POST",
            headers,
            body: JSON.stringify({
              mode: "ask_research",
              researchId,
              clientRunId: crypto.randomUUID(),
              question: "Reply OK",
              model,
              thinking,
            }),
          }),
        )
      ).status,
    ).toBe(400);
  expect(sent).toHaveLength(0);
  expect(rpcNamed("rms_ai_reserve_credits")).toHaveLength(0);
});
it("charges measured usage even when the output is not valid JSON", async () => {
  googleReply = () => googleOk("this is not json");
  const r = await post();
  expect(r.status).toBe(502);
  expect((await r.json()).error.code).toBe("INVALID_OUTPUT");
  const settle = rpcNamed("rms_ai_settle_credits");
  expect(settle).toHaveLength(1);
  expect(settle[0].body).toMatchObject({ p_refund: false });
  expect(settle[0].body.p_amount).toBeGreaterThan(0);
});
it("charges measured usage even when the output is empty", async () => {
  googleReply = () => googleOk("");
  const r = await post();
  expect(r.status).toBe(502);
  expect((await r.json()).error.code).toBe("NO_CANDIDATES");
  const settle = rpcNamed("rms_ai_settle_credits");
  expect(settle).toHaveLength(1);
  expect(settle[0].body.p_refund).toBe(false);
});
it("keeps the reservation and still answers when settlement fails", async () => {
  rpcReply = (name) =>
    name === "rms_ai_settle_credits" ? rpcFailure("XX000") : undefined;
  const r = await post();
  expect(r.status).toBe(200);
  const result = await r.json();
  expect(result).toMatchObject({ answer: "OK", creditStatus: "pending" });
  expect(result.creditsUsed).toBeUndefined();
  expect(
    rpcNamed("rms_ai_settle_credits").every((c) => c.body.p_refund === false),
  ).toBe(true);
});
it("does not report a charge when the hold was already closed", async () => {
  rpcReply = (name) =>
    name === "rms_ai_settle_credits" ? Response.json(false) : undefined;
  const result = await (await post()).json();
  expect(result.creditsUsed).toBeUndefined();
  expect(rpcNamed("rms_ai_settle_credits")).toHaveLength(1);
});
it("refunds only when Google rejects the request", async () => {
  googleReply = () => Response.json({ error: "quota" }, { status: 429 });
  const r = await post();
  expect(r.status).toBe(429);
  expect((await r.json()).error.code).toBe("RATE_LIMITED");
  const settle = rpcNamed("rms_ai_settle_credits");
  expect(settle).toHaveLength(1);
  expect(settle[0].body).toMatchObject({ p_refund: true, p_amount: 0 });
});
it("leaves the reservation untouched when usage is not reported", async () => {
  googleReply = () => googleOk('{"answer":"OK"}', null);
  const result = await (await post()).json();
  expect(result).toMatchObject({ answer: "OK", creditStatus: "pending" });
  expect(result.creditsUsed).toBeUndefined();
  expect(rpcNamed("rms_ai_settle_credits")).toHaveLength(0);
});
it("neither charges nor refunds when the connection to Google drops", async () => {
  googleReply = () => {
    throw new Error("network down");
  };
  const r = await post();
  expect(r.status).toBe(500);
  expect(rpcNamed("rms_ai_settle_credits")).toHaveLength(0);
});
it("maps a cancelled reservation to a cancel response without calling Google", async () => {
  rpcReply = (name) =>
    name === "rms_ai_reserve_credits" ? rpcFailure("57014") : undefined;
  const r = await post();
  expect(r.status).toBe(499);
  expect((await r.json()).error.code).toBe("CANCELLED");
  expect(sent).toHaveLength(0);
});
