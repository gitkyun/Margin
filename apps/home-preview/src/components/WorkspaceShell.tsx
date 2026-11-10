import { BrandMark, BrandWordmark } from "./brand/Brand";
import { formatDateTime } from "@/lib/domain";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Suspense } from "react";
import { toast } from "sonner";
import { Icon } from "./icons";
import { Hint } from "./ui/hint";
import { navPreview } from "@/lib/nav-preview";
import { CommandPalette } from "./CommandPalette";
import { ShortcutHelp } from "./ShortcutHelp";
import { RESEARCH_NAVIGATION } from "@/lib/command-items";
import { goShortcutLabel } from "@/lib/go-shortcuts";
import { useGoShortcuts } from "@/lib/use-go-shortcuts";
import { Button } from "./ui/button";
import { LoadingState } from "./common";
import { useWorkspace } from "@/lib/workspace";
import { useAIUsage } from "@/lib/ai-usage";
import { friendlyError } from "@/lib/supabase";
import { useExperience } from "@/lib/experience";
import { queryDown, queryUp } from "@/design/responsive";
import {
  MarginPanelProvider,
  useMarginPanelHost,
} from "./margin-panel/MarginPanel";
import { startChecklist } from "@/lib/onboarding";
import { isStartChecklistHidden } from "./home/StartChecklist";
import { AnimatedList, Segments } from "./experience";
import {
  unreadReviewNotifications,
  notificationHref,
  activityEnabled,
} from "@/lib/notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
const navigation = RESEARCH_NAVIGATION;
const activityTitles: Record<string, string> = {
  "새 기록이 추가되었습니다": "새 기록을 추가했어요",
  "연구 기록이 변경되었습니다": "기록을 수정했어요",
  "공동연구에 참여했습니다": "공동연구에 참여했어요",
  "수정 결과를 검토에 공개했습니다": "검토 요청에 수정 결과를 넣었어요",
  "새 차수의 재확인을 요청했습니다": "다시 확인을 요청했어요",
  "미팅 시간이 확정되었습니다": "미팅 시간을 정했어요",
  "시간 조율이 취소되었습니다": "시간 조율을 취소했어요",
};
function AccountMenu() {
  const { user, mode, signOut } = useWorkspace(),
    navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false),
    [loggingOut, setLoggingOut] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            className="profile-button"
            aria-label={`${user.name} ${user.email} 계정 메뉴`}
          >
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <Icon name="chevron-down" size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="account-menu">
          <DropdownMenuLabel>
            {user.name}
            <small className="menu-email">{user.email}</small>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/account")}>
            <Icon name="user" size={17} />
            프로필 설정
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/account?tab=usage")}>
            <Icon name="sparkles" size={17} />
            AI 사용량
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => navigate("/account?tab=appearance")}
          >
            <Icon name="monitor" size={17} />
            화면 설정
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/guide")}>
            <Icon name="help" size={17} />
            사용 안내
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
            <Icon name="logout" size={17} />
            {mode === "preview" ? "로그인 화면으로" : "로그아웃"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={logoutOpen}
        onOpenChange={(open: boolean) => {
          if (!loggingOut) setLogoutOpen(open);
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>
              {mode === "preview"
                ? "로그인 화면으로 이동할까요?"
                : "로그아웃할까요?"}
            </DialogTitle>
            <DialogDescription>
              {mode === "preview"
                ? "미리보기 기록은 이 브라우저에 그대로 남아요."
                : "저장한 기록은 그대로 남아요. 저장하지 않은 입력은 사라지니 먼저 저장해 주세요."}
            </DialogDescription>
          </DialogHeader>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={loggingOut}
              onClick={() => setLogoutOpen(false)}
            >
              취소
            </Button>
            <Button
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  if (mode === "connected") await signOut();
                  navigate("/login");
                } catch (e) {
                  toast.error(friendlyError(e));
                } finally {
                  setLoggingOut(false);
                }
              }}
            >
              {mode === "preview"
                ? "이동"
                : loggingOut
                  ? "로그아웃 중"
                  : "로그아웃"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
/** sm 이상 lg 미만(768~1199px). 이 구간에서는 메뉴를 좁은 레일로 두고, 펼치면 본문 위에 뜹니다. */
const COMPACT_QUERY = `${queryUp("sm")} and ${queryDown("lg")}`;
/** 집중 모드에서 메뉴를 직접 펼쳤는지는 둘러보기 모드의 설정과 따로 기억합니다. */
const FOCUS_EXPANDED_KEY = "rms-sidebar-focus-expanded";
/** 작업대처럼 본문을 넓게 써야 하는 화면: 연구 도우미, 글쓰기 문서 편집 */
const FOCUS_ROUTE = /^\/r\/[^/]+\/(assistant(\/|$)|writing\/[^/]+)/;
/** 사이드바 묶음(계획 4.3). 연구 홈 → 지도 흐름 → 연구 작업 순서입니다. */
const NAV_GROUPS: { label: string | null; paths: string[] }[] = [
  { label: null, paths: [""] },
  { label: "지도 흐름", paths: ["meetings", "feedback", "tasks", "reviews"] },
  { label: "연구 작업", paths: ["writing", "materials", "planning"] },
];
/** AI 사용량은 한도의 이 비율을 넘었을 때만 사이드바 아래 자리에 냅니다. */
const USAGE_WARNING_RATIO = 0.8;

export function WorkspaceShell({
  children,
  researchOverride,
}: { children?: ReactNode; researchOverride?: string } = {}) {
  const params = useParams();
  const researchId = researchOverride ?? params.researchId;
  const { data, user, mode, markEvent } = useExperience(),
    navigate = useNavigate(),
    location = useLocation();
  const research = data.researches.find((r) => r.id === researchId);
  const [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("rms-sidebar-collapsed") === "true",
    ),
    [narrow, setNarrow] = useState(
      () =>
        typeof window.matchMedia === "function" &&
        window.matchMedia(COMPACT_QUERY).matches,
    ),
    [narrowOpen, setNarrowOpen] = useState(false),
    [focusExpanded, setFocusExpanded] = useState(
      () => localStorage.getItem(FOCUS_EXPANDED_KEY) === "true",
    ),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [shortcutsOpen, setShortcutsOpen] = useState(false),
    [notifications, setNotifications] = useState(false);
  const usage = useAIUsage();
  const updates = unreadReviewNotifications(data, user, researchId);
  const [notificationFilter, setNotificationFilter] = useState("unread");
  const events = data.events.filter(
    (e) =>
      (!researchId || e.researchId === researchId) &&
      activityEnabled(e, user, data),
  );
  const newEvents = events.filter((e) => !e.readAt);
  const totalUnread = updates.length + newEvents.length;
  const incomingOnly =
    data.researches.length === 0 &&
    data.reviews.some(
      (request) =>
        request.professorId === user.id && request.status === "shared",
    );
  const homeLabel = incomingOnly ? "받은 검토 요청" : "내 연구";
  useGoShortcuts(research ? researchId : undefined);
  const panel = useMarginPanelHost();
  // ] 키로 여백 패널을 여닫습니다(입력 중이거나 조합 키와 함께일 때는 제외).
  const panelRef = useRef(panel);
  panelRef.current = panel;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "]" || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      const { active, offered } = panelRef.current;
      if (active) active.onClose();
      else if (offered?.onOpen) offered.onOpen();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // 768~1199px에서는 메뉴가 본문을 누르지 않게 좁은 레일로 시작합니다. 펼치면 본문 위에 뜨고,
  // 펼친 것은 저장하지 않으며 화면을 옮기면 다시 접습니다.
  // 그보다 넓은 화면에서도 집중 모드(작업대 화면, 여백 패널이 열린 동안)에는 레일로 접습니다.
  const focusMode = FOCUS_ROUTE.test(location.pathname) || !!panel.active;
  const railed = narrow ? !narrowOpen : focusMode ? !focusExpanded : collapsed;
  const floating = narrow && narrowOpen;
  useEffect(() => {
    if (!floating) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNarrowOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [floating]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(COMPACT_QUERY);
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    setMobile(false);
    setNarrowOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const current =
    location.pathname === "/account"
      ? "계정 설정"
      : location.pathname.endsWith("/settings")
        ? "연구 설정"
        : location.pathname.endsWith("/assistant")
          ? "연구 도우미"
          : location.pathname.includes("/tasks")
            ? "할 일"
            : location.pathname.includes("/results")
              ? "수정 결과"
              : (navigation.find(
                  ([path]) => path && location.pathname.includes("/" + path),
                )?.[2] ?? (research ? "연구 홈" : homeLabel));
  useEffect(() => {
    document.title = `${current}${research ? ` · ${research.name}` : ""} · 마진`;
  }, [current, research?.name]);
  if (researchId && (!research || research.deletedAt))
    return (
      <div className="not-found">
        <Icon name="lock" size={32} />
        <h1>이 연구를 열 수 없어요</h1>
        <p>휴지통에 있거나 접근 권한이 없는 연구예요.</p>
        <Button asChild>
          <Link to="/r">내 연구로 돌아가기</Link>
        </Button>
      </div>
    );
  // 사이드바 아래 자리는 하나만 씁니다: 시작 체크리스트(다 못 했을 때) → AI 사용량(한도에 가까울 때) → 비움.
  const checklist = research ? startChecklist(data, research.id) : [];
  const startDone = checklist.filter((item) => item.done).length;
  const showStart =
    !!research &&
    startDone < checklist.length &&
    !isStartChecklistHidden(research.id);
  const usageHigh =
    !!usage.data &&
    usage.data.limit > 0 &&
    usage.data.total / usage.data.limit >= USAGE_WARNING_RATIO;
  const menu = (
    <>
      <div className="sidebar-brand">
        <Link to="/r" className="brand" aria-label="마진(Margin) 내 연구">
          <BrandMark />
          <BrandWordmark />
        </Link>
        <span className="icon-button sidebar-toggle">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={railed ? "메뉴 펼치기" : "메뉴 접기"}
            onClick={() => {
              if (narrow) {
                setNarrowOpen(!narrowOpen);
                return;
              }
              if (focusMode) {
                setFocusExpanded(!focusExpanded);
                localStorage.setItem(
                  FOCUS_EXPANDED_KEY,
                  String(!focusExpanded),
                );
                return;
              }
              setCollapsed(!collapsed);
              localStorage.setItem("rms-sidebar-collapsed", String(!collapsed));
            }}
          >
            <Icon name={railed ? "menu" : "chevron-left"} size={16} />
          </Button>
        </span>
      </div>
      {research && (
        <DropdownMenu value={researchId}>
          <DropdownMenuTrigger>
            <button className="workspace-switch" title={research.name}>
              <span className="workspace-symbol">
                <Icon name="book" size={17} />
              </span>
              <strong>{research.name}</strong>
              <Icon name="chevron-down" size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="workspace-menu" align="start">
            <DropdownMenuLabel>연구 전환</DropdownMenuLabel>
            {data.researches
              .filter(
                (r) => !r.deletedAt && (!r.archivedAt || r.id === researchId),
              )
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
              모든 연구 보기
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/r/new")}>
              <Icon name="plus" size={17} />새 연구 만들기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <button
        className="sidebar-search"
        onClick={() => setSearch(true)}
        title={research ? "이 연구에서 제목 찾기" : "연구 이름 찾기"}
      >
        <Icon name="search" size={18} />
        <span>{research ? "이 연구에서 찾기" : "연구 찾기"}</span>
        <kbd>⌘ K</kbd>
      </button>
      <nav className="nav-list" aria-label="주요 메뉴">
        {research ? (
          NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label ?? "home"}>
              {group.label && <p className="nav-group-label">{group.label}</p>}
              {navigation
                .filter(([path]) => group.paths.includes(path))
                .sort(
                  (a, b) =>
                    group.paths.indexOf(a[0]) - group.paths.indexOf(b[0]),
                )
                .map(([path, icon, label]) => {
                  const preview = navPreview(
                    path,
                    label,
                    data,
                    researchId ?? "",
                  );
                  return (
                    <Hint
                      key={path}
                      label={label}
                      detail={preview?.detail}
                      shortcut={goShortcutLabel(path)}
                      position="right-center"
                      display="block"
                    >
                      <NavLink
                        end={!path}
                        to={`/r/${researchId}${path ? "/" + path : ""}`}
                        className={({ isActive }) =>
                          `nav-item ${isActive || (path === "feedback" && location.pathname.includes("/results")) ? "active" : ""}`
                        }
                      >
                        <Icon name={icon} size={20} />
                        <span>{label}</span>
                      </NavLink>
                    </Hint>
                  );
                })}
            </div>
          ))
        ) : (
          <NavLink to="/r" className="nav-item">
            <Icon name="grid" size={20} />
            <span>{homeLabel}</span>
          </NavLink>
        )}
        {research && (
          <Hint
            label="연구 도우미"
            detail="선택한 기록으로만 AI 도움을 받아요."
            position="right-center"
            display="block"
          >
            <NavLink
              to={`/r/${researchId}/assistant`}
              className={({ isActive }) =>
                `nav-item assistant-nav ${isActive ? "active" : ""}`
              }
            >
              <Icon name="sparkles" size={20} />
              <span>연구 도우미</span>
            </NavLink>
          </Hint>
        )}
      </nav>
      <div className="sidebar-bottom">
        {research && (
          <Link
            className="nav-item"
            title="연구 설정"
            to={`/r/${researchId}/settings`}
          >
            <Icon name="settings" size={20} />
            <span>연구 설정</span>
          </Link>
        )}
        <Link
          className="nav-item"
          title="내 연구 전체 보기"
          to="/r"
          hidden={!research}
        >
          <Icon name="grid" size={20} />
          <span>모든 연구</span>
        </Link>
        {showStart ? (
          <Link
            className="sidebar-usage sidebar-start"
            title="시작하기 체크리스트 보기"
            to={`/r/${researchId}`}
          >
            <div>
              <Icon name="check-circle" size={15} />
              <span>시작하기</span>
              <strong>
                {startDone} / {checklist.length}
              </strong>
            </div>
            <progress
              max={checklist.length}
              value={startDone}
              aria-label="시작하기 진행"
            />
          </Link>
        ) : usageHigh ? (
          <Link
            className="sidebar-usage"
            title="AI 사용량 보기"
            to="/account?tab=usage"
          >
            <div>
              <Icon name="sparkles" size={15} />
              <span>AI 사용량</span>
              <strong>
                {usage.data
                  ? `${usage.data.total} / ${usage.data.limit}`
                  : "보기"}
              </strong>
            </div>
            {usage.data ? (
              <progress
                max={usage.data.limit}
                value={usage.data.total}
                aria-label="최근 24시간 AI 사용량"
              />
            ) : (
              <small>선택한 기록으로만 실행해요.</small>
            )}
          </Link>
        ) : null}
        <AccountMenu />
      </div>
    </>
  );
  return (
    <div
      className={`app-shell floating-workspace ${railed ? "sidebar-collapsed" : ""} ${floating ? "sidebar-floating" : ""} ${panel.active ? "margin-panel-open" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <aside className="sidebar">{menu}</aside>
      {floating && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="메뉴 접기"
          tabIndex={-1}
          onClick={() => setNarrowOpen(false)}
        />
      )}
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="mobile-sidebar rms-mobile-sheet">
          <SheetHeader className="sr-only">
            <SheetTitle>연구 메뉴</SheetTitle>
            <SheetDescription>
              다른 연구로 바꾸거나 화면을 이동해요.
            </SheetDescription>
          </SheetHeader>
          {/* Close the sheet on any link tap, including the current page's
              link (a same-path tap does not change location.pathname). */}
          <div
            style={{ display: "contents" }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a[href]"))
                setMobile(false);
            }}
          >
            {menu}
          </div>
        </SheetContent>
      </Sheet>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span className="mobile-menu icon-button">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="메뉴 열기"
                onClick={() => setMobile(true)}
              >
                <Icon name="menu" />
              </Button>
            </span>
            <Link
              to={research ? `/r/${researchId}` : "/r"}
              title={research?.name}
            >
              {research?.name ?? homeLabel}
            </Link>
            {research && (
              <>
                <Icon name="chevron-right" size={13} />
                <strong>{current}</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            {panel.offered && (
              <Hint
                label={panel.offered.label}
                detail="오른쪽 여백 패널을 열거나 닫아요. 단축키 ]"
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="margin-panel-toggle"
                  aria-pressed={!!panel.active}
                  aria-label={`${panel.offered.label} ${panel.active ? "닫기" : "열기"}`}
                  onClick={() =>
                    panel.active
                      ? panel.active.onClose()
                      : panel.offered?.onOpen?.()
                  }
                >
                  <Icon name="panel" size={19} />
                </Button>
              </Hint>
            )}
            <Hint
              label="사용 안내"
              detail="키보드 단축키는 ? 키로 볼 수 있어요."
            >
              <Button asChild variant="ghost" size="icon-sm">
                <Link aria-label="사용 안내" to="/guide">
                  <Icon name="help" size={19} />
                </Link>
              </Button>
            </Hint>
            <Hint
              label="알림"
              detail={
                totalUnread ? `새 알림 ${totalUnread}개` : "새 알림이 없어요."
              }
              position="bottom-end"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                className="notification-trigger"
                aria-label={`새 알림 ${totalUnread}개 보기`}
                onClick={() => setNotifications(true)}
              >
                <Icon name="bell" size={20} />
                {totalUnread > 0 && <i />}
              </Button>
            </Hint>
          </div>
        </header>
        {mode === "preview" && (
          <div className="preview-banner">
            <Icon name="info" size={15} />
            <span>미리보기 · 가상 기록은 이 브라우저에만 저장돼요.</span>
            <Link to="/login">
              로그인 화면으로
              <Icon name="arrow-up-right" size={14} />
            </Link>
          </div>
        )}
        {research?.archivedAt && (
          <div className="archived-banner" role="status">
            <Icon name="folder" size={17} />
            <span>
              보관한 연구예요. 기록과 공유 중인 검토 요청은 그대로예요.
            </span>
            <Link to={`/r/${researchId}/settings?tab=lifecycle`}>
              연구 복원하기
            </Link>
          </div>
        )}
        <div className="workspace-body">
          <main id="main-content" className="workspace-content">
            <MarginPanelProvider value={panel.context}>
              <Suspense fallback={<LoadingState />}>
                {children ?? <Outlet />}
              </Suspense>
            </MarginPanelProvider>
          </main>
          {panel.active && (
            <button
              type="button"
              className="margin-panel-backdrop"
              aria-label={`${panel.active.label} 닫기`}
              tabIndex={-1}
              onClick={panel.active.onClose}
            />
          )}
          <aside
            className="margin-panel"
            aria-label={panel.active?.label ?? "여백 패널"}
            hidden={!panel.active}
            tabIndex={-1}
            ref={panel.setSlot}
          />
        </div>
        <footer className="workspace-footer">
          <span>마진 · 흩어진 기록을 모아, 다음 연구가 되도록</span>
          <span className="workspace-footer-links">
            <a href="mailto:admin@margin.com">문의 admin@margin.com</a>
            <Link to="/privacy">자료·개인정보 안내</Link>
          </span>
        </footer>
      </div>
      <Sheet open={notifications} onOpenChange={setNotifications}>
        <SheetContent className="notifications-sheet">
          <SheetHeader>
            <SheetTitle>알림</SheetTitle>
            <SheetDescription>
              {data.researches.length === 0
                ? "검토 요청과 댓글, 미팅 시간 조율 소식을 확인하세요."
                : "교수 응답과 댓글, 담당 할 일, 미팅 일정, 공동연구 소식을 확인하세요."}
            </SheetDescription>
          </SheetHeader>
          <div className="notification-content">
            <div className="button-row">
              <Segments
                value={notificationFilter}
                onChange={setNotificationFilter}
                label="알림 필터"
                options={[
                  { value: "unread", label: "읽지 않음", count: totalUnread },
                  { value: "all", label: "전체" },
                ]}
              />
              <Button
                variant="ghost"
                onClick={() =>
                  void markEvent().catch((e) => toast.error(friendlyError(e)))
                }
              >
                검토 알림 빼고 모두 읽음
              </Button>
            </div>
            <AnimatedList>
              {events
                .filter((e) => notificationFilter === "all" || !e.readAt)
                .map((e) => (
                  <Link
                    key={e.id}
                    to={e.href}
                    className="notification-item"
                    onClick={() => {
                      setNotifications(false);
                      void markEvent(e.id).catch((e) =>
                        toast.error(friendlyError(e)),
                      );
                    }}
                  >
                    <span className="notification-event blue">
                      <Icon
                        name={
                          e.kind === "schedule"
                            ? "calendar"
                            : e.kind === "invite"
                              ? "users"
                              : "file"
                        }
                        size={18}
                      />
                    </span>
                    <div>
                      <strong>
                        {e.actorName} · {activityTitles[e.title] ?? e.title}
                      </strong>
                      <p>{e.message}</p>
                      <small>
                        {formatDateTime(e.createdAt)}
                        {e.readAt ? " · 읽음" : ""}
                      </small>
                    </div>
                  </Link>
                ))}
            </AnimatedList>
            {updates.length ? (
              updates.map((event) => (
                <Link
                  key={event.id}
                  to={notificationHref(event)}
                  onClick={() => setNotifications(false)}
                  className="notification-item"
                >
                  <span className={`notification-event ${event.tone}`}>
                    <Icon
                      name={
                        event.kind === "round"
                          ? "send"
                          : event.tone === "green"
                            ? "check"
                            : "message"
                      }
                      size={18}
                    />
                  </span>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.message}</p>
                    {event.excerpt && <blockquote>{event.excerpt}</blockquote>}
                    <small>
                      {event.roundNumber}차 검토 ·{" "}
                      {formatDateTime(event.createdAt)}
                    </small>
                  </div>
                </Link>
              ))
            ) : !(notificationFilter === "all"
                ? events.length
                : newEvents.length) ? (
              <div className="calm-empty">
                <Icon name="bell" size={30} />
                <h3>확인할 새 소식이 없어요.</h3>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <CommandPalette
        open={search}
        onOpenChange={setSearch}
        researchId={research ? researchId : undefined}
      />
      <ShortcutHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
