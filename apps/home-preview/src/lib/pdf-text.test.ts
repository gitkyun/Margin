import { expect, it } from "vitest";
import { extractPDFText } from "./pdf-text";
function doc(pages: string[]) {
  return {
    numPages: pages.length,
    async getPage(page: number) {
      return {
        async getTextContent() {
          return {
            items: pages[page - 1]
              ? [{ str: pages[page - 1], hasEOL: true }]
              : [],
          };
        },
      };
    },
  };
}
it("extracts the body and conclusion, not just the cover", async () => {
  const result = await extractPDFText(
    doc([
      "논문 제목과 저자",
      "연구 방법: 인터뷰 12회",
      "결과: 네 가지 행동 유형",
      "결론: 맥락 비교가 필요하다",
    ]),
  );
  expect(result.text).toContain("[4쪽]");
  expect(result.text).toContain("인터뷰 12회");
  expect(result.text).toContain("네 가지 행동 유형");
});
it("identifies pages it could not read without pretending to have seen figures", async () => {
  const result = await extractPDFText(doc(["표지", "", "본문"]));
  expect(result.unreadablePages).toEqual([2]);
  expect(result.text).toContain("확인되지 않았어요");
});
it("rejects scanned-only or oversized PDFs instead of silently sending partial text", async () => {
  await expect(extractPDFText(doc(["", ""]))).rejects.toThrow("텍스트");
  await expect(
    extractPDFText(doc(["표지", "아".repeat(100)]), 50),
  ).rejects.toThrow("범위");
});
