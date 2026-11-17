import { expect, it } from "vitest";
import { allowedOrigins } from "./origins";
it("allows only exact configured and production origins during migration", () => {
  const origins = allowedOrigins(
    "https://other.example, https://other.example",
  );
  expect(origins).toEqual([
    "https://other.example",
    "https://rms-classroom-demo.pages.dev",
    "https://margin-research.pages.dev",
  ]);
  expect(origins.includes("https://evil.margin-research.pages.dev")).toBe(
    false,
  );
  expect(
    origins.includes("https://margin-research.pages.dev.evil.example"),
  ).toBe(false);
});
