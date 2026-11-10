// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/supabase", () => ({
  configured: true,
  supabase: null,
  assertConnected: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
    },
  }),
  friendlyError: (error: unknown) => String(error),
}));

const input = {
  mode: "chat",
  researchId: "r1",
  question: "q",
  sourceText: "",
  contexts: [],
} as never;

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

describe("AI server not configured", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("turns NOT_CONFIGURED into a no-retry message and remembers it", async () => {
    respond(503, {
      error: {
        code: "NOT_CONFIGURED",
        message:
          "연구 도우미에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
      },
    });
    const { executeAI } = await import("../src/lib/repository");
    const availability = await import("../src/lib/ai-availability");
    expect(availability.isAINotConfigured()).toBe(false);

    const error = await executeAI(input).catch((e) => e);
    expect(error).toBeInstanceOf(availability.AINotConfiguredError);
    expect(error.message).toBe(availability.AI_NOT_CONFIGURED_MESSAGE);
    expect(error.message).not.toContain("다시 시도");
    expect(availability.isAINotConfigured()).toBe(true);
    expect(sessionStorage.getItem("margin-ai-not-configured")).toBe("1");
  });

  it("keeps other server errors as before", async () => {
    respond(429, {
      error: { code: "RATE_LIMITED", message: "잠시 뒤 다시 시도해 주세요." },
    });
    const { executeAI } = await import("../src/lib/repository");
    const availability = await import("../src/lib/ai-availability");

    const error = await executeAI(input).catch((e) => e);
    expect(error).not.toBeInstanceOf(availability.AINotConfiguredError);
    expect(availability.isAINotConfigured()).toBe(false);
  });
});

describe("meeting memo", () => {
  it("fills the card width (QA 2026-11-10 F-001)", () => {
    const css = readFileSync(
      resolve(__dirname, "../src/pages/student/student.css"),
      "utf8",
    );
    const rule = css.match(/\n {2}\.meeting-memo \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/width:\s*100%/);
  });
});
