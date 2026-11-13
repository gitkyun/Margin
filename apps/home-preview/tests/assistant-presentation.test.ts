import { describe, expect, it } from "vitest";
import {
  resolveReviewDepth,
  reviewDepthOptions,
  researchModelLabel,
} from "../src/lib/assistant-presentation";

describe("research review controls respect model capabilities", () => {
  it("does not offer a preferred depth that the selected model no longer supports", () => {
    const allowed = ["minimal", "medium"];
    expect(resolveReviewDepth(allowed, "high")).toBe("minimal");
    expect(resolveReviewDepth(allowed, "medium")).toBe("medium");
    expect(reviewDepthOptions(allowed).map((o) => o.value)).toEqual(allowed);
  });
  it("falls back to the first (deepest) level when a saved preference is no longer offered", () => {
    const allowed = ["high", "medium", "low"];
    expect(resolveReviewDepth(allowed, "minimal")).toBe("high");
    expect(resolveReviewDepth(allowed, "low")).toBe("low");
    expect(reviewDepthOptions(allowed).map((o) => o.label)).toEqual([
      "자세히",
      "보통",
      "간단히",
    ]);
  });
  it("does not invent a thinking option for a model without those controls", () => {
    expect(resolveReviewDepth([], "high")).toBe("");
    expect(reviewDepthOptions([])).toEqual([]);
  });
  it("retains server-supplied names and the identity of actual model variants", () => {
    expect(
      researchModelLabel({
        id: "gemini-3.5-flash-lite",
        label: "gemini-3.5-flash-lite",
      }),
    ).toBe("Gemini 3.5 Flash Lite");
    expect(
      researchModelLabel({
        id: "gemini-model-preview-07",
        label: "gemini-model-preview-07",
      }),
    ).toContain("preview 07");
    expect(researchModelLabel({ id: "model-1", label: "학교 제공 모델" })).toBe(
      "학교 제공 모델",
    );
  });
});
