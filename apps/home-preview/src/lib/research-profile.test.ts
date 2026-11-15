import { describe, expect, it } from "vitest";
import {
  MAX_KEYWORDS,
  addKeyword,
  readCitationStyle,
  readKeywords,
  sameKeywords,
} from "./research-profile";

describe("research keywords", () => {
  it("trims, collapses spaces and skips case-insensitive duplicates", () => {
    const list = addKeyword(addKeyword([], "  질적   연구 "), "UX");
    expect(list).toEqual(["질적 연구", "UX"]);
    expect(addKeyword(list, "ux")).toBe(list);
    expect(addKeyword(list, "   ")).toBe(list);
    expect(addKeyword(list, "가".repeat(41))).toBe(list);
  });

  it("stops at ten keywords and cleans stored values", () => {
    const full = Array.from({ length: 12 }, (_, i) => `k${i}`).reduce(
      addKeyword,
      [] as string[],
    );
    expect(full).toHaveLength(MAX_KEYWORDS);
    expect(readKeywords(["a", 3, "a", "b"])).toEqual(["a", "b"]);
    expect(readKeywords("a")).toEqual([]);
    expect(sameKeywords(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameKeywords(["a", "b"], ["b", "a"])).toBe(false);
  });

  it("accepts only the preset citation styles", () => {
    expect(readCitationStyle("apa7")).toBe("apa7");
    expect(readCitationStyle("none")).toBeUndefined();
    expect(readCitationStyle("Harvard")).toBeUndefined();
  });
});
