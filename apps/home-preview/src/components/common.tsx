import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ReactElement,
} from "react";
import { Icon } from "./icons";
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function EmptyState({
  icon = "folder",
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {typeof icon === "string" ? <Icon name={icon} size={28} /> : icon}
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  return (
    <span className={`status-badge tone-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  const generated = useId(),
    childrenArray = Children.toArray(children);
  const child =
    childrenArray.length === 1 && isValidElement(childrenArray[0])
      ? (childrenArray[0] as ReactElement<{
          id?: string;
          "aria-describedby"?: string;
        }>)
      : null;
  const id = child?.props.id ?? generated,
    hintId = `${id}-hint`;
  return (
    <div className="field">
      <label htmlFor={child ? id : undefined} className="field-label">
        {label}
        {required && <span className="required-indicator">필수</span>}
      </label>
      {child
        ? cloneElement(child, {
            id,
            "aria-describedby":
              [child.props["aria-describedby"], hint ? hintId : undefined]
                .filter(Boolean)
                .join(" ") || undefined,
          })
        : children}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function LoadingState() {
  return (
    <div className="loading-state" role="status" aria-label="불러오는 중">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-row" />
      <div className="skeleton skeleton-row" />
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
const SKELETON_NAV_ROWS = 7;
const SKELETON_TASK_ROWS = 3;
function SkeletonLines({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton skeleton-line" />
      ))}
    </>
  );
}
// Mirrors the shell and the research home bento so the first screen after
// signing in keeps its layout while the workspace loads.
export function HomeSkeleton() {
  return (
    <div className="app-shell home-skeleton" role="status" aria-busy="true">
      <span className="sr-only">연구 홈을 불러오는 중</span>
      <aside className="sidebar" aria-hidden="true">
        <div className="skeleton skeleton-brand" />
        <div className="skeleton-nav">
          <SkeletonLines count={SKELETON_NAV_ROWS} />
        </div>
      </aside>
      <div className="main-shell" aria-hidden="true">
        <div className="topbar">
          <div className="skeleton skeleton-crumb" />
          <div className="skeleton skeleton-avatar" />
        </div>
        <div className="workspace-content">
          <div className="page-header">
            <div>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line skeleton-short" />
            </div>
          </div>
          <div className="home-bento">
            <section className="surface home-next">
              <div className="skeleton skeleton-line skeleton-short" />
              <div className="skeleton skeleton-heading" />
              <div className="skeleton skeleton-panel" />
            </section>
            <section className="surface home-responses">
              <div className="skeleton skeleton-line skeleton-short" />
              <div className="skeleton skeleton-panel" />
            </section>
            <section className="surface home-work">
              <div className="skeleton skeleton-line skeleton-short" />
              <SkeletonLines count={SKELETON_TASK_ROWS} />
            </section>
            <section className="surface home-preparation">
              <div className="skeleton skeleton-line skeleton-short" />
              <SkeletonLines count={2} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
export function DotStatus({ active = false }: { active?: boolean }) {
  return (
    <span
      className={`dot-status ${active ? "is-active" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: 25 }, (_, index) => (
        <i
          key={index}
          style={{ "--dot-index": index } as React.CSSProperties}
        />
      ))}
    </span>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <Icon name="warning" size={18} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          다시 불러오기
        </button>
      )}
    </div>
  );
}
