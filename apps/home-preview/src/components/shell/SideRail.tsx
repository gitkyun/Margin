import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { t } from "@/lib/i18n";
import { Icon } from "../icons";
import type { MarginPanelEntry } from "../margin-panel/MarginPanel";

const FEEDBACK_MAIL = "mailto:admin@margin.com";

export interface SideRailProps {
  researchId?: string;
  /** 화면이 보낸 패널(0단계 임시 탭, 02 §4.6). 열 수 있는 것이 없으면 없음. */
  offered?: MarginPanelEntry | null;
  active?: MarginPanelEntry | null;
}

/**
 * IA v2 아이콘 줄(02 §4.1, D14). 아이콘 아래에 이름을 글자로 둡니다.
 * 0단계에는 사이드 창 탭 내용이 아직 없어 연구 도우미는 지금 화면으로 가는 링크이고,
 * 화면이 패널을 보내면 '이 화면' 임시 탭을 둡니다.
 */
export function SideRail({ researchId, offered, active }: SideRailProps) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const assistantPath = researchId ? `/r/${researchId}/assistant` : undefined;

  // 세로 툴바: 위·아래 화살표로 버튼 사이를 옮깁니다(02 §4.1).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(".ia-rail-item") ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  };

  return (
    <div
      ref={ref}
      className="ia-rail"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={t("옆 창 열기")}
      onKeyDown={onKeyDown}
    >
      {assistantPath && (
        <RailLink
          to={assistantPath}
          icon="sparkles"
          label={t("연구 도우미")}
          pressed={location.pathname.startsWith(assistantPath)}
        />
      )}
      {offered && (
        <RailButton
          icon="panel"
          label={offered.label}
          pressed={!!active}
          onClick={() => (active ? active.onClose() : offered.onOpen?.())}
        />
      )}
      <span className="ia-rail-spacer" />
      <a className="ia-rail-item" href={FEEDBACK_MAIL}>
        <RailFace icon="message" label={t("의견 보내기")} />
      </a>
      {researchId && (
        <RailLink
          to={`/r/${researchId}/settings`}
          icon="settings"
          label={t("설정")}
          pressed={location.pathname.endsWith("/settings")}
        />
      )}
    </div>
  );
}

function RailFace({ icon, label }: { icon: string; label: string }): ReactNode {
  return (
    <>
      <span className="ia-rail-icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="ia-rail-label">{label}</span>
    </>
  );
}

function RailLink({
  to,
  icon,
  label,
  pressed,
}: {
  to: string;
  icon: string;
  label: string;
  pressed: boolean;
}) {
  return (
    <Link
      to={to}
      className={`ia-rail-item ${pressed ? "on" : ""}`}
      aria-current={pressed ? "page" : undefined}
    >
      <RailFace icon={icon} label={label} />
    </Link>
  );
}

function RailButton({
  icon,
  label,
  pressed,
  onClick,
}: {
  icon: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ia-rail-item ${pressed ? "on" : ""}`}
      aria-pressed={pressed}
      aria-controls="margin-panel"
      onClick={onClick}
    >
      <RailFace icon={icon} label={label} />
    </button>
  );
}
