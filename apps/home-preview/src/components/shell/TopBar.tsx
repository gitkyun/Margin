import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { t } from "@/lib/i18n";
import { navPreview } from "@/lib/nav-preview";
import { createEntries } from "@/lib/command-items";
import { goShortcutLabel } from "@/lib/go-shortcuts";
import type { useExperience } from "@/lib/experience";
import { BrandMark, BrandWordmark } from "../brand/Brand";
import { Icon } from "../icons";
import { Hint } from "../ui/hint";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SHELL_MENUS, isMenuActive } from "./shell-menus";

type WorkspaceData = ReturnType<typeof useExperience>["data"];

export interface TopBarProps {
  data: WorkspaceData;
  researchId?: string;
  researchName?: string;
  incomingOnly: boolean;
  /** 안 읽은 교수 응답·검토 댓글이 있으면 '미팅' 메뉴에 점을 찍습니다(IA v2 02 §3.4). */
  hasReviewUpdates: boolean;
  totalUnread: number;
  onSearch: () => void;
  onNotifications: () => void;
  account: ReactNode;
}

/** IA v2 상단 줄(02 §3): 로고 · 연구 이름 · 메뉴 넷 · 찾기 · 만들기 · 알림 · 계정 */
export function TopBar({
  data,
  researchId,
  researchName,
  incomingOnly,
  hasReviewUpdates,
  totalUnread,
  onSearch,
  onNotifications,
  account,
}: TopBarProps) {
  const location = useLocation();
  const inResearch = !!researchId && !!researchName;
  const searchLabel = inResearch
    ? t("이 연구에서 찾기")
    : incomingOnly
      ? t("검토 요청 찾기")
      : t("연구 찾기");
  return (
    <header className="ia-topbar">
      <Link
        to={inResearch ? `/r/${researchId}` : "/r"}
        className="brand"
        aria-label={
          incomingOnly ? t("마진(Margin) 받은 검토 요청") : t("마진(Margin) 홈")
        }
      >
        <BrandMark />
        <BrandWordmark />
      </Link>
      {inResearch && (
        <ResearchSwitcher
          data={data}
          researchId={researchId}
          researchName={researchName}
        />
      )}
      {inResearch && !incomingOnly && (
        <nav className="ia-nav" aria-label={t("주요 메뉴")} data-tour="flow">
          {SHELL_MENUS.map((menu) => {
            const preview = navPreview(
              menu.previewPath,
              menu.label,
              data,
              researchId,
            );
            const active = isMenuActive(menu, researchId, location.pathname);
            return (
              <Hint
                key={menu.key}
                label={menu.label}
                detail={preview?.detail}
                shortcut={goShortcutLabel(menu.path)}
              >
                <NavLink
                  end={!menu.path}
                  to={`/r/${researchId}${menu.path ? "/" + menu.path : ""}`}
                  className={`ia-nav-item ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span>{menu.label}</span>
                  {menu.key === "meetings" && hasReviewUpdates && (
                    <span className="nav-dot">
                      <span className="sr-only">{t("새 응답 있음")}</span>
                    </span>
                  )}
                </NavLink>
              </Hint>
            );
          })}
        </nav>
      )}
      <button
        type="button"
        className="ia-search"
        onClick={onSearch}
        aria-label={searchLabel}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Icon name="search" size={17} />
        <span>{searchLabel}</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className="ia-topbar-actions">
        {inResearch && !incomingOnly && <CreateMenu researchId={researchId} />}
        <Hint
          label={t("알림")}
          detail={
            totalUnread
              ? t("새 알림 {count}개", { count: totalUnread })
              : t("새 알림이 없어요.")
          }
          position="bottom-end"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="notification-trigger"
            aria-label={t("새 알림 {count}개 보기", { count: totalUnread })}
            onClick={onNotifications}
          >
            <Icon name="bell" size={20} />
            {totalUnread > 0 && <i />}
          </Button>
        </Hint>
        {account}
      </div>
    </header>
  );
}

function ResearchSwitcher({
  data,
  researchId,
  researchName,
}: {
  data: WorkspaceData;
  researchId: string;
  researchName: string;
}) {
  const navigate = useNavigate();
  return (
    <DropdownMenu value={researchId}>
      <DropdownMenuTrigger>
        <button className="workspace-switch ia-switch" title={researchName}>
          <strong>{researchName}</strong>
          <Icon name="chevron-down" size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="workspace-menu" align="start">
        <DropdownMenuLabel>{t("연구 전환")}</DropdownMenuLabel>
        {data.researches
          .filter((r) => !r.deletedAt && (!r.archivedAt || r.id === researchId))
          .map((r) => (
            <DropdownMenuItem
              key={r.id}
              value={r.id}
              onSelect={() => navigate(`/r/${r.id}`)}
            >
              <Icon name="book" size={17} />
              {r.name}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/r")}>
          <Icon name="grid" size={17} />
          {t("모든 연구 보기")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/r/new")}>
          <Icon name="plus" size={17} />
          {t("새 연구 만들기")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateMenu({ researchId }: { researchId: string }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <Hint
        label={t("만들기")}
        detail={t("미팅·할 일·문서 등을 새로 만들어요.")}
      >
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            className="create-menu-trigger"
            aria-label={t("새로 만들기")}
          >
            <Icon name="plus" size={19} />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="create-menu">
        <DropdownMenuLabel>{t("새로 만들기")}</DropdownMenuLabel>
        {createEntries(researchId).map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            onSelect={() => navigate(entry.action.to)}
          >
            <Icon name={entry.icon} size={16} />
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
