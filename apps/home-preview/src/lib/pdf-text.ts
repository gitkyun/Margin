import { t } from "@/lib/i18n";
type TextItem = { str: string; hasEOL?: boolean } | { type: string };
interface PDFTextDocument {
  numPages: number;
  getPage(
    page: number,
  ): Promise<{ getTextContent(): Promise<{ items: TextItem[] }> }>;
}
function pageText(items: TextItem[]) {
  return items
    .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
    .join("")
    .trim();
}
async function loadPDF(blob: Blob) {
  const pdf = await import("pdfjs-dist"),
    worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdf.GlobalWorkerOptions.workerSrc = worker.default;
  return pdf.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
}
/** Read every page. Never silently send only the cover or silently truncate a paper. */
export async function extractPDFText(doc: PDFTextDocument, maxChars = 48000) {
  if (doc.numPages > 500)
    throw new Error(t("PDF가 너무 길어요. 500쪽 이하로 나눠 첨부해 주세요."));
  const sections: string[] = [],
    unreadablePages: number[] = [];
  let length = 0;
  for (let page = 1; page <= doc.numPages; page++) {
    const text = pageText(
      (await (await doc.getPage(page)).getTextContent()).items,
    );
    if (!text) {
      unreadablePages.push(page);
      continue;
    }
    const section = `[${page}쪽]\n${text}`; // i18n-ignore: source page protocol
    length += section.length + 2;
    if (length > maxChars)
      throw new Error(
        t("PDF 본문이 너무 길어요. 읽을 범위를 나누어 첨부해 주세요."),
      );
    sections.push(section);
  }
  if (!sections.length)
    throw new Error(
      t(
        "이 PDF는 텍스트를 읽을 수 없어요. 스캔 문서는 텍스트 인식 후 첨부하거나 본문을 붙여 넣어 주세요.",
      ),
    );
  const notice = unreadablePages.length
    ? t(
        "텍스트를 읽지 못한 쪽: {pages}. 이 쪽의 그림·내용은 확인되지 않았어요.",
        { pages: unreadablePages.join(", ") },
      ) + "\n\n"
    : "";
  return {
    text: notice + sections.join("\n\n"),
    pages: doc.numPages,
    unreadablePages,
  };
}
export async function readPDFText(blob: Blob) {
  const loading = await loadPDF(blob);
  try {
    return await extractPDFText(await loading.promise);
  } finally {
    await loading.destroy();
  }
}
export async function readPDFPage(blob: Blob, page = 1) {
  const loading = await loadPDF(blob);
  try {
    const doc = await loading.promise;
    if (page < 1 || page > doc.numPages)
      throw new Error(
        t("읽을 페이지를 1~{pages} 사이로 적어 주세요.", {
          pages: doc.numPages,
        }),
      );
    const text = pageText(
      (await (await doc.getPage(page)).getTextContent()).items,
    );
    if (!text)
      throw new Error(
        t(
          "이 페이지에는 읽을 수 있는 텍스트가 없어요. 다른 페이지를 고르거나 내용을 직접 적어 주세요.",
        ),
      );
    return { text, pages: doc.numPages };
  } finally {
    await loading.destroy();
  }
}
