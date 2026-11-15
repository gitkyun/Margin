import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { t } from "@/lib/i18n";
import {
  RESPONSE_MAX_WIDTH,
  RESPONSE_MIN_WIDTH,
  keyResponseWidth,
} from "./column-width";

interface ColumnResizerProps {
  /** 지금 응답 열의 실제 너비(px). 끌기 시작점으로 써요. */
  currentWidth(): number;
  width: number | null;
  onChange(width: number | null): void;
}

/**
 * 가운데 문서(PDF) 열과 오른쪽 응답·댓글 열 사이 경계선.
 * 끌거나 ←/→로 조절하고, 두 번 누르거나 Home을 누르면 기본 너비로 돌아가요.
 * 1200px 미만에서는 그리지 않아요(기존 배치 유지).
 */
export function ColumnResizer({
  currentWidth,
  width,
  onChange,
}: ColumnResizerProps) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault(); // 끄는 동안 글자가 선택되지 않게
    drag.current = { x: event.clientX, width: currentWidth() };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    // 경계를 왼쪽으로 끌면 오른쪽 열이 넓어져요.
    onChange(drag.current.width + (drag.current.x - event.clientX));
  }
  function up() {
    drag.current = null;
    setDragging(false);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const next = keyResponseWidth(width ?? currentWidth(), event.key);
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("문서 열과 댓글 열 너비 조절")}
      aria-valuemin={RESPONSE_MIN_WIDTH}
      aria-valuemax={RESPONSE_MAX_WIDTH}
      aria-valuenow={width ?? undefined}
      tabIndex={0}
      title={t("끌어서 너비 조절 · 두 번 누르면 기본 너비")}
      className={`review-column-resizer ${dragging ? "dragging" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={() => onChange(null)}
      onKeyDown={key}
    />
  );
}
