import {
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { useWorkspace } from "@/lib/workspace";
import {
  savePanelSide,
  setPanelSide,
  usePanelSide,
  type PanelSide,
} from "@/lib/panel-side";
import { Icon } from "../icons";
import type { MarginPanelEntry } from "../margin-panel/MarginPanel";
import { useOpenSettings } from "../settings/SettingsDialog";
import { Hint } from "../ui/hint";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const FEEDBACK_MAIL = "mailto:admin@margin.com";

export type RailTab = "assistant" | "tasks" | "log" | "materials";

export interface SideRailProps {
  researchId?: string;
  /** 화면이 보낸 패널(0단계 임시 탭, 02 §4.6). 열 수 있는 것이 없으면 없음. */
  offered?: MarginPanelEntry | null;
  active?: MarginPanelEntry | null;
  /** 열린 실제 탭(연구 도우미, 할 일 P2, 결정·질문 P3, 자료 P4)과 여닫기 */
  openTab?: RailTab | null;
  onTab?(tab: RailTab): void;
  /** 사람이 끌어서 바꾼 사이드 창 너비(없으면 기본 너비) */
  panelWidth?: number | null;
  onResetPanelWidth?(): void;
  /** 맨 위 밀기 버튼: 사이드 창이 열려 있는지와 접기·펼치기 */
  panelOpen?: boolean;
  onTogglePanel?(): void;
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
  panelWidth = null,
  onResetPanelWidth,
  panelOpen = false,
  onTogglePanel,
}: SideRailProps) {
  const side = usePanelSide();
  const location = useLocation();
  const openSettings = useOpenSettings();
  const settingsOpen = new URLSearchParams(location.search).has("settings");
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
      {onTogglePanel && (
        <div className="ia-rail-push">
          <Hint
            label={panelOpen ? t("사이드 창 접기") : t("사이드 창 펼치기")}
            position={side === "left" ? "right-center" : "left-center"}
          >
            <button
              type="button"
              className="ia-rail-item ia-rail-push-button"
              aria-label={
                panelOpen ? t("사이드 창 접기") : t("사이드 창 펼치기")
              }
              aria-expanded={panelOpen}
              aria-controls="margin-panel"
              onClick={onTogglePanel}
            >
              {/* 창을 레일 쪽으로 밀어 넣는 방향(오른쪽 배치면 ≫) */}
              <Icon
                name={
                  (side === "left") === panelOpen
                    ? "chevrons-left"
                    : "chevrons-right"
                }
                size={16}
              />
            </button>
          </Hint>
        </div>
      )}
      {onTab && (
        <>
          <RailButton
            icon="sparkles"
            label={t("도우미")}
            name={t("연구 도우미")}
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
          <RailButton
            icon="folder"
            label={t("자료")}
            name={t("글·자료")}
            pressed={openTab === "materials"}
            onClick={() => onTab("materials")}
          />
        </>
      )}
      {offered && <span className="ia-rail-divider" aria-hidden />}
      {offered && (
        <RailButton
          icon="panel"
          label={offered.label}
          pressed={!!active}
          onClick={() => (active ? active.onClose() : offered.onOpen?.())}
        />
      )}
      <span className="ia-rail-spacer" />
      <a
        className="ia-rail-item"
        href={FEEDBACK_MAIL}
        aria-label={t("의견 보내기")}
      >
        <RailFace icon="message" label={t("의견")} />
      </a>
      <div className="ia-rail-squares">
        <LayoutMenu
          panelWidth={panelWidth}
          onResetPanelWidth={onResetPanelWidth}
        />
        {researchId && (
          <Hint
            label={t("설정")}
            position={side === "left" ? "right-center" : "left-center"}
          >
            <button
              type="button"
              className={`ia-rail-item ia-rail-square ${settingsOpen ? "on" : ""}`}
              aria-label={t("설정")}
              aria-pressed={settingsOpen}
              onClick={() => openSettings("research")}
            >
              <Icon name="gear" size={18} />
            </button>
          </Hint>
        )}
      </div>
    </div>
  );
}

function RailFace({ icon, label }: { icon: string; label: string }): ReactNode {
  return (
    <>
      <span className="ia-rail-icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="ia-rail-label">{label}</span>
    </>
  );
}

function RailButton({
  icon,
  label,
  name,
  pressed,
  onClick,
  controls = "margin-panel",
}: {
  icon: string;
  /** 아이콘 아래 짧은 이름 */
  label: string;
  /** 읽어 주는 전체 이름(짧은 이름과 다를 때만) */
  name?: string;
  pressed: boolean;
  onClick: () => void;
  /** 누르면 여는 영역 id. 창(대화상자)을 여는 버튼이면 null */
  controls?: string | null;
}) {
  return (
    <button
      type="button"
      className={`ia-rail-item ${pressed ? "on" : ""}`}
      aria-label={name}
      aria-pressed={pressed}
      aria-controls={controls ?? undefined}
      onClick={onClick}
    >
      <RailFace icon={icon} label={label} />
    </button>
  );
}

/**
 * 화면 배치 빠른 메뉴(02 §4.1 아래 묶음). 사이드 창 위치와 너비처럼 화면 표시만 다루고,
 * 연구 정보·사람·삭제 같은 연구 설정은 옆의 [설정]이 맡습니다.
 * 위치는 바로 틀에 보이고 계정에 저장해요. 저장에 실패하면 원래 위치로 되돌립니다.
 */
function LayoutMenu({
  panelWidth,
  onResetPanelWidth,
}: {
  panelWidth: number | null;
  onResetPanelWidth?: () => void;
}) {
  const { mode } = useWorkspace();
  const side = usePanelSide();
  const openSettings = useOpenSettings();
  const choose = async (next: PanelSide) => {
    if (next === side) return;
    setPanelSide(next);
    if (mode !== "connected") return;
    try {
      await savePanelSide(next);
    } catch (error) {
      setPanelSide(side);
      toast.error(friendlyError(error));
    }
  };
  return (
    <DropdownMenu value={side}>
      <DropdownMenuTrigger>
        <button
          type="button"
          className="ia-rail-item ia-rail-square"
          aria-label={t("화면 배치")}
          aria-haspopup="menu"
          title={t("화면 배치")}
        >
          <Icon name="panel" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side === "left" ? "right" : "left"}
        align="end"
        className="ia-layout-menu"
      >
        <DropdownMenuLabel>{t("사이드 창 위치")}</DropdownMenuLabel>
        <DropdownMenuItem value="right" onSelect={() => void choose("right")}>
          {t("오른쪽")}
        </DropdownMenuItem>
        <DropdownMenuItem value="left" onSelect={() => void choose("left")}>
          {t("왼쪽")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {panelWidth !== null && onResetPanelWidth && (
          <DropdownMenuItem onSelect={onResetPanelWidth}>
            <Icon name="refresh" size={16} />
            {t("사이드 창 너비 기본으로")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => openSettings("display")}>
          <Icon name="settings" size={16} />
          {t("화면 설정 모두 보기")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
