import { expect, it } from "vitest";
import { readGrounding } from "./grounding";
it("maps non-ASCII UTF8 part offsets to visible UTF16 text", () => {
  const text = "한글😀 근거예요.";
  const result = readGrounding({
    content: {
      parts: [{ thought: true, text: "hidden" }, { text: "서론 " }, { text }],
    },
    groundingMetadata: {
      webSearchQueries: [" q ", "q", ""],
      groundingChunks: [
        { web: { uri: "https://example.com/a", title: "출처" } },
        { web: { uri: "https://example.com/a", title: "중복" } },
        { web: { uri: "javascript:alert(1)", title: "unsafe" } },
      ],
      groundingSupports: [
        {
          segment: {
            partIndex: 2,
            startIndex: 0,
            endIndex: new TextEncoder().encode("한글😀").length,
            text: "한글😀",
          },
          groundingChunkIndices: [0, 1, 2],
        },
      ],
    },
  });
  expect(result.text).toBe("서론 " + text);
  expect(result.grounding.sources).toHaveLength(1);
  expect(result.grounding.citations).toEqual([
    { startIndex: 3, endIndex: 7, sourceIndices: [0] },
  ]);
  expect(result.searchQueries).toBe(1);
});
it("discards invalid URL/byte/segment references without fabricating citations", () => {
  const { grounding } = readGrounding({
    content: { parts: [{ text: "가" }] },
    groundingMetadata: {
      groundingChunks: [
        { web: { uri: "https://user:pass@example.com/" } },
        { web: { uri: "https://example.com" } },
      ],
      groundingSupports: [
        { segment: { startIndex: 1, endIndex: 3 }, groundingChunkIndices: [1] },
        {
          segment: { startIndex: 0, endIndex: 3, text: "틀림" },
          groundingChunkIndices: [1],
        },
      ],
    },
  });
  expect(grounding.citations).toEqual([]);
  expect(grounding.sources).toHaveLength(1);
});
it("does not report missing search counts as confirmed zero", () => {
  const result = readGrounding({
    content: { parts: [{ text: "no tool output" }] },
  });
  expect(result.searchQueries).toBeUndefined();
  expect(result.grounding.sources).toEqual([]);
});
