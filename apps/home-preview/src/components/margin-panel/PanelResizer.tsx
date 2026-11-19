import { t } from "@/lib/i18n";
import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import "./margin-panel.css";

/** 폭 기억 키. 글 편집·자료 보기의 넓은 창(440)은 따로 기억해요(02 §4.5). */
export const PANEL_WIDTH_KEY = "margin-panel-width";
export const DOCS_PANEL_WIDTH_KEY = "margin-panel-width-docs";
/** IA v2 사이드 창 기본 폭과 같게 둡니다(02 §1.1). */
export const PANEL_MIN_WIDTH = 312;
export const PANEL_MAX_WIDTH = 640;
const KEY_STEP = 16;

export function clampPanelWidth(width: number): number {
  return Math.round(
    Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width)),
  );
}

function readStored(key: string): number | null {
  try {
    const raw = Number(localStorage.getItem(key));
    return raw ? clampPanelWidth(raw) : null;
  } catch {
    return null;
  }
}

/** 사용자가 정한 여백 패널 너비. null이면 화면 너비별 기본값을 써요. */
export function usePanelWidth(
  key: string = PANEL_WIDTH_KEY,
): [number | null, (width: number | null) => void] {
  const [stored, setStored] = useState(() => ({
    key,
    width: readStored(key),
  }));
  // 화면이 바뀌어 기억 키가 달라지면 그 키의 값을 다시 읽어요.
  const width = stored.key === key ? stored.width : readStored(key);
  if (stored.key !== key) setStored({ key, width });
  const setWidth = useCallback(
    (value: number | null) => setStored({ key, width: value }),
    [key],
  );
  const update = useCallback(
    (next: number | null) => {
      const value = next === null ? null : clampPanelWidth(next);
      setWidth(value);
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {
        // 저장소를 못 쓰면 이번 화면에서만 유지해요.
      }
    },
    [key, setWidth],
  );
  return [width, update];
}

interface PanelResizerProps {
  /** 지금 패널의 실제 너비(px). 끌기 시작점으로 써요. */
  currentWidth: () => number;
  width: number | null;
  onChange: (width: number | null) => void;
  onDraggingChange?: (dragging: boolean) => void;
  /** 사이드 창이 왼쪽이면 끄는 방향과 ←/→ 키가 반대예요. */
  side?: "right" | "left";
}

/**
 * 본문과 여백 패널 사이 경계선. 끌거나 ←/→ 키로 너비를 바꾸고, 두 번 누르면 기본 너비로 돌아가요.
 * 1200px 미만에서는 패널이 시트로 덮이므로 CSS에서 숨겨요.
 */
export function PanelResizer({
  currentWidth,
  width,
  onChange,
  onDraggingChange,
  side = "right",
}: PanelResizerProps) {
  const grow = side === "left" ? -1 : 1;
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault(); // 끄는 동안 본문 글자가 선택되지 않게
    drag.current = { x: event.clientX, width: currentWidth() };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onDraggingChange?.(true);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    onChange(drag.current.width + grow * (drag.current.x - event.clientX));
  }
  function up() {
    drag.current = null;
    setDragging(false);
    onDraggingChange?.(false);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const base = width ?? currentWidth();
    if (event.key === "ArrowLeft") onChange(base + grow * KEY_STEP);
    else if (event.key === "ArrowRight") onChange(base - grow * KEY_STEP);
    else if (event.key === "Home") onChange(null);
    else return;
    event.preventDefault();
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("패널 너비 조절")}
      aria-valuemin={PANEL_MIN_WIDTH}
      aria-valuemax={PANEL_MAX_WIDTH}
      aria-valuenow={width ?? undefined}
      tabIndex={0}
      title={t("끌어서 너비 조절 · 두 번 누르면 기본 너비")}
      className={`margin-panel-resizer ${dragging ? "dragging" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onLostPointerCapture={up}
      onDoubleClick={() => onChange(null)}
      onKeyDown={key}
    />
  );
}
