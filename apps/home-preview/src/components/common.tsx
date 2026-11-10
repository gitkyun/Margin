import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  ContentBadge,
  FallbackView,
  FallbackViewActionArea,
  FallbackViewContent,
  FallbackViewText,
  Skeleton,
  type ThemeColorsToken,
} from "@montage-ui/core";
import { Icon } from "./icons";
import { Button } from "@/components/ui/button";
/**
 * 화면 머리. 순서는 docs/design/patterns.md §2로 고정합니다:
 * 뒤로 → 제목·상태 배지·행동 → 설명 → 탭 → 도구 줄.
 * 화면에서 머리 요소를 따로 쌓지 말고 이 자리(back·status·tabs·toolbar)를 씁니다.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  back,
  status,
  tabs,
  toolbar,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  /** 상세 화면의 BackLink. */
  back?: ReactNode;
  /** 제목 옆 상태 배지. */
  status?: ReactNode;
  /** 다른 내용 묶음으로 가는 탭(Montage Tab). */
  tabs?: ReactNode;
  /** 보기 전환·찾기·거르기 줄. */
  toolbar?: ReactNode;
}) {
  const header = (
    <header className={tabs ? "page-header has-tabs" : "page-header"}>
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        {status ? (
          <div className="page-title-row">
            <h1 className="page-title">{title}</h1>
            {status}
          </div>
        ) : (
          <h1 className="page-title">{title}</h1>
        )}
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
  if (!back && !tabs && !toolbar) return header;
  return (
    <>
      {back}
      {header}
      {tabs}
      {toolbar && <div className="page-toolbar">{toolbar}</div>}
    </>
  );
}
/**
 * 빈 화면. 모양은 Montage FallbackView(compact)가 맡습니다.
 * Montage는 빈 화면에 그림을 두지 않으므로 `icon`은 받기만 하고 그리지 않습니다.
 */
/**
 * 빈 상태는 이 부품 하나로 통일합니다: 아이콘, 한 줄 제목, 이 화면에서 하는 일
 * 요점 2~3개, 주 행동 하나(docs/design/patterns.md).
 */
export function EmptyState({
  icon,
  title,
  description,
  points,
  action,
}: {
  /** 아이콘 이름(`@/components/icons`) 또는 직접 그린 요소 */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** 이 화면에서 하는 일 요점. 두세 개만 적습니다. */
  points?: string[];
  action?: ReactNode;
}) {
  return (
    <FallbackView
      className="empty-state"
      padding="compact"
      width="100%"
      platform="mobile"
      sm={{ platform: "desktop" }}
    >
      <FallbackViewContent>
        {icon && (
          <span className="empty-state-icon" aria-hidden="true">
            {typeof icon === "string" ? <Icon name={icon} size={22} /> : icon}
          </span>
        )}
        <FallbackViewText title={title} description={description ?? ""} />
        {!!points?.length && (
          <ul className="empty-state-points">
            {points.map((point) => (
              <li key={point}>
                <Icon name="check" size={14} />
                {point}
              </li>
            ))}
          </ul>
        )}
      </FallbackViewContent>
      {action && <FallbackViewActionArea>{action}</FallbackViewActionArea>}
    </FallbackView>
  );
}
type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red";
const BADGE_COLOR: Record<Exclude<BadgeTone, "neutral">, ThemeColorsToken> = {
  blue: "semantic.foreground.brand.primary",
  green: "semantic.foreground.positive.primary",
  amber: "semantic.foreground.cautionary.primary",
  red: "semantic.foreground.negative.primary",
};
/**
 * 상태 표시. 모양은 Montage ContentBadge(small)가 맡습니다.
 * 학생 작업 상태는 solid, 교수 결과는 outlined + 아이콘으로 모양을 나눕니다
 * (docs/design/patterns.md §1, 작업 완료와 교수 결과를 합치지 않음).
 */
export function StatusBadge({
  children,
  tone = "neutral",
  variant = "solid",
  icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  variant?: "solid" | "outlined";
  icon?: ReactNode;
}) {
  return (
    <ContentBadge
      className={`status-badge tone-${tone}`}
      size="small"
      variant={variant}
      leadingContent={icon}
      color={tone === "neutral" ? "neutral" : "accent"}
      accentColor={tone === "neutral" ? undefined : BADGE_COLOR[tone]}
    >
      {children}
    </ContentBadge>
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
/** 아이콘만 있는 버튼. Montage IconButton(normal)을 씁니다. */
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
    <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
      {children}
    </Button>
  );
}
export function LoadingState() {
  return (
    <div className="loading-state" role="status" aria-label="불러오는 중">
      <Skeleton variant="text" width="40%" height={32} />
      <Skeleton variant="rectangle" width="100%" height={160} radius={16} />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="100%" />
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
const SKELETON_NAV_ROWS = 7;
const SKELETON_TASK_ROWS = 3;
function SkeletonLines({
  count,
  height = 16,
}: {
  count: number;
  height?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          variant="rectangle"
          width="100%"
          height={height}
          radius={8}
        />
      ))}
    </>
  );
}
function SkeletonLabel() {
  return <Skeleton variant="text" width="40%" />;
}
// Mirrors the shell and the research home bento so the first screen after
// signing in keeps its layout while the workspace loads. 회색 막대는 Montage Skeleton.
export function HomeSkeleton() {
  return (
    <div className="app-shell home-skeleton" role="status" aria-busy="true">
      <span className="sr-only">연구 홈을 불러오는 중</span>
      <aside className="sidebar" aria-hidden="true">
        <Skeleton variant="rectangle" width={150} height={34} radius={8} />
        <div className="skeleton-nav">
          <SkeletonLines count={SKELETON_NAV_ROWS} height={36} />
        </div>
      </aside>
      <div className="main-shell" aria-hidden="true">
        <div className="topbar">
          <Skeleton variant="text" width={180} />
          <Skeleton variant="circle" width={30} height={30} />
        </div>
        <div className="workspace-content">
          <div className="page-header">
            <div>
              <Skeleton
                variant="rectangle"
                width={210}
                height={30}
                radius={8}
              />
              <SkeletonLabel />
            </div>
          </div>
          <div className="home-bento">
            <section className="surface home-next">
              <SkeletonLabel />
              <Skeleton
                variant="rectangle"
                width="60%"
                height={28}
                radius={8}
              />
              <Skeleton
                variant="rectangle"
                width="100%"
                height={120}
                radius={12}
              />
            </section>
            <section className="surface home-responses">
              <SkeletonLabel />
              <Skeleton
                variant="rectangle"
                width="100%"
                height={120}
                radius={12}
              />
            </section>
            <section className="surface home-work">
              <SkeletonLabel />
              <SkeletonLines count={SKELETON_TASK_ROWS} height={48} />
            </section>
            <section className="surface home-preparation">
              <SkeletonLabel />
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
        <Button variant="link" onClick={retry}>
          다시 불러오기
        </Button>
      )}
    </div>
  );
}
