import { expect, it } from "vitest";
import { availableModels, generationUrl, modelCatalog } from "./models";
it("offers four Google models and recommends only Flash", () => {
  const models = availableModels();
  expect(models).toHaveLength(4);
  expect(models.every((m) => m.provider === "google")).toBe(true);
  expect(models.filter((m) => m.recommended).map((m) => m.id)).toEqual([
    "gemini-3.8-flash",
  ]);
});
it("switches published introductory prices on their expiry dates", () => {
  expect(
    availableModels("", new Date("2026-11-30T23:59:59Z"))[2].inputPrice,
  ).toBe(2);
  expect(
    availableModels("", new Date("2026-12-01T00:00:00Z"))[2].inputPrice,
  ).toBe(4);
  expect(
    availableModels("", new Date("2026-12-31T23:59:59Z"))[0].inputPrice,
  ).toBe(0.75);
  expect(
    availableModels("", new Date("2027-01-01T00:00:00Z"))[0].inputPrice,
  ).toBe(1.5);
});
it("preserves Gemini endpoints without putting credentials in URLs", () => {
  expect(generationUrl("vertex", "gemini-3.8-flash", "test-project")).toBe(
    "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models/gemini-3.8-flash:generateContent",
  );
  expect(generationUrl("vertex", "gemini-3.8-flash")).not.toContain(
    "/projects/",
  );
  expect(generationUrl("studio", "gemini-3.8-flash")).toContain(
    "generativelanguage.googleapis.com",
  );
});
