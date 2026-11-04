import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { MaterialVersion } from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import { ErrorNotice } from "./common";
export function PdfViewer({ version }: { version: MaterialVersion }) {
  const { openFile } = useWorkspace();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [blob, setBlob] = useState<Blob | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [width, setWidth] = useState(600),
    [retry, setRetry] = useState(0),
    [text, setText] = useState("");
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    let loaded: PDFDocumentProxy | null = null;
    setLoading(true);
    setError("");
    setPage(1);
    setDoc(null);
    setBlob(null);
    (async () => {
      const pdf = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdf.GlobalWorkerOptions.workerSrc = worker.default;
      const file = await openFile(version);
      if (!active) return;
      setBlob(file);
      loaded = await pdf.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        wasmUrl: "/pdfjs/wasm/",
      }).promise;
      if (active) setDoc(loaded);
      else loaded.loadingTask.destroy();
    })().catch((e) => {
      if (active) {
        setError(friendlyError(e));
        setLoading(false);
      }
    });
    return () => {
      active = false;
      loaded?.loadingTask.destroy();
    };
  }, [version.id, version.storagePath, retry]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(180, entries[0].contentRect.width - 48)),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let active = true,
      render: RenderTask | undefined;
    setLoading(true);
    (async () => {
      const pdfPage = await doc.getPage(page);
      if (!active || !canvas.current) return;
      const initial = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({
        scale: (width / initial.width) * zoom,
      });
      const target = canvas.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.round(viewport.width * dpr);
      target.height = Math.round(viewport.height * dpr);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      const ctx = target.getContext("2d");
      if (!ctx) throw new Error("PDF를 표시할 수 없습니다.");
      render = pdfPage.render({
        canvas: target,
        canvasContext: ctx,
        viewport,
        transform: [dpr, 0, 0, dpr, 0, 0],
      });
      await render.promise;
      if (active) {
        setLoading(false);
        const content = await pdfPage.getTextContent();
        setText(
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" "),
        );
      }
    })().catch((e) => {
      if (active && e?.name !== "RenderingCancelledException") {
        setError(
          "이 페이지를 표시하지 못했습니다. PDF 파일을 내려받아 확인할 수 있습니다.",
        );
        setLoading(false);
      }
    });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [doc, page, width, zoom]);
  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = version.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <span className="pdf-file-name">
          <Icon name="file" size={16} />
          {version.fileName}
        </span>
        <div className="pdf-controls">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="이전 페이지"
            disabled={!doc || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <Icon name="chevron-left" size={16} />
          </Button>
          <span className="pdf-page-number">
            {page} / {doc?.numPages ?? "—"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="다음 페이지"
            disabled={!doc || page >= doc.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <Icon name="chevron-right" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="축소"
            disabled={zoom <= 0.6}
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          >
            <Icon name="minus" size={16} />
          </Button>
          <span className="pdf-zoom">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="확대"
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
          >
            <Icon name="plus" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="PDF 다운로드"
            disabled={!blob}
            onClick={download}
          >
            <Icon name="download" size={17} />
          </Button>
        </div>
      </div>
      <div className="pdf-canvas-host" ref={host}>
        {error ? (
          <ErrorNotice message={error} retry={() => setRetry((n) => n + 1)} />
        ) : (
          <>
            <canvas
              ref={canvas}
              aria-label={`${version.fileName}, ${page}페이지`}
              className={loading ? "pdf-loading" : ""}
            />
            {loading && (
              <div className="pdf-loading-label" role="status">
                <span className="spinner" />
                PDF 불러오는 중
              </div>
            )}
          </>
        )}
      </div>
      {doc && (
        <details className="pdf-text">
          <summary>이 페이지 텍스트 보기</summary>
          <p>{text || "추출할 수 있는 텍스트가 없습니다."}</p>
        </details>
      )}
    </div>
  );
}
