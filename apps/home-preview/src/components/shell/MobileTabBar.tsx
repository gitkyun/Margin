import { Link, useLocation } from "react-router-dom";
import { t } from "@/lib/i18n";
import { Icon } from "../icons";
import { SHELL_MENUS, isMenuActive } from "./shell-menus";

/**
 * 휴대폰 아래 탭 줄(02 §6, Q1). 메뉴 넷 + 연구 도우미.
 * 사이드 창 탭이 아직 없는 0~3단계에는 연구 도우미 칸이 지금 화면으로 가는 링크입니다.
 */
export function MobileTabBar({ researchId }: { researchId: string }) {
  const { pathname } = useLocation();
  const assistantPath = `/r/${researchId}/assistant`;
  const assistantOn = pathname.startsWith(assistantPath);
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
          >
            <Icon name={menu.icon} size={20} />
            <span>{menu.label}</span>
          </Link>
        );
      })}
      <Link
        to={assistantPath}
        className={`ia-tab ${assistantOn ? "active" : ""}`}
        aria-current={assistantOn ? "page" : undefined}
      >
        <Icon name="sparkles" size={20} />
        <span>{t("연구 도우미")}</span>
      </Link>
    </nav>
  );
}
