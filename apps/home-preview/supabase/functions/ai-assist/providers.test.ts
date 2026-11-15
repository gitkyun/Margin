import { expect, it } from "vitest";
import { availableModels } from "./models";
import { usageCredits, reserveCredits } from "./providers";
it("accounts for cache and reasoning exactly once", () => {
  const model = availableModels("", new Date("2027-01-01"))[0];
  expect(
    usageCredits(model, {
      input: 1000,
      cached: 500,
      output: 200,
      reasoning: 50,
      cacheWrite: 0,
      known: true,
    }),
  ).toBe(2.325);
  expect(() =>
    usageCredits(model, {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cacheWrite: 0,
      known: false,
    }),
  ).toThrow("USAGE_UNCONFIRMED");
});
it("reserves enough for the full permitted output and UTF8 input", () => {
  const model = availableModels("", new Date("2027-01-01"))[0];
  const reserve = reserveCredits(model, "한글 지침", "질문", {}, 8192);
  expect(reserve).toBeGreaterThan((8192 * 7.5) / 1000);
});
const generateWith = async (usageMetadata: Record<string, number>) => {
  const { generate } = await import("./providers");
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      candidates: [{ content: { parts: [{ text: '{"answer":"OK"}' }] } }],
      usageMetadata,
    })) as typeof fetch;
  try {
    return await generate({
      model: availableModels("")[0],
      system: "s",
      prompt: "p",
      schema: {},
      maxOutput: 100,
      signal: new AbortController().signal,
      apiKey: "test-key",
      projectId: "test-project",
      provider: "vertex",
    });
  } finally {
    globalThis.fetch = original;
  }
};
it("counts thinking tokens once for a response where the answer count excludes them", async () => {
  // 실제 Vertex Hydrogen 호출 기록과 같은 모양(입력 107 + 답변 9 + 생각 91 = 총 207)
  const { usage } = await generateWith({
    promptTokenCount: 107,
    candidatesTokenCount: 9,
    thoughtsTokenCount: 91,
    totalTokenCount: 207,
  });
  expect(usage).toMatchObject({ input: 107, output: 100, reasoning: 91 });
});
it("counts thinking tokens once for a response where the answer count already includes them", async () => {
  const { usage } = await generateWith({
    promptTokenCount: 107,
    candidatesTokenCount: 100,
    thoughtsTokenCount: 91,
    totalTokenCount: 207,
  });
  expect(usage.output).toBe(100);
});
it("falls back to adding thinking tokens when the total is missing", async () => {
  const { usage } = await generateWith({
    promptTokenCount: 10,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 20,
  });
  expect(usage.output).toBe(25);
});
