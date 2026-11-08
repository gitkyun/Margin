import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./brand.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("Margin wordmark size", () => {
  it("uses one shared size for the public header and the workspace sidebar", () => {
    for (const selector of [
      ".floating-workspace .brand .margin-wordmark",
      ".lp-brand .margin-wordmark",
    ]) {
      expect(rule(selector)).toContain("width: var(--margin-wordmark-width)");
      expect(rule(selector)).toContain("height: var(--margin-wordmark-height)");
    }
  });
});
