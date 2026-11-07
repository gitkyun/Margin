import { useEffect, useRef, useState } from "react";
import type { MaterialVersion } from "@/lib/domain";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useWorkspace } from "@/lib/workspace";
import { Icon } from "./icons";

// The badge previews the actual first page, and only fetches visible files.
export function MaterialPreviewBadge({
  version,
}: {
  version: MaterialVersion;
}) {
  const { openFile } = useWorkspace();
  const host = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    let doc: PDFDocumentProxy | undefined;
    let render: RenderTask | undefined;
    setReady(false);
    void (async () => {
      const pdf = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdf.GlobalWorkerOptions.workerSrc = worker.default;
      const blob = await openFile(version);
      if (!active) return;
      doc = await pdf.getDocument({
        data: new Uint8Array(await blob.arrayBuffer()),
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        wasmUrl: "/pdfjs/wasm/",
      }).promise;
      if (!active) {
        await doc.loadingTask.destroy();
        return;
      }
      const page = await doc.getPage(1);
      if (!active || !canvas.current) return;
      const initial = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 160 / initial.width });
      const target = canvas.current;
      target.width = viewport.width;
      target.height = viewport.height;
      const context = target.getContext("2d");
      if (!context) return;
      render = page.render({
        canvas: target,
        canvasContext: context,
        viewport,
      });
      await render.promise;
      if (active) setReady(true);
    })().catch(() => {
      /* Keep the file badge; detail view offers retry and download. */
    });
    return () => {
      active = false;
      render?.cancel();
      void doc?.loadingTask.destroy();
    };
  }, [visible, version.id, version.storagePath]);
  return (
    <span
      ref={host}
      className="material-preview-badge"
      aria-label={`${version.fileName} 첫 페이지 미리보기`}
    >
      <canvas ref={canvas} style={{ display: ready ? "block" : "none" }} />
      {!ready && (
        <span className="preview-fallback">
          <Icon name="file" size={20} />
          PDF
        </span>
      )}
    </span>
  );
}
