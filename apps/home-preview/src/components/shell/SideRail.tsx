import {
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { t } from "@/lib/i18n";
import { Icon } from "../icons";
import type { MarginPanelEntry } from "../margin-panel/MarginPanel";
import { useOpenSettings } from "../settings/SettingsDialog";

const FEEDBACK_MAIL = "mailto:admin@margin.com";

export type RailTab = "assistant" | "tasks" | "log";

export interface SideRailProps {
  researchId?: string;
  /** 화면이 보낸 패널(0단계 임시 탭, 02 §4.6). 열 수 있는 것이 없으면 없음. */
  offered?: MarginPanelEntry | null;
  active?: MarginPanelEntry | null;
  /** 열린 실제 탭(연구 도우미, 할 일 P2, 결정·질문 P3)과 여닫기 */
  openTab?: RailTab | null;
  onTab?(tab: RailTab): void;
}

/**
 * IA v2 아이콘 줄(02 §4.1, D14). 아이콘 아래에 이름을 글자로 둡니다.
 * 연구 도우미도 다른 탭처럼 사이드 창을 엽니다(화면 이동 없음). 전체 화면은 창 안에서 엽니다.
 * 화면이 패널을 보내면 '이 화면' 임시 탭을 둡니다.
 */
export function SideRail({
  researchId,
  offered,
  active,
  openTab = null,
  onTab,
}: SideRailProps) {
  const location = useLocation();
  const openSettings = useOpenSettings();
  const ref = useRef<HTMLDivElement>(null);

  // 초점 하나만 Tab 순서에 둡니다(02 §4.1). 마지막으로 초점을 받은 버튼을 기억하고,
  // 그 버튼이 사라지면 첫 버튼으로 돌아갑니다.
  const current = useRef<HTMLElement | null>(null);
  const items = () =>
    Array.from(
      ref.current?.querySelectorAll<HTMLElement>(".ia-rail-item") ?? [],
    );
  const rove = (target: HTMLElement | null) => {
    const list = items();
    const keep = target && list.includes(target) ? target : (list[0] ?? null);
    current.current = keep;
    for (const item of list) item.tabIndex = item === keep ? 0 : -1;
  };
  useLayoutEffect(() => rove(current.current));
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).classList.contains("ia-rail-item"))
      rove(event.target as HTMLElement);
  };

  // 세로 툴바: 위·아래 화살표로 버튼 사이를 옮깁니다(02 §4.1).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    list[(index + step + list.length) % list.length]?.focus();
  };

  return (
    <div
      ref={ref}
      className="ia-rail"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={t("옆 창 열기")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {onTab && (
        <>
          <RailButton
            icon="sparkles"
            label={t("연구 도우미")}
            pressed={openTab === "assistant"}
            onClick={() => onTab("assistant")}
          />
          <RailButton
            icon="tasks"
            label={t("할 일")}
            pressed={openTab === "tasks"}
            onClick={() => onTab("tasks")}
          />
          <RailButton
            icon="flag"
            label={t("결정·질문")}
            pressed={openTab === "log"}
            onClick={() => onTab("log")}
          />
        </>
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
        <RailButton
          icon="settings"
          label={t("설정")}
          pressed={new URLSearchParams(location.search).has("settings")}
          onClick={() => openSettings("research")}
          controls={null}
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

function RailButton({
  icon,
  label,
  pressed,
  onClick,
  controls = "margin-panel",
}: {
  icon: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
  /** 누르면 여는 영역 id. 창(대화상자)을 여는 버튼이면 null */
  controls?: string | null;
}) {
  return (
    <button
      type="button"
      className={`ia-rail-item ${pressed ? "on" : ""}`}
      aria-pressed={pressed}
      aria-controls={controls ?? undefined}
      onClick={onClick}
    >
      <RailFace icon={icon} label={label} />
    </button>
  );
}
