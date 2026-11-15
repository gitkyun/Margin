// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  resolveAISelection,
  type AIModelCapability,
} from "../src/lib/ai-capabilities";
import { runCreditUsage, type AICredits } from "../src/lib/ai-usage";

const models: AIModelCapability[] = [
  { id: "legacy", label: "Legacy", thinking: ["low"] },
  {
    id: "flash-3.8",
    label: "Flash 3.8",
    thinking: ["high", "medium", "low"],
    recommended: true,
  },
  { id: "unverified", label: "Unverified", thinking: ["high"], disabled: true },
  { id: "failed", label: "Failed", thinking: ["high"], availability: "failed" },
];
describe("account AI selection", () => {
  it("uses the recommended model rather than an arbitrary first model for obsolete preferences", () => {
    expect(
      resolveAISelection(models, { model: "removed", thinking: "medium" }),
    ).toEqual({ model: "flash-3.8", thinking: "medium" });
  });
  it("preserves an available saved model and checks its supported effort", () => {
    expect(
      resolveAISelection(models, { model: "legacy", thinking: "high" }),
    ).toEqual({ model: "legacy", thinking: "low" });
  });
  it("never selects a failed or unverified model even if it was saved or recommended", () => {
    expect(resolveAISelection(models, { model: "unverified" }).model).toBe(
      "flash-3.8",
    );
    expect(resolveAISelection(models, { model: "failed" }).model).toBe(
      "flash-3.8",
    );
    expect(resolveAISelection([{ ...models[2], recommended: true }])).toEqual({
      model: undefined,
      thinking: undefined,
    });
  });
  it("falls back to server-provided Flash 3.8 if there is no recommendation", () => {
    expect(
      resolveAISelection(
        models.map((model) => ({ ...model, recommended: false })),
      ).model,
    ).toBe("flash-3.8");
  });
  it("does not invent a model or effort while the capability request has no result", () => {
    expect(resolveAISelection()).toEqual({
      model: undefined,
      thinking: undefined,
    });
    expect(resolveAISelection([{ ...models[0], thinking: [] }])).toEqual({
      model: "legacy",
      thinking: undefined,
    });
  });
});
const credits: AICredits = {
  balance: 19998,
  allowance: 20000,
  reserved: 100,
  used: 2,
  resetsAt: "2026-12-01T00:00:00Z",
  ledger: [
    {
      id: "hold",
      runId: "r1",
      amount: -100,
      kind: "reserve",
      createdAt: "2026-11-15T00:00:00Z",
    },
    {
      id: "debit",
      runId: "r1",
      amount: -1.234,
      kind: "charge",
      createdAt: "2026-11-15T00:00:01Z",
    },
    {
      id: "other",
      runId: "r2",
      amount: -0.766,
      kind: "charge",
      createdAt: "2026-11-15T00:00:01Z",
    },
    {
      id: "refund",
      runId: "r3",
      amount: 0,
      kind: "refund",
      createdAt: "2026-11-15T00:00:01Z",
    },
  ],
};
describe("actual credit receipts", () => {
  it("shows only a request's settled cost, excluding its reservation and other requests", () =>
    expect(runCreditUsage(credits, "r1")).toBe(1.234));
  it("distinguishes a zero-cost refund from a pending or missing settlement", () => {
    expect(runCreditUsage(credits, "r3")).toBe(0);
    expect(runCreditUsage(credits, "pending")).toBeUndefined();
    expect(runCreditUsage(undefined, "r1")).toBeUndefined();
  });
});
