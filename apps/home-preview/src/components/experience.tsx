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
import { SegmentedControl, SegmentedControlItem } from "@montage-ui/core";
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
  const current = options.find((o) => o.value === value);
  const currentText = current
    ? (current.search ??
      (typeof current.label === "string" ? current.label : ""))
    : "";
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
          // The button shows only the current value; name it "label, value" so
          // the visible text is part of the accessible name (WCAG 2.5.3).
          aria-label={currentText ? `${label}, ${currentText}` : label}
          aria-haspopup="listbox"
          data-draft-value={value}
        >
          <span>{current?.label ?? "선택"}</span>
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
            // 한글 조합을 끝내는 Enter는 선택으로 처리하지 않는다.
            if (
              e.key === "Enter" &&
              !e.nativeEvent.isComposing &&
              filtered[active]
            ) {
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
            {!filtered.length && <p>검색 결과가 없어요.</p>}
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
  const host = useRef<HTMLSpanElement>(null);
  const [fieldLabel, setFieldLabel] = useState("선택");
  useEffect(() => {
    const parent = host.current?.closest(".field, label");
    const explicit = props.id
      ? document.querySelector(`label[for="${CSS.escape(props.id)}"]`)
      : null;
    const label =
      explicit ??
      parent?.querySelector(
        ".field-label, .field-name, :scope > span:first-child",
      );
    const text =
      label?.textContent?.replace(/필수/g, "").trim() ||
      [...(parent?.childNodes ?? [])]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join("")
        .trim();
    if (text) setFieldLabel(text);
  }, [props.id]);
  return (
    <span className="select-field-host" ref={host}>
      <Choice
        id={props.id}
        value={String(props.value ?? "")}
        label={String(props["aria-label"] ?? props.name ?? fieldLabel)}
        disabled={props.disabled}
        options={flattenOptions(props.children)}
        onChange={(value) =>
          props.onChange?.({
            target: { value },
            currentTarget: { value },
          } as React.ChangeEvent<HTMLSelectElement>)
        }
      />
    </span>
  );
}
/**
 * 보기·필터 전환. 모양과 키보드 동작은 Montage SegmentedControl이 맡습니다
 * (radiogroup, 좌우 화살표로 이동하며 바로 선택, 미끄러지는 선택 표시).
 * 개수는 오른쪽 작은 숫자로 붙이고, `fill`은 폼 안에서 너비를 채울 때 씁니다.
 */
export function Segments({
  value,
  onChange,
  options,
  label = "보기 선택",
  size = "medium",
  fill = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; count?: number }[];
  label?: string;
  size?: "small" | "medium" | "large";
  fill?: boolean;
}) {
  return (
    <SegmentedControl
      className={`rms-segments${fill ? " is-fill" : ""}`}
      aria-label={label}
      value={value}
      onValueChange={onChange}
      size={size}
    >
      {options.map((o) => (
        <SegmentedControlItem key={o.value} value={o.value}>
          {o.label}
          {o.count !== undefined && (
            <small className="segment-count">{o.count}</small>
          )}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
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
      label: collaborative
        ? "공동연구자와 공유"
        : "공동 기록 · 공동연구자 없음",
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
          ? "교수님께는 검토 요청에 넣은 내용만 보여요."
          : "공동연구자가 참여하면 기록을 공유할 수 있어요."}
      </small>
    </div>
  );
}
