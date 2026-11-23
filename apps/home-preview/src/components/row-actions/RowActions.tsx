import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ContextMenu } from "radix-ui";
import { motion, useMotionValue, useTransform } from "motion/react";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shouldSwipe } from "./swipe";
import "../research-card-menu.css";
import "./row-actions.css";

/**
 * 목록 한 행의 동작 하나. 화면마다 동작 목록을 한 번만 정의하면
 * ⋯ 메뉴·우클릭(데스크톱)·길게 누르기(터치)·Shift+F10(키보드)·스와이프(모바일)가 같은 목록을 씁니다.
 */
export interface RowAction {
  id: string;
  label: string;
  icon: string;
  onSelect(): void;
  danger?: boolean;
  /** 앞에 구분선 */
  separated?: boolean;
  /** 모바일 스와이프에 올릴 동작. 방향마다 하나만. start=오른쪽으로 밀기, end=왼쪽으로 밀기 */
  swipe?: "start" | "end";
}

function MenuItems({
  actions,
  Item,
  Separator,
}: {
  actions: RowAction[];
  Item: (props: { action: RowAction }) => ReactNode;
  Separator: () => ReactNode;
}) {
  return (
    <>
      {actions.map((action) => (
        <Fragment key={action.id}>
          {action.separated && <Separator />}
          <Item action={action} />
        </Fragment>
      ))}
    </>
  );
}

/** 우클릭·길게 누르기 메뉴. 동작이 없으면 브라우저 기본 메뉴를 그대로 둡니다. */
export function RowContextMenu({
  actions,
  disabled = false,
  children,
}: {
  actions: RowAction[];
  disabled?: boolean;
  children: ReactNode;
}) {
  if (!actions.length) return <>{children}</>;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild disabled={disabled}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="research-context-menu">
          <MenuItems
            actions={actions}
            Separator={() => (
              <ContextMenu.Separator className="research-context-separator" />
            )}
            Item={({ action }) => (
              <ContextMenu.Item
                className="research-context-item"
                data-danger={action.danger || undefined}
                onSelect={action.onSelect}
              >
                <Icon name={action.icon} size={16} />
                {action.label}
              </ContextMenu.Item>
            )}
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/** 행 끝의 ⋯ 메뉴. 우클릭 메뉴와 같은 동작을 키보드·터치로도 고를 수 있게 합니다. */
export function RowMoreMenu({
  label,
  actions,
}: {
  label: string;
  actions: RowAction[];
}) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon-xs" aria-label={label}>
          <Icon name="more" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <MenuItems
          actions={actions}
          Separator={() => <DropdownMenuSeparator />}
          Item={({ action }) => (
            <DropdownMenuItem onSelect={action.onSelect}>
              <Icon name={action.icon} size={16} />
              {action.label}
            </DropdownMenuItem>
          )}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useNarrow() {
  const query = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

/**
 * 좁은 화면(767px 이하)에서만 켜지는 스와이프 행. 충분히 밀거나 빠르게 튕기면 그 방향의 동작을 바로 실행해요.
 * 세로 스크롤은 그대로 두고(방향 잠금), 같은 동작은 반드시 메뉴에도 있어요.
 * 넓은 화면에서는 끌기를 켜지 않아 폴더로 끌어 옮기기 같은 데스크톱 끌기와 겹치지 않아요.
 */
export function SwipeRow({
  actions,
  className,
  children,
}: {
  actions: RowAction[];
  className?: string;
  children: ReactNode;
}) {
  const narrow = useNarrow();
  const start = actions.find((a) => a.swipe === "start");
  const end = actions.find((a) => a.swipe === "end");
  const x = useMotionValue(0);
  const startOpacity = useTransform(x, [0, 48], [0, 1]);
  const endOpacity = useTransform(x, [-48, 0], [1, 0]);
  const width = useRef(0);
  const moved = useRef(false);
  if (!narrow || (!start && !end)) return <>{children}</>;
  return (
    <div className={`row-swipe ${className ?? ""}`}>
      {start && (
        <motion.span
          className="row-swipe-hint"
          data-side="start"
          data-danger={start.danger || undefined}
          style={{ opacity: startOpacity }}
          aria-hidden
        >
          <Icon name={start.icon} size={18} />
          {start.label}
        </motion.span>
      )}
      {end && (
        <motion.span
          className="row-swipe-hint"
          data-side="end"
          data-danger={end.danger || undefined}
          style={{ opacity: endOpacity }}
          aria-hidden
        >
          {end.label}
          <Icon name={end.icon} size={18} />
        </motion.span>
      )}
      <motion.div
        className="row-swipe-surface"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: end ? 0.6 : 0, right: start ? 0.6 : 0 }}
        dragSnapToOrigin
        onDragStart={(event) => {
          moved.current = true;
          width.current =
            (event.target as HTMLElement | null)
              ?.closest(".row-swipe")
              ?.getBoundingClientRect().width ?? 0;
        }}
        onDragEnd={(_, info) => {
          const side = shouldSwipe(
            info.offset.x,
            info.velocity.x,
            width.current,
          );
          if (side === "start" && start) start.onSelect();
          if (side === "end" && end) end.onSelect();
        }}
        onClickCapture={(event) => {
          // 끌고 난 직후의 클릭은 행 열기로 이어지지 않게 막아요.
          if (moved.current) {
            event.preventDefault();
            event.stopPropagation();
          }
          moved.current = false;
        }}
        onPointerDown={() => {
          moved.current = false;
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export const rowMenuLabel = (title: string) => t("{title} 메뉴", { title });
