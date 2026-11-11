import { t } from "@/lib/i18n";
export async function readPDFPage(blob: Blob, page = 1) {
  const pdf = await import("pdfjs-dist"),
    worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdf.GlobalWorkerOptions.workerSrc = worker.default;
  const loading = pdf.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  const doc = await loading.promise;
  try {
    if (page < 1 || page > doc.numPages)
      throw new Error(
        t("읽을 페이지를 1~{pages} 사이로 적어 주세요.", {
          pages: doc.numPages,
        }),
      );
    const p = await doc.getPage(page),
      text = (await p.getTextContent()).items
        .map((i) => ("str" in i ? i.str : ""))
        .join(" ");
    if (!text.trim())
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
