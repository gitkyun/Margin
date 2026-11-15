import { t } from "@/lib/i18n";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { Icon } from "../icons";
import "./recording.css";

/** 도구 막대와 선택 사이 간격(px) */
const GAP = 8;
/** 막대가 감싸는 상자 가장자리에서 떨어지는 거리(px) */
const EDGE = 4;

export interface SelectionAction {
  key: string;
  label: string;
  icon?: string;
  onSelect(): void;
}

/** 감싸는 상자(position: relative) 기준 좌표. 막대는 이 점 위 가운데에 떠요. */
export interface SelectionAnchor {
  x: number;
  y: number;
}

export interface PickedText {
  text: string;
  start: number;
  end: number;
}

interface SelectionToolbarProps {
  anchor: SelectionAnchor | null;
  actions: SelectionAction[];
  onDismiss(): void;
  label?: string;
}

/**
 * 글을 고르면 그 위에 뜨는 작은 도구 막대(+ 피드백, + 결정, + 질문 등).
 * 선택 영역 바로 뒤 DOM 순서에 두어 Tab으로도 들어갈 수 있고, Esc로 닫혀요.
 * 누를 때 선택이 풀리지 않도록 mousedown 기본 동작을 막아요.
 */
export function SelectionToolbar({
  anchor,
  actions,
  onDismiss,
  label,
}: SelectionToolbarProps) {
  // 위치 계산은 Floating UI가 맡아요. 선택 위 가운데에 두고, 위가 좁으면 아래로 뒤집고,
  // 가장자리에서는 EDGE만큼 띄워 밀어요. 기준점은 감싸는 상자(offsetParent) 기준 좌표예요.
  const { refs, floatingStyles, isPositioned } = useFloating({
    open: !!anchor,
    placement: "top",
    strategy: "absolute",
    middleware: [
      offset(GAP),
      flip({ padding: EDGE }),
      shift({ padding: EDGE }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const { setPositionReference, floating } = refs;
  useLayoutEffect(() => {
    if (!anchor) return;
    setPositionReference({
      getBoundingClientRect: () => {
        const host = (floating.current as HTMLElement | null)?.offsetParent;
        const origin = host?.getBoundingClientRect();
        const x = (origin?.left ?? 0) + anchor.x,
          y = (origin?.top ?? 0) + anchor.y;
        return {
          x,
          y,
          left: x,
          right: x,
          top: y,
          bottom: y,
          width: 0,
          height: 0,
        };
      },
    });
  }, [anchor, floating, setPositionReference]);
  if (!anchor || !actions.length) return null;
  return (
    <div
      ref={refs.setFloating}
      className="selection-toolbar-position"
      style={{
        ...floatingStyles,
        visibility: isPositioned ? undefined : "hidden",
      }}
    >
      <div
        className="selection-toolbar"
        role="toolbar"
        aria-label={label ?? t("고른 글로 만들기")}
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onDismiss();
          }
        }}
      >
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => {
              action.onSelect();
              onDismiss();
            }}
          >
            {action.icon && <Icon name={action.icon} size={14} />}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function relative(host: HTMLElement, x: number, y: number): SelectionAnchor {
  const rect = host.getBoundingClientRect();
  return { x: x - rect.left, y: y - rect.top };
}

/** textarea에서 고른 글. 고른 글이 있을 때만 anchor가 있어요. */
export function useTextareaSelection(
  field: RefObject<HTMLTextAreaElement | null>,
  host: RefObject<HTMLElement | null>,
) {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const clear = useCallback(() => setAnchor(null), []);
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const picked = () => el.selectionStart !== el.selectionEnd;
    const onPointer = (e: MouseEvent) => {
      const h = host.current;
      setAnchor(picked() && h ? relative(h, e.clientX, e.clientY) : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setAnchor(null);
      const h = host.current;
      if (!picked() || !h) return setAnchor(null);
      if (!e.shiftKey && e.key !== "a") return;
      const rect = el.getBoundingClientRect();
      setAnchor(relative(h, rect.left + rect.width / 2, rect.top));
    };
    const onBlur = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !host.current?.contains(next)) setAnchor(null);
    };
    const onInput = () => setAnchor(null);
    el.addEventListener("mouseup", onPointer);
    el.addEventListener("keyup", onKey);
    el.addEventListener("blur", onBlur);
    el.addEventListener("input", onInput);
    return () => {
      el.removeEventListener("mouseup", onPointer);
      el.removeEventListener("keyup", onKey);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("input", onInput);
    };
  }, [field, host]);
  return { anchor, clear };
}

/** 컨테이너 시작부터 (node, offset)까지의 글자 수 */
function offsetIn(container: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** 일반 글(div)에서 고른 범위. 컨테이너 글자 기준 [start, end)를 돌려줘요. */
export function useDomSelection(
  container: RefObject<HTMLElement | null>,
  host: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const [picked, setPicked] = useState<PickedText | null>(null);
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const clear = useCallback(() => {
    setPicked(null);
    setAnchor(null);
  }, []);
  useEffect(() => {
    const el = container.current;
    if (!el || !enabled) return;
    const read = () => {
      const selection = window.getSelection(),
        h = host.current;
      if (!selection || selection.isCollapsed || !selection.rangeCount || !h)
        return null;
      const range = selection.getRangeAt(0);
      if (
        !el.contains(range.startContainer) ||
        !el.contains(range.endContainer)
      )
        return null;
      const start = offsetIn(el, range.startContainer, range.startOffset),
        end = offsetIn(el, range.endContainer, range.endOffset);
      const text = range.toString();
      if (!text.trim()) return null;
      const rect = range.getBoundingClientRect();
      return {
        picked: {
          text,
          start: Math.min(start, end),
          end: Math.max(start, end),
        },
        anchor: relative(h, rect.left + rect.width / 2, rect.top),
      };
    };
    const show = () => {
      const next = read();
      setPicked(next?.picked ?? null);
      setAnchor(next?.anchor ?? null);
    };
    const onChange = () => {
      // 드래그 중에는 막대를 띄우지 않고, 선택이 풀리면 바로 닫아요.
      const selection = window.getSelection();
      if (
        !selection ||
        selection.isCollapsed ||
        !selection.rangeCount ||
        !el.contains(selection.getRangeAt(0).commonAncestorContainer)
      )
        clear();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
      else if (e.shiftKey) show();
    };
    const onScroll = () => {
      if (window.getSelection()?.isCollapsed === false) show();
    };
    el.addEventListener("mouseup", show);
    el.addEventListener("keyup", onKey);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      el.removeEventListener("mouseup", show);
      el.removeEventListener("keyup", onKey);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [container, host, enabled, clear]);
  return { picked, anchor, clear };
}
