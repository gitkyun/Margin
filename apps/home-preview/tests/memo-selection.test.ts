import { describe, expect, it } from "vitest";
import {
  entryFromSelection,
  TITLE_FROM_MEMO_MAX,
} from "../src/lib/memo-selection";

describe("entryFromSelection", () => {
  it("returns nothing when no text is selected", () => {
    expect(entryFromSelection("  \n ")).toBeNull();
  });

  it("uses the first line as the title and keeps the whole selection as the body", () => {
    expect(
      entryFromSelection(
        "  표본 크기 근거 보강\n교수님: 선행연구 기준을 함께 적기 ",
      ),
    ).toEqual({
      title: "표본 크기 근거 보강",
      body: "표본 크기 근거 보강\n교수님: 선행연구 기준을 함께 적기",
    });
  });

  it("shortens a long first line to a title and marks the cut", () => {
    const line = "가".repeat(TITLE_FROM_MEMO_MAX + 10);
    const result = entryFromSelection(line);
    expect(result?.title).toBe(`${"가".repeat(TITLE_FROM_MEMO_MAX)}…`);
    expect(result?.body).toBe(line);
  });

  it("drops a leading bullet or marker from the title", () => {
    expect(entryFromSelection("- 📌 비교 기준 보완")?.title).toBe(
      "비교 기준 보완",
    );
  });
});
