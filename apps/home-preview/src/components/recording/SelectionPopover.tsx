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
  useRef,
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
  /** 같은 일을 하는 단축키(예: "H"). 버튼 끝에 보이고 보조 기술에도 알려요. */
  shortcut?: string;
  /** 형광펜 종류처럼 앞에 붙는 색 견본(`data-kind` 값) */
  swatch?: string;
  /** 지금 고른 값이면 true(눌린 버튼으로 알려요) */
  pressed?: boolean;
  /**
   * 옆 ▾로 펼치는 고르기(예: 형광펜 종류). 누르면 막대가 이 목록으로 바뀌고,
   * 고르면 그 일을 하고 닫혀요. 떠 있는 메뉴를 따로 띄우지 않아 고른 글이 풀리지 않아요.
   */
  options?: SelectionAction[];
  /** ▾ 버튼의 접근성 이름 */
  optionsLabel?: string;
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);
  // 고른 곳이 바뀌면 펼친 목록을 접어요.
  useEffect(() => setExpanded(null), [anchor]);
  // 펼치거나 접은 뒤(그려진 다음) 첫 버튼으로 초점을 옮겨 키보드로 이어 고르게 해요.
  // 누른 ▾·‹ 버튼은 바뀐 막대에서 사라지므로, 그리기 전에 옮기면 초점이 문서로 빠져요.
  useEffect(() => {
    if (!focusFirst.current) return;
    focusFirst.current = false;
    bar.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [expanded]);
  if (!anchor || !actions.length) return null;
  const open = actions.find((action) => action.key === expanded);
  const shown = open?.options ?? actions;
  const expand = (key: string | null) => {
    focusFirst.current = true;
    setExpanded(key);
  };
  const button = (action: SelectionAction) => (
    <button
      key={action.key}
      type="button"
      aria-keyshortcuts={action.shortcut}
      aria-pressed={action.pressed}
      onClick={() => {
        action.onSelect();
        onDismiss();
      }}
    >
      {action.swatch ? (
        <span
          className="selection-swatch"
          data-kind={action.swatch}
          aria-hidden="true"
        />
      ) : (
        action.icon && <Icon name={action.icon} size={14} />
      )}
      {action.label}
      {action.shortcut && <kbd aria-hidden="true">{action.shortcut}</kbd>}
    </button>
  );
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
        ref={bar}
        className="selection-toolbar"
        role="toolbar"
        aria-label={
          (open && open.optionsLabel) ?? label ?? t("고른 글로 만들기")
        }
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          // 펼친 목록이면 먼저 원래 막대로 돌아가요.
          if (open) expand(null);
          else onDismiss();
        }}
      >
        {open && (
          <button
            type="button"
            className="selection-toolbar-back"
            aria-label={t("뒤로")}
            onClick={() => expand(null)}
          >
            <Icon name="chevron-left" size={14} />
          </button>
        )}
        {shown.map((action) =>
          !open && action.options?.length ? (
            <span key={action.key} className="selection-split">
              {button(action)}
              <button
                type="button"
                className="selection-split-more"
                aria-label={action.optionsLabel ?? t("더 보기")}
                aria-haspopup="true"
                onClick={() => expand(action.key)}
              >
                <Icon name="chevron-down" size={14} />
              </button>
            </span>
          ) : (
            button(action)
          ),
        )}
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

/**
 * 컨테이너 글자 기준 [start, end)를 문서 선택으로 고릅니다(키보드로 읽기, IA v2 04 §5.1).
 * 고른 범위를 돌려주고, 글자 수가 모자라면 null이에요.
 */
export function selectOffsets(
  container: HTMLElement,
  start: number,
  end: number,
): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0,
    started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && start <= seen + length) {
      range.setStart(node, start - seen);
      started = true;
    }
    if (started && end <= seen + length) {
      range.setEnd(node, end - seen);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return range;
    }
    seen += length;
  }
  return null;
}

/** 일반 글(div)에서 고른 범위. 컨테이너 글자 기준 [start, end)를 돌려줘요. */
export function useDomSelection(
  container: RefObject<HTMLElement | null>,
  host: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const [picked, setPicked] = useState<PickedText | null>(null);
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  // 막대가 떠 있을 때만 스크롤에 따라 자리를 다시 잡아요(키보드로 고르기만 한 때는 띄우지 않음).
  const menuOpen = useRef(false);
  const clear = useCallback(() => {
    menuOpen.current = false;
    setPicked(null);
    setAnchor(null);
  }, []);
  const read = useCallback(() => {
    const el = container.current,
      selection = window.getSelection(),
      h = host.current;
    if (
      !el ||
      !selection ||
      selection.isCollapsed ||
      !selection.rangeCount ||
      !h
    )
      return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer))
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
  }, [container, host]);
  /** 지금 문서 선택을 읽어 둡니다. withMenu면 그 위에 막대도 띄워요. */
  const refresh = useCallback(
    (withMenu: boolean) => {
      const next = read();
      menuOpen.current = withMenu && !!next;
      setPicked(next?.picked ?? null);
      setAnchor(withMenu ? (next?.anchor ?? null) : null);
    },
    [read],
  );
  useEffect(() => {
    const el = container.current;
    if (!el || !enabled) return;
    const show = () => refresh(true);
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
      // Shift+↑/↓는 문장 단위로 고르기만 하고, 막대는 Enter로 엽니다(04 §5.1).
      else if (e.shiftKey && e.key !== "ArrowUp" && e.key !== "ArrowDown")
        show();
    };
    const onScroll = () => {
      if (menuOpen.current && window.getSelection()?.isCollapsed === false)
        show();
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
  }, [container, enabled, clear, refresh]);
  return { picked, anchor, clear, refresh };
}
