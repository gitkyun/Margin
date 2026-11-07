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
      throw new Error(`1~${doc.numPages}쪽에서 선택해 주세요.`);
    const p = await doc.getPage(page),
      text = (await p.getTextContent()).items
        .map((i) => ("str" in i ? i.str : ""))
        .join(" ");
    if (!text.trim())
      throw new Error(
        "이 페이지에서 텍스트를 읽지 못했습니다. 텍스트가 있는 다른 페이지를 선택하거나 내용을 직접 입력해 주세요.",
      );
    return { text, pages: doc.numPages };
  } finally {
    await loading.destroy();
  }
}
