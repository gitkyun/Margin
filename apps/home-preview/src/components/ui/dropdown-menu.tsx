import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Divider,
  Menu,
  MenuContent,
  MenuItem,
  MenuItemContent,
  MenuList,
  MenuTrigger,
} from "@montage-ui/core";

/**
 * 동작 메뉴(계정·연구 전환 등). 모양·키보드 이동·닫기는 Montage Menu가 맡습니다.
 * `value`를 주면 그 항목에 Montage 선택 표시(체크)가 붙습니다.
 */
const CloseContext = createContext<() => void>(() => {});

export function DropdownMenu({
  value,
  children,
}: {
  value?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CloseContext.Provider value={() => setOpen(false)}>
      <Menu open={open} onOpenChange={setOpen} value={value ?? ""}>
        {children}
      </Menu>
    </CloseContext.Provider>
  );
}

export function DropdownMenuTrigger({ children }: { children: ReactNode }) {
  return <MenuTrigger>{children}</MenuTrigger>;
}

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

export function DropdownMenuContent({
  side = "bottom",
  align = "center",
  className,
  contentSx,
  children,
}: {
  side?: Side;
  align?: Align;
  className?: string;
  contentSx?: ComponentProps<typeof MenuContent>["sx"];
  children?: ReactNode;
}) {
  return (
    <MenuContent position={`${side}-${align}`} sx={contentSx}>
      <MenuList className={className}>{children}</MenuList>
    </MenuContent>
  );
}

export function DropdownMenuLabel({ children }: { children?: ReactNode }) {
  return <div className="margin-menu-label">{children}</div>;
}

export function DropdownMenuSeparator() {
  return <Divider className="margin-menu-divider" />;
}

/** 글자 앞뒤 아이콘을 Montage 앞·뒤 칸으로 옮깁니다. */
function splitIcons(children: ReactNode) {
  const items = Children.toArray(children);
  const isIcon = (item: unknown): item is ReactElement =>
    isValidElement(item) && typeof item.type !== "string";
  const leading = isIcon(items[0]) ? items.shift() : undefined;
  const trailing =
    items.length > 1 && isIcon(items[items.length - 1])
      ? items.pop()
      : undefined;
  return { leading, body: items, trailing };
}

export function DropdownMenuItem({
  value,
  onSelect,
  children,
}: {
  /** 선택 표시를 붙일 값. 주지 않으면 동작 항목입니다. */
  value?: string;
  onSelect?: () => void;
  children?: ReactNode;
}) {
  const close = useContext(CloseContext);
  const fallback = useId();
  const { leading, body, trailing } = splitIcons(children);
  return (
    <MenuItem
      value={value ?? fallback}
      onClick={() => {
        close();
        onSelect?.();
      }}
      leadingContent={
        leading ? (
          <MenuItemContent variant="icon">{leading}</MenuItemContent>
        ) : undefined
      }
      trailingContent={
        trailing ? (
          <MenuItemContent variant="icon">{trailing}</MenuItemContent>
        ) : undefined
      }
    >
      {body}
    </MenuItem>
  );
}
