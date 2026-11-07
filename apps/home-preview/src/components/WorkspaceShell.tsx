import { BrandMark, BrandWordmark } from "./brand/Brand";
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
import { SearchField } from "./SearchField";
import { Button } from "./ui/button";
import { LiquidGlassLayer } from "./LiquidGlassLayer";
import { LoadingState } from "./common";
import { useWorkspace } from "@/lib/workspace";
import { useAIUsage } from "@/lib/ai-usage";
import { friendlyError } from "@/lib/supabase";
import { useExperience } from "@/lib/experience";
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
const navigation = [
  ["", "home", "연구 홈"],
  ["planning", "flag", "계획·일정"],
  ["meetings", "calendar", "미팅"],
  ["writing", "file", "글쓰기"],
  ["feedback", "feedback", "피드백·작업"],
  ["materials", "folder", "자료"],
  ["reviews", "send", "검토 요청"],
];
function AccountMenu() {
  const { user, mode, signOut } = useWorkspace(),
    navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false),
    [loggingOut, setLoggingOut] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="profile-button"
            aria-label={`${user.name} 프로필 메뉴`}
          >
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <Icon name="chevron-down" size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="account-menu glass-surface"
        >
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
            서비스 안내
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
            <DialogTitle>로그아웃할까요?</DialogTitle>
            <DialogDescription>
              저장한 연구 기록은 유지됩니다. 저장하지 않은 입력은 먼저 저장해
              주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={loggingOut}
              onClick={() => setLogoutOpen(false)}
            >
              계속 사용
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
              {loggingOut ? "로그아웃 중" : "로그아웃"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
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
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false);
  const usage = useAIUsage();
  const searchInput = useRef<HTMLInputElement>(null);
  const updates = unreadReviewNotifications(data, user, researchId);
  const [notificationFilter, setNotificationFilter] = useState("unread");
  const events = data.events.filter(
    (e) =>
      (!researchId || e.researchId === researchId) &&
      activityEnabled(e, user, data),
  );
  const newEvents = events.filter((e) => !e.readAt);
  const totalUnread = updates.length + newEvents.length;
  useEffect(() => setMobile(false), [location.pathname]);
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
  const searchResults = research
    ? [
        ...data.documents
          .filter((d) => d.researchId === researchId && !d.archivedAt)
          .map((d) => ({
            id: d.id,
            title: d.title,
            type: "문서",
            path: "writing",
            icon: "file",
          })),
        ...data.meetings
          .filter((r) => r.researchId === researchId && !r.archivedAt)
          .map((r) => ({
            id: r.id,
            title: r.title,
            type: "미팅",
            path: "meetings",
            icon: "calendar",
          })),
        ...data.feedback
          .filter((r) => r.researchId === researchId && !r.archivedAt)
          .map((r) => ({
            id: r.id,
            title: r.title,
            type: "피드백",
            path: "feedback",
            icon: "feedback",
          })),
        ...data.tasks
          .filter((r) => r.researchId === researchId && !r.archivedAt)
          .map((r) => ({
            id: r.id,
            title: r.title,
            type: "할 일",
            path: "tasks",
            icon: "tasks",
          })),
        ...data.materials
          .filter((r) => r.researchId === researchId && !r.archivedAt)
          .map((r) => ({
            id: r.id,
            title: r.title,
            type: "자료",
            path: "materials",
            icon: "file",
          })),
      ]
        .filter(
          (r) =>
            query.trim() &&
            r.title
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
        )
        .slice(0, 12)
    : [];
  const current =
    location.pathname === "/account"
      ? "계정 설정"
      : location.pathname.endsWith("/settings")
        ? "연구 설정"
        : location.pathname.endsWith("/assistant")
          ? "AI 연구 도우미"
          : location.pathname.includes("/results")
            ? "수정 결과"
            : (navigation.find(
                ([path]) => path && location.pathname.includes("/" + path),
              )?.[2] ?? (research ? "연구 홈" : "내 연구"));
  if (researchId && (!research || research.deletedAt))
    return (
      <div className="not-found">
        <Icon name="lock" size={32} />
        <h1>이 연구를 열 수 없습니다.</h1>
        <p>계정과 접근 가능한 연구를 확인해 주세요.</p>
        <Link className="rms-action primary" to="/r">
          내 연구로 돌아가기
        </Link>
      </div>
    );
  const menu = (
    <>
      <div className="sidebar-brand">
        <Link to="/r" className="brand" aria-label="Margin 내 연구">
          <BrandMark />
          <BrandWordmark />
        </Link>
        <button
          className="icon-button sidebar-toggle"
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          onClick={() => {
            setCollapsed(!collapsed);
            localStorage.setItem("rms-sidebar-collapsed", String(!collapsed));
          }}
        >
          <Icon name={collapsed ? "menu" : "chevron-left"} size={16} />
        </button>
      </div>
      {research && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="workspace-switch" title={research.name}>
              <span className="workspace-symbol">
                <Icon name="book" size={17} />
              </span>
              <strong>{research.name}</strong>
              <Icon name="chevron-down" size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="workspace-menu glass-surface"
            align="start"
          >
            <DropdownMenuLabel>연구 전환</DropdownMenuLabel>
            {data.researches
              .filter(
                (r) => !r.deletedAt && (!r.archivedAt || r.id === researchId),
              )
              .map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onSelect={() => navigate(`/r/${r.id}`)}
                >
                  <Icon name="book" size={17} />
                  <span>{r.name}</span>
                  {r.id === researchId && <Icon name="check" size={15} />}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/r")}>
              <Icon name="grid" size={17} />
              모든 연구 보기
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/r?new=1")}>
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
          navigation.map(([path, icon, label]) => (
            <NavLink
              key={path}
              title={label}
              end={!path}
              to={`/r/${researchId}${path ? "/" + path : ""}`}
              className={({ isActive }) =>
                `nav-item ${isActive || (path === "feedback" && (location.pathname.includes("/results") || location.pathname.includes("/tasks"))) ? "active" : ""}`
              }
            >
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </NavLink>
          ))
        ) : (
          <NavLink to="/r" className="nav-item">
            <Icon name="grid" size={20} />
            <span>내 연구</span>
          </NavLink>
        )}
        {research && (
          <NavLink
            to={`/r/${researchId}/assistant`}
            className={({ isActive }) => `nav-item assistant-nav ${isActive ? "active" : ""}`}
            title="연구 도우미 · 선택한 기록으로 AI 도움받기"
          >
            <Icon name="sparkles" size={20} />
            <span>연구 도우미</span>
          </NavLink>
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
                : "집계 보기"}
            </strong>
          </div>
          {usage.data ? (
            <progress
              max={usage.data.limit}
              value={usage.data.total}
              aria-label="AI 요청 사용량"
            />
          ) : (
            <small>선택한 기록으로만 실행합니다.</small>
          )}
        </Link>
        <AccountMenu />
      </div>
    </>
  );
  return (
    <div
      className={`app-shell floating-workspace ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <aside className="sidebar">{menu}</aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="mobile-sidebar rms-mobile-sheet">
          <SheetHeader className="sr-only">
            <SheetTitle>연구 메뉴</SheetTitle>
            <SheetDescription>
              연구를 전환하고 작업 화면으로 이동합니다.
            </SheetDescription>
          </SheetHeader>
          {menu}
        </SheetContent>
      </Sheet>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="메뉴 열기"
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </button>
            <Link to={research ? `/r/${researchId}` : "/r"}>
              {research?.name ?? "내 연구"}
            </Link>
            {research && (
              <>
                <Icon name="chevron-right" size={13} />
                <strong>{current}</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            <Link
              className="icon-button"
              title="서비스 안내"
              aria-label="서비스 안내"
              to="/guide"
            >
              <Icon name="help" size={19} />
            </Link>
            <button
              className="icon-button notification-trigger"
              aria-label={`알림 ${totalUnread}개`}
              onClick={() => setNotifications(true)}
            >
              <Icon name="bell" size={20} />
              {totalUnread > 0 && <i />}
            </button>
          </div>
        </header>
        {mode === "preview" && (
          <div className="preview-banner">
            <Icon name="info" size={15} />
            <span>미리보기 · 이 브라우저에 가상 기록을 저장합니다.</span>
            <Link to="/login">
              실제 계정 로그인
              <Icon name="arrow-up-right" size={14} />
            </Link>
          </div>
        )}
        {research?.archivedAt && (
          <div className="archived-banner" role="status">
            <Icon name="folder" size={17} />
            <span>보관한 연구입니다. 기록과 공유한 검토는 유지됩니다.</span>
            <Link to={`/r/${researchId}/settings`}>연구 복원하기</Link>
          </div>
        )}
        <main id="main-content" className="workspace-content">
          <Suspense fallback={<LoadingState />}>
            {children ?? <Outlet />}
          </Suspense>
        </main>
        <footer className="workspace-footer">
          <span>Margin · 지난 지도를, 다음 연구로.</span>
          <Link to="/privacy">자료·개인정보 안내</Link>
        </footer>
      </div>
      <Sheet open={notifications} onOpenChange={setNotifications}>
        <SheetContent className="notifications-sheet">
          <SheetHeader>
            <SheetTitle>알림</SheetTitle>
            <SheetDescription>
              교수 의견·담당 작업·공동연구·미팅 소식을 확인하세요.
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
                공동 알림 모두 읽음
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
                        {e.actorName} · {e.title}
                      </strong>
                      <p>{e.message}</p>
                      <small>
                        {new Date(e.createdAt).toLocaleString("ko-KR")}
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
                      {new Date(event.createdAt).toLocaleString("ko-KR")}
                    </small>
                  </div>
                </Link>
              ))
            ) : !(notificationFilter === "all"
                ? events.length
                : newEvents.length) ? (
              <div className="calm-empty">
                <Icon name="bell" size={30} />
                <h3>새 알림이 없습니다.</h3>
                <p>응답이 도착하면 여기서 이어서 볼 수 있습니다.</p>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent
          className="search-dialog"
          onEscapeKeyDown={(event) => {
            if (query) {
              event.preventDefault();
              setQuery("");
              searchInput.current?.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {research ? "이 연구에서 찾기" : "내 연구 찾기"}
            </DialogTitle>
            <DialogDescription>
              {research
                ? "미팅·피드백·할 일·자료의 제목을 찾습니다."
                : "연구를 선택하면 그 안의 기록을 찾을 수 있습니다."}
            </DialogDescription>
          </DialogHeader>
          <SearchField
            className="workspace-command-search"
            inputRef={searchInput}
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={research ? "기록 제목 검색" : "연구 이름 검색"}
            aria-label="찾을 제목"
          />
          <div className="command-results">
            {research ? (
              query.trim() ? (
                searchResults.length ? (
                  searchResults.map((r) => (
                    <Link
                      key={r.path + r.id}
                      to={`/r/${researchId}/${r.path}/${r.id}`}
                      onClick={() => {
                        setSearch(false);
                        setQuery("");
                      }}
                    >
                      <Icon name={r.icon} size={20} />
                      <span>
                        {r.title}
                        <small>{r.type}</small>
                      </span>
                      <Icon name="arrow-up-right" size={16} />
                    </Link>
                  ))
                ) : (
                  <p>조건에 맞는 기록이 없습니다.</p>
                )
              ) : (
                <p>찾고 싶은 제목을 입력하세요.</p>
              )
            ) : (
              data.researches
                .filter((r) =>
                  r.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((r) => (
                  <Link
                    to={`/r/${r.id}`}
                    key={r.id}
                    onClick={() => setSearch(false)}
                  >
                    <Icon name="book" size={20} />
                    {r.name}
                  </Link>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
