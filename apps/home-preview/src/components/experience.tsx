import {
  Children,
  isValidElement,
  useId,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ReactElement,
} from "react";
import { Popover, Tooltip } from "radix-ui";
import { useParams } from "react-router-dom";
import { useWorkspace } from "@/lib/workspace";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { Icon } from "./icons";
import { SearchField } from "./SearchField";
export function Choice({
  value,
  onChange,
  options,
  label,
  disabled = false,
  id: fieldId,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: ReactNode; search?: string }[];
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchable = options.length > 7;
  const filtered = options.filter(
    (o) =>
      !query ||
      (o.search ?? String(o.label)).toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (!open) return;
    const option = menuRef.current?.querySelector<HTMLElement>(
      `[id="${id}-${active}"]`,
    );
    option?.scrollIntoView?.({ block: "nearest" });
    if (!searchable) option?.focus();
  }, [active, open, id, searchable]);
  function select(value: string) {
    onChange(value);
    setOpen(false);
  }
  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setQuery("");
        setActive(
          Math.max(
            0,
            options.findIndex((o) => o.value === value),
          ),
        );
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="rms-choice"
          id={fieldId}
          disabled={disabled}
          aria-label={label}
          aria-haspopup="listbox"
        >
          <span>{options.find((o) => o.value === value)?.label ?? "선택"}</span>
          <Icon name="chevron-down" size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={menuRef}
          className="rms-choice-menu"
          sideOffset={6}
          align="start"
          collisionPadding={12}
          onEscapeKeyDown={(event) => {
            if (searchRef.current?.value) {
              event.preventDefault();
              setQuery("");
              setActive(0);
              searchRef.current.focus();
            }
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (searchable) searchRef.current?.focus();
            else
              menuRef.current
                ?.querySelector<HTMLElement>(`[id="${id}-${active}"]`)
                ?.focus();
          }}
          onKeyDown={(e) => {
            if (
              e.defaultPrevented ||
              (e.target instanceof Element && e.target.closest(".search-clear"))
            )
              return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((active + 1) % Math.max(filtered.length, 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(
                (active + filtered.length - 1) % Math.max(filtered.length, 1),
              );
            }
            if (e.key === "Enter" && filtered[active]) {
              e.preventDefault();
              select(filtered[active].value);
            }
            if (!searchable && (e.key === "Home" || e.key === "End")) {
              e.preventDefault();
              setActive(
                e.key === "Home" ? 0 : Math.max(filtered.length - 1, 0),
              );
            }
          }}
        >
          <div className="choice-menu-label">{label}</div>
          {searchable && (
            <SearchField
              inputRef={searchRef}
              compact
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-label={`${label} 검색`}
              aria-controls={id}
              aria-activedescendant={
                filtered[active] ? `${id}-${active}` : undefined
              }
              value={query}
              onValueChange={(next) => {
                setQuery(next);
                setActive(0);
              }}
              placeholder="이름으로 찾기"
            />
          )}
          <div
            role="listbox"
            id={id}
            aria-label={label}
            className="rms-choice-options"
          >
            {filtered.map((o, i) => (
              <button
                type="button"
                id={`${id}-${i}`}
                key={o.value}
                role="option"
                tabIndex={searchable || i !== active ? -1 : 0}
                aria-selected={o.value === value}
                data-highlighted={i === active || undefined}
                onFocus={() => setActive(i)}
                onPointerMove={() => setActive(i)}
                onClick={() => select(o.value)}
              >
                <span className="choice-option-label">{o.label}</span>
                <span className="choice-check" aria-hidden="true">
                  {o.value === value && <Icon name="check" size={16} />}
                </span>
              </button>
            ))}
            {!filtered.length && <p>검색 결과가 없습니다.</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
function flattenOptions(
  children: ReactNode,
): { value: string; label: ReactNode; search: string }[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const c = child as ReactElement<{ children?: ReactNode; value?: string }>;
    if (c.type === "option")
      return [
        {
          value: String(c.props.value ?? ""),
          label: c.props.children,
          search: Children.toArray(c.props.children).join(""),
        },
      ];
    return flattenOptions(c.props.children);
  });
}
export function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Choice
      id={props.id}
      value={String(props.value ?? "")}
      label={String(props["aria-label"] ?? props.name ?? "항목 선택")}
      disabled={props.disabled}
      options={flattenOptions(props.children)}
      onChange={(value) =>
        props.onChange?.({
          target: { value },
          currentTarget: { value },
        } as React.ChangeEvent<HTMLSelectElement>)
      }
    />
  );
}
export function Segments({
  value,
  onChange,
  options,
  label = "보기 선택",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; count?: number }[];
  label?: string;
}) {
  const id = useId(),
    reduced = useReducedMotion();
  return (
    <div className="rms-segments" role="tablist" aria-label={label}>
      {options.map((o, i) => (
        <button
          role="tab"
          key={o.value}
          type="button"
          aria-selected={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (i + (e.key === "ArrowRight" ? 1 : -1) + options.length) %
                      options.length;
              onChange(options[next].value);
              (
                e.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }
          }}
          onClick={() => onChange(o.value)}
        >
          {o.value === value && (
            <motion.span
              className="segment-highlight"
              layoutId={id}
              transition={{ duration: reduced ? 0 : 0.18 }}
            />
          )}
          <span>
            {o.label}
            {o.count !== undefined && <small>{o.count}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}
// Motion-value pointer radius follows Magic UI's MIT Magic Card approach; opaque content stays readable.
export function MagicCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const x = useMotionValue(-500),
    y = useMotionValue(-500),
    ref = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion();
  return (
    <div
      ref={ref}
      className={`rms-magic-card ${className}`}
      onPointerMove={(e) => {
        if (reduced) return;
        const b = ref.current!.getBoundingClientRect();
        x.set(e.clientX - b.left);
        y.set(e.clientY - b.top);
      }}
      onPointerLeave={() => {
        x.set(-500);
        y.set(-500);
      }}
    >
      <motion.div
        className="magic-light"
        style={{ left: x, top: y }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
// Keyed, non-looping arrival animations: no invented events or staggered artificial waits.
export function AnimatedList({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <div className="rms-animated-list">
      {Children.toArray(children).map((child, i) => (
        <motion.div
          key={isValidElement(child) ? (child.key ?? i) : i}
          layout
          initial={reduced ? false : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.16 }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
export function DockItem({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.button
            type="button"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            whileHover={reduced ? undefined : { y: -3, scale: 1.08 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            onClick={onClick}
          >
            {children}
          </motion.button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="rms-control-tooltip"
            side="top"
            sideOffset={12}
          >
            {label}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
export function VisibilityField({
  value,
  onChange,
}: {
  value?: "private" | "shared";
  onChange: (v: "private" | "shared") => void;
}) {
  const { researchId } = useParams();
  const { data } = useWorkspace();
  const research = data.researches.find((r) => r.id === researchId);
  const collaborative = data.members.some(
    (m) =>
      m.researchId === researchId &&
      m.status === "active" &&
      m.userId !== research?.ownerId,
  );
  const options = [{ value: "private", label: "나만 보기" }];
  if (collaborative || value === "shared")
    options.push({
      value: "shared",
      label: collaborative ? "공동연구자와 공유" : "공동 기록 · 참여자 없음",
    });
  return (
    <div className="field visibility-field">
      <span>공개 범위</span>
      {collaborative || value === "shared" ? (
        <Choice
          label="공개 범위"
          value={value ?? "private"}
          onChange={(v) => onChange(v as "private" | "shared")}
          options={options}
        />
      ) : (
        <div className="visibility-private">
          <Icon name="lock" size={16} />
          나만 보기
        </div>
      )}
      <small>
        {collaborative
          ? "교수에게는 검토 요청에서 선택한 내용만 공개됩니다."
          : "참여자를 추가하면 공동 기록을 나눌 수 있습니다."}
      </small>
    </div>
  );
}
