import { t } from "@/lib/i18n";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Reorder, useDragControls } from "motion/react";
import { moveItem } from "@/lib/meeting-order";
import { Icon } from "../icons";
import { Button } from "../ui/button";
import "./meeting.css";

interface SortableListProps<T> {
  items: readonly T[];
  getKey(item: T): string;
  /** 목록 이름(접근성). 예: ‘물어볼 질문 순서’ */
  label: string;
  /** 항목 하나의 짧은 이름(옮김 안내에 씀) */
  itemName(item: T): string;
  renderItem(item: T): ReactNode;
  /** 바뀐 순서(열쇠 목록)를 저장해요. 실패하면 throw하세요. 원래 순서로 돌아가요. */
  onCommit(keys: string[]): Promise<void>;
  disabled?: boolean;
}

interface RowProps<T> {
  item: T;
  index: number;
  count: number;
  name: string;
  disabled: boolean;
  children: ReactNode;
  onMove(from: number, to: number): void;
  onDragEnd(): void;
}

function SortableRow<T>({
  item,
  index,
  count,
  name,
  disabled,
  children,
  onMove,
  onDragEnd,
}: RowProps<T>) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      as="li"
      className="sortable-row"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        // Alt+↑/↓로 순서를 바꿔요.
        if (!e.altKey || disabled) return;
        if (e.key === "ArrowUp" && index > 0) {
          e.preventDefault();
          onMove(index, index - 1);
        } else if (e.key === "ArrowDown" && index < count - 1) {
          e.preventDefault();
          onMove(index, index + 1);
        }
      }}
    >
      <button
        type="button"
        className="sortable-handle"
        aria-label={t(
          "{name} 끌어서 옮기기. Alt와 위아래 화살표로도 옮길 수 있어요.",
          {
            name,
          },
        )}
        disabled={disabled}
        onPointerDown={(e) => {
          if (!disabled) controls.start(e);
        }}
      >
        <Icon name="menu" size={15} />
      </button>
      <div className="sortable-content">{children}</div>
      <span className="sortable-steps">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={disabled || index === 0}
          aria-label={t("{name} 위로 옮기기", { name })}
          onClick={() => onMove(index, index - 1)}
        >
          <Icon name="arrow-up" size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={disabled || index === count - 1}
          aria-label={t("{name} 아래로 옮기기", { name })}
          onClick={() => onMove(index, index + 1)}
        >
          <Icon name="arrow-up" size={14} className="sortable-down" />
        </Button>
      </span>
    </Reorder.Item>
  );
}

/**
 * 끌어서 순서를 바꾸는 목록. 손잡이를 끌거나, 위·아래 버튼, Alt+↑/↓로 옮겨요.
 * 놓거나 버튼을 누르면 바로 저장하고, 실패하면 원래 순서로 돌아가요.
 */
export function SortableList<T>({
  items,
  getKey,
  label,
  itemName,
  renderItem,
  onCommit,
  disabled = false,
}: SortableListProps<T>) {
  const [order, setOrder] = useState<T[]>(() => [...items]);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const dragging = useRef(false);
  const listId = useId();
  const latest = useRef(order);
  latest.current = order;
  const sourceKey = items.map(getKey).join("|");
  useEffect(() => {
    if (!dragging.current && !busy) setOrder([...items]);
  }, [sourceKey, busy]);

  async function commit(next: T[]) {
    const keys = next.map(getKey);
    if (keys.join("|") === sourceKey) return;
    setBusy(true);
    try {
      await onCommit(keys);
    } catch {
      setOrder([...items]);
      setAnnounce(t("순서를 저장하지 못해 원래대로 돌렸어요."));
    } finally {
      setBusy(false);
    }
  }
  function move(from: number, to: number) {
    const next = moveItem(latest.current, from, to);
    setOrder(next);
    setAnnounce(
      t("{name}을(를) {position}번째로 옮겼어요.", {
        name: itemName(next[to]),
        position: to + 1,
      }),
    );
    void commit(next);
    // 버튼으로 옮긴 뒤에도 같은 항목의 버튼에 초점을 둬요.
    requestAnimationFrame(() => {
      const rows = document.querySelectorAll<HTMLElement>(
        `[data-sortable="${listId}"] > li`,
      );
      rows[to]?.querySelector<HTMLElement>(".sortable-handle")?.focus();
    });
  }
  return (
    <>
      <Reorder.Group
        axis="y"
        as="ol"
        values={order}
        onReorder={(next) => {
          dragging.current = true;
          setOrder(next);
        }}
        className="sortable-list"
        aria-label={label}
        data-sortable={listId}
      >
        {order.map((item, index) => (
          <SortableRow
            key={getKey(item)}
            item={item}
            index={index}
            count={order.length}
            name={itemName(item)}
            disabled={disabled || busy}
            onMove={move}
            onDragEnd={() => {
              dragging.current = false;
              void commit(latest.current);
            }}
          >
            {renderItem(item)}
          </SortableRow>
        ))}
      </Reorder.Group>
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </>
  );
}
