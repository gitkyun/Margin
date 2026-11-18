import { describe, expect, it } from "vitest";
import { editorOutline, savedTime } from "@/lib/editor-head";

const heading = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: text ? [{ type: "text", text }] : [],
});

describe("editorOutline", () => {
  it("본문 순서대로 제목과 단계를 뽑고, 빈 제목도 자리를 지킨다", () => {
    const doc = {
      type: "doc",
      content: [
        heading(1, "서론"),
        { type: "paragraph", content: [{ type: "text", text: "본문" }] },
        heading(2, " 선행연구 "),
        heading(3, ""),
        {
          type: "blockquote",
          content: [heading(2, "인용 안 제목")],
        },
      ],
    };
    expect(editorOutline(doc)).toEqual([
      { index: 0, level: 1, text: "서론" },
      { index: 1, level: 2, text: "선행연구" },
      { index: 2, level: 3, text: "" },
      { index: 3, level: 2, text: "인용 안 제목" },
    ]);
  });

  it("알 수 없는 단계는 1로, 내용이 없으면 빈 목록", () => {
    expect(editorOutline({ type: "doc", content: [heading(5, "x")] })).toEqual([
      { index: 0, level: 1, text: "x" },
    ]);
    expect(editorOutline(null)).toEqual([]);
    expect(editorOutline({ type: "doc" })).toEqual([]);
  });
});

describe("savedTime", () => {
  const now = new Date(2026, 10, 18, 15, 0);
  it("오늘이면 시각만, 아니면 날짜와 시각", () => {
    const today = savedTime(new Date(2026, 10, 18, 14, 2).toISOString(), now);
    expect(today).toMatch(/2/);
    expect(today).not.toMatch(/11월|18일/);
    const before = savedTime(new Date(2026, 10, 10, 9, 5).toISOString(), now);
    expect(before).toMatch(/10/);
    expect(before.length).toBeGreaterThan(today.length);
  });
  it("값이 없거나 날짜가 아니면 빈 글자", () => {
    expect(savedTime(undefined, now)).toBe("");
    expect(savedTime("not-a-date", now)).toBe("");
  });
});
