import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ReactElement,
} from "react";
import { useParams } from "react-router-dom";
import {
  Option,
  SegmentedControl,
  SegmentedControlItem,
  Select,
} from "@montage-ui/core";
import { useWorkspace } from "@/lib/workspace";
import { motion, useReducedMotion, useMotionValue } from "motion/react";
import { Icon } from "./icons";
import { Hint } from "./ui/hint";
/**
 * 선택 상자. 모양·키보드·목록은 Montage Select가 맡습니다.
 * 접근성 이름은 "이름, 현재 값"으로 둬 보이는 글자가 이름에 들어가게 합니다(WCAG 2.5.3).
 */
export function Choice({
  value,
  onChange,
  options,
  label,
  disabled = false,
  id: fieldId,
  compact = false,
  size = compact ? "medium" : "large",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: ReactNode; search?: string }[];
  label: string;
  disabled?: boolean;
  id?: string;
  /** 입력창 도구 줄처럼 좁은 곳: 작은 크기(40px), 내용 너비 */
  compact?: boolean;
  /** 폼 안은 large(48px, 입력 칸과 같음), 목록 위 필터는 medium(40px) */
  size?: "large" | "medium";
}) {
  const current = options.find((o) => o.value === value);
  const currentText = current
    ? (current.search ??
      (typeof current.label === "string" ? current.label : ""))
    : "";
  return (
    <Select
      className="rms-choice"
      id={fieldId}
      size={size}
      width={compact ? "auto" : "100%"}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="선택"
      aria-label={currentText ? `${label}, ${currentText}` : label}
      data-draft-value={value}
    >
      {options.map((o) => (
        <Option key={o.value} value={o.value}>
          {o.label}
        </Option>
      ))}
    </Select>
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
  const [inToolbar, setInToolbar] = useState(false);
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
    setInToolbar(!!host.current?.closest(".student-filter-row, .page-toolbar"));
  }, [props.id]);
  return (
    <span className="select-field-host" ref={host}>
      <Choice
        size={inToolbar ? "medium" : "large"}
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
  options: { value: string; label: string; count?: number; icon?: ReactNode }[];
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
          {o.icon}
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
    <Hint label={label} position="top-center">
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
    </Hint>
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
