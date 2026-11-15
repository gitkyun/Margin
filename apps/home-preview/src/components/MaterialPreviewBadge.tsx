import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type { MaterialVersion } from "@/lib/domain";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useWorkspace } from "@/lib/workspace";
import { Icon } from "./icons";
import "./material-library.css";

/** 그릴 캔버스 너비(px). 고해상도 화면에서도 흐리지 않게 표시 크기의 두세 배로 그려요. */
const RENDER_WIDTH = { badge: 160, large: 560 } as const;

/**
 * PDF 첫 페이지 썸네일. 화면에 보일 때만 파일을 읽고(lazy), 그리는 동안 반짝이는 자리표시를 보여 준 뒤
 * 부드럽게 나타나요. 읽지 못하면 PDF 표시로 남아요(자세한 화면에서 다시 시도·내려받기).
 * WebGL 효과는 쓰지 않아요.
 */
export function MaterialPreviewBadge({
  version,
  size = "badge",
}: {
  version: MaterialVersion;
  /** badge: 자료 목록의 작은 표, large: 여백 미리보기 레일 */
  size?: "badge" | "large";
}) {
  const { openFile } = useWorkspace();
  const host = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
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
    setFailed(false);
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
      const viewport = page.getViewport({
        scale: RENDER_WIDTH[size] / initial.width,
      });
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
      // 파일 표시로 남겨요. 자세한 화면에서 다시 시도하거나 내려받을 수 있어요.
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      render?.cancel();
      void doc?.loadingTask.destroy();
    };
  }, [visible, version.id, version.storagePath, size]);
  return (
    <span
      ref={host}
      role="img"
      className={`material-preview-badge${size === "large" ? " is-large" : ""}${ready ? " is-ready" : ""}`}
      aria-label={t("{fileName} 첫 페이지 미리보기", {
        fileName: version.fileName,
      })}
      aria-busy={!ready && !failed}
    >
      <canvas ref={canvas} className="material-preview-canvas" />
      {!ready &&
        (failed ? (
          <span className="preview-fallback">
            <Icon name="file" size={20} />
            PDF
          </span>
        ) : (
          <span className="preview-shimmer" aria-hidden="true" />
        ))}
    </span>
  );
}
