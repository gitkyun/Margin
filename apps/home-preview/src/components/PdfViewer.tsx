import { t } from "@/lib/i18n";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { MaterialVersion } from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Icon } from "./icons";
import { ErrorNotice } from "./common";
/** 바깥에서 페이지를 옮길 때 쓰는 손잡이(예: 검토 댓글의 ‘p.4’ 누르기). */
export interface PdfViewerHandle {
  /** 1부터 세는 페이지로 이동해요. 범위를 넘으면 처음·끝 페이지로 맞춰요. */
  goToPage(page: number): void;
}

export interface PdfPin {
  id: string;
  /** PDF 전체에서 매긴 핀 번호(쪽이 달라도 겹치지 않게 부모가 정해요). */
  number: number;
  page: number;
  x: number;
  y: number;
  label: string;
}

export function PdfViewer({
  version,
  ref,
  pins = [],
  pinMode = false,
  onDropPin,
  onSelectPin,
}: {
  version: MaterialVersion;
  ref?: Ref<PdfViewerHandle>;
  pins?: PdfPin[];
  pinMode?: boolean;
  onDropPin?: (pin: { page: number; x: number; y: number }) => void;
  onSelectPin?: (id: string) => void;
}) {
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
    canvas = useRef<HTMLCanvasElement>(null),
    prevButton = useRef<HTMLButtonElement>(null),
    nextButton = useRef<HTMLButtonElement>(null),
    // A paging button disables itself at the first/last page; after that
    // render, move keyboard focus to the other one (WCAG 2.4.3).
    refocus = useRef<"prev" | "next" | null>(null),
    // 파일을 다 불러오기 전에 받은 페이지 이동. 불러온 뒤 한 번 적용해요.
    pendingPage = useRef<number | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      goToPage(target: number) {
        if (!Number.isFinite(target)) return;
        if (!doc) {
          pendingPage.current = target;
          return;
        }
        setPage(Math.min(doc.numPages, Math.max(1, Math.round(target))));
        host.current?.scrollIntoView({ block: "nearest" });
      },
    }),
    [doc],
  );
  useEffect(() => {
    if (!doc || pendingPage.current === null) return;
    const target = pendingPage.current;
    pendingPage.current = null;
    setPage(Math.min(doc.numPages, Math.max(1, Math.round(target))));
  }, [doc]);
  useEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (target) (target === "prev" ? prevButton : nextButton).current?.focus();
  });
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
      if (!ctx) throw new Error(t("PDF를 표시할 수 없어요."));
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
          t(
            "이 페이지를 표시하지 못했어요. 파일은 그대로 저장되어 있으니 내려받아 확인해 주세요.",
          ),
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
        <span className="pdf-file-name" title={version.fileName}>
          <Icon name="file" size={16} />
          {version.fileName}
        </span>
        <div className="pdf-controls">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("이전 페이지")}
            ref={prevButton}
            disabled={!doc || page <= 1}
            onClick={() => {
              // The button disables itself on page 1; keep keyboard focus.
              if (page - 1 <= 1) refocus.current = "next";
              setPage((p) => p - 1);
            }}
          >
            <Icon name="chevron-left" size={16} />
          </Button>
          <span className="pdf-page-number" role="status" aria-atomic="true">
            {page} / {doc?.numPages ?? "—"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("다음 페이지")}
            ref={nextButton}
            disabled={!doc || page >= doc.numPages}
            onClick={() => {
              if (doc && page + 1 >= doc.numPages) refocus.current = "prev";
              setPage((p) => p + 1);
            }}
          >
            <Icon name="chevron-right" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("축소")}
            disabled={zoom <= 0.6}
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          >
            <Icon name="minus" size={16} />
          </Button>
          <span className="pdf-zoom" role="status" aria-atomic="true">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("확대")}
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
          >
            <Icon name="plus" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("PDF 내려받기")}
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
          <div
            className={`pdf-canvas-stage${pinMode ? " is-pinning" : ""}`}
            onClick={(e) => {
              if (!pinMode || !onDropPin || !canvas.current) return;
              const rect = canvas.current.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) return;
              const x = Math.round(
                Math.max(
                  0,
                  Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
                ),
              );
              const y = Math.round(
                Math.max(
                  0,
                  Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
                ),
              );
              onDropPin({ page, x, y });
            }}
          >
            <canvas
              ref={canvas}
              aria-label={t("{fileName}, {page}페이지", {
                fileName: version.fileName,
                page,
              })}
              className={loading ? "pdf-loading" : ""}
            />
            {pins
              .filter((pin) => pin.page === page)
              .map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  className="pdf-pin-marker"
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  title={pin.label}
                  aria-label={t("위치 핀 {number}: {label}", {
                    number: pin.number,
                    label: pin.label,
                  })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPin?.(pin.id);
                  }}
                >
                  {pin.number}
                </button>
              ))}
            {loading && (
              <div className="pdf-loading-label" role="status">
                <span className="spinner" />
                {t("PDF 불러오는 중")}
              </div>
            )}
          </div>
        )}
      </div>
      {doc && (
        <Disclosure className="pdf-text" summary={t("이 페이지 텍스트 보기")}>
          <p>{text || t("이 페이지에는 읽을 수 있는 텍스트가 없어요.")}</p>
        </Disclosure>
      )}
    </div>
  );
}
