import { Link, useLocation } from "react-router-dom";
import { t, tc } from "@/lib/i18n";
import { Icon } from "../icons";
import { SHELL_MENUS, isMenuActive } from "./shell-menus";

/**
 * 휴대폰 아래 탭 줄(02 §6, Q1). 메뉴 넷 + 연구 도우미.
 * 4단계: 연구 도우미 칸은 화면을 옮기지 않고 사이드 창의 연구 도우미를 여닫습니다(다시 누르면 닫힘).
 * 층의 높이·뒤로 가기로 닫기·세그먼트(D16)는 휴대폰 층 작업에서 더합니다.
 */
export function MobileTabBar({
  researchId,
  assistantOpen,
  onAssistant,
}: {
  researchId: string;
  assistantOpen: boolean;
  onAssistant(): void;
}) {
  const { pathname } = useLocation();
  const assistantName = t("연구 도우미");
  const assistantShort = tc("tabbar", "연구 도우미");
  return (
    <nav className="ia-tabbar" aria-label={t("주요 메뉴")}>
      {SHELL_MENUS.map((menu) => {
        const active = isMenuActive(menu, researchId, pathname);
        return (
          <Link
            key={menu.key}
            to={`/r/${researchId}${menu.path ? "/" + menu.path : ""}`}
            className={`ia-tab ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={menu.tabLabel === menu.label ? undefined : menu.label}
          >
            <Icon name={menu.icon} size={20} />
            <span>{menu.tabLabel}</span>
          </Link>
        );
      })}
      <button
        type="button"
        className={`ia-tab ia-tab-assistant ${assistantOpen ? "active" : ""}`}
        aria-pressed={assistantOpen}
        aria-label={
          assistantShort === assistantName ? undefined : assistantName
        }
        onClick={onAssistant}
      >
        <Icon name="sparkles" size={20} />
        <span>{assistantShort}</span>
      </button>
    </nav>
  );
}
