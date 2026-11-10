import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Montage Button은 기본 type이 "button"이라, 폼 안에서 type을 적지 않으면 클릭해도 제출되지 않아요.
 * 폼 안의 <Button>은 type을 적거나(제출이면 "submit"), onClick·asChild로 동작을 정해야 해요.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

describe("폼 안의 버튼", () => {
  it("type·onClick·asChild 없이 놓인 <Button>이 없다", () => {
    const problems: string[] = [];
    for (const file of files(join(__dirname, "../src"))) {
      const source = readFileSync(file, "utf8");
      for (const form of source.matchAll(/<form\b[\s\S]*?<\/form>/g)) {
        for (const button of form[0].matchAll(/<Button\b([^>]*)>/g)) {
          const attrs = button[1];
          if (!/\btype=|\bonClick=|\basChild\b/.test(attrs)) {
            const line = source
              .slice(0, (form.index ?? 0) + (button.index ?? 0))
              .split("\n").length;
            problems.push(`${file.split("/src/")[1]}:${line}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
