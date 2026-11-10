import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { queryDown } from "@/design/responsive";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/icons";
import "./margin-panel.css";

/** 화면이 셸에 알리는 패널 한 개의 상태 */
export interface MarginPanelEntry {
  id: string;
  label: string;
  open: boolean;
  /** 상단 줄의 패널 버튼으로 열 수 있으면 넘깁니다. */
  onOpen?: () => void;
  onClose: () => void;
}

interface MarginPanelContextValue {
  slot: HTMLElement | null;
  publish(id: string, entry: MarginPanelEntry | null): void;
}

const MarginPanelContext = createContext<MarginPanelContextValue | null>(null);

/** md(992px) 미만에서는 패널이 본문 옆이 아니라 본문 위를 덮습니다. */
const OVERLAY_QUERY = queryDown("md");

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 셸 쪽 절반. 패널 자리(slot)를 만들고, 화면이 알린 패널 가운데 열린 것과
 * 상단 줄 버튼으로 열 수 있는 것을 골라 줍니다.
 */
export function useMarginPanelHost() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [entries, setEntries] = useState<Record<string, MarginPanelEntry>>({});
  const publish = useCallback((id: string, entry: MarginPanelEntry | null) => {
    setEntries((current) => {
      if (!entry) {
        if (!(id in current)) return current;
        const { [id]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [id]: entry };
    });
  }, []);
  const context = useMemo(() => ({ slot, publish }), [slot, publish]);
  const list = Object.values(entries);
  const active = list.find((entry) => entry.open);
  const offered = active ?? list.find((entry) => entry.onOpen);
  const activeId = active?.id;

  // 열면 패널의 첫 조작 요소로, 닫으면 열기 전에 있던 자리로 초점을 돌려줍니다.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!activeId || !slot) return;
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => {
      const section = slot.querySelector<HTMLElement>(
        ".margin-panel-section:not([hidden])",
      );
      (section?.querySelector<HTMLElement>(FOCUSABLE) ?? slot).focus({
        preventScroll: true,
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      const target = opener.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [activeId, slot]);

  // 본문을 덮는 시트일 때만 Esc로 닫습니다.
  const close = active?.onClose;
  useEffect(() => {
    if (!close) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!window.matchMedia?.(OVERLAY_QUERY).matches) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return { context, setSlot, active, offered };
}

export function MarginPanelProvider({
  value,
  children,
}: {
  value: MarginPanelContextValue;
  children: ReactNode;
}) {
  return (
    <MarginPanelContext.Provider value={value}>
      {children}
    </MarginPanelContext.Provider>
  );
}

interface MarginPanelProps {
  /** 보조 기술과 상단 줄 버튼에 쓰는 이름(예: "수정 방법 제안") */
  label: string;
  open: boolean;
  onClose(): void;
  onOpen?(): void;
  children: ReactNode;
}

/**
 * 화면 쪽 절반. 내용을 셸의 오른쪽 여백 패널에 넣습니다.
 * 닫아도 내용은 그대로 살아 있습니다(진행 중인 작업을 끊지 않기 위해).
 * 셸 밖에서 그리면(테스트 등) 그 자리에 그대로 둡니다.
 */
export function MarginPanel({
  label,
  open,
  onClose,
  onOpen,
  children,
}: MarginPanelProps) {
  const context = useContext(MarginPanelContext);
  const id = useId();
  const handlers = useRef({ onClose, onOpen });
  handlers.current = { onClose, onOpen };
  const publish = context?.publish;
  const canOpen = !!onOpen;
  useEffect(() => {
    if (!publish) return;
    publish(id, {
      id,
      label,
      open,
      onOpen: canOpen ? () => handlers.current.onOpen?.() : undefined,
      onClose: () => handlers.current.onClose(),
    });
  }, [publish, id, label, open, canOpen]);
  useEffect(() => {
    if (!publish) return;
    return () => publish(id, null);
  }, [publish, id]);

  const section = (
    <div className="margin-panel-section" hidden={!open}>
      {children}
    </div>
  );
  if (!context) return section;
  return context.slot ? createPortal(section, context.slot) : null;
}

export interface PanelTabOption {
  value: string;
  label: string;
  count?: number;
}

interface PanelFrameProps {
  /** 패널 머리의 이름. 닫기 버튼과 탭 줄의 접근성 이름에도 씁니다. */
  title: string;
  onClose(): void;
  /** 탭이 둘 이상일 때만 탭 줄이 보입니다(최대 세 개). */
  tabs?: PanelTabOption[];
  tab?: string;
  onTab?(tab: string): void;
  className?: string;
  children: ReactNode;
}

/**
 * 여백 패널 안쪽의 공통 틀: 이름, 닫기, 탭 줄(연결·응답·도우미 등).
 * 탭 내용은 `panel-frame-body`로 감싸 넘깁니다.
 */
export function PanelFrame({
  title,
  onClose,
  tabs,
  tab,
  onTab,
  className,
  children,
}: PanelFrameProps) {
  return (
    <section
      className={className ? `panel-frame ${className}` : "panel-frame"}
      aria-label={title}
    >
      <div className="panel-frame-head">
        <h2>{title}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${title} 패널 닫기`}
          onClick={onClose}
        >
          <Icon name="close" size={17} />
        </Button>
      </div>
      {tabs && tabs.length > 1 && tab && onTab && (
        <Tabs
          className="tabs-line"
          label={`${title} 패널`}
          value={tab}
          onChange={onTab}
          options={tabs}
        />
      )}
      {children}
    </section>
  );
}
