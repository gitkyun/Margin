import { useNavigationGuard } from "@/lib/navigation-guard";
import { Suspense, lazy, useEffect, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase, configured, friendlyError } from "@/lib/supabase";
import { previewUser } from "@/lib/demo";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace";
import { useTheme } from "@/lib/theme";
import {
  notificationHref,
  unreadReviewNotifications,
} from "@/lib/notifications";
import { Icon } from "@/components/icons";
import {
  EmptyState,
  ErrorNotice,
  HomeSkeleton,
  IconButton,
  LoadingState,
} from "@/components/common";
import { isHomeEntry } from "@/lib/entry-route";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HomePage } from "@/pages/HomePage";
import { LoginPage, ResearchSelectPage, ThemeSwitch } from "@/pages/AuthPages";
const MeetingsPage = lazy(() =>
  import("@/pages/student").then((m) => ({ default: m.MeetingsPage })),
);
const FeedbackPage = lazy(() =>
  import("@/pages/student").then((m) => ({ default: m.FeedbackPage })),
);
const TasksPage = lazy(() =>
  import("@/pages/student").then((m) => ({ default: m.TasksPage })),
);
const MaterialsPage = lazy(() =>
  import("@/pages/student").then((m) => ({ default: m.MaterialsPage })),
);
const ResultsPage = lazy(() =>
  import("@/pages/student").then((m) => ({ default: m.ResultsPage })),
);
const ReviewsPage = lazy(() =>
  import("@/pages/reviews").then((m) => ({ default: m.ReviewsPage })),
);
const ReviewDetailPage = lazy(() =>
  import("@/pages/reviews").then((m) => ({ default: m.ReviewDetailPage })),
);
const navigation = [
  { label: "홈", path: "", icon: "home" },
  { label: "미팅", path: "meetings", icon: "calendar" },
  { label: "피드백·수정", path: "feedback", icon: "feedback" },
  { label: "할 일", path: "tasks", icon: "tasks" },
  { label: "자료", path: "materials", icon: "folder" },
  { label: "검토 요청", path: "reviews", icon: "send" },
];
function StartPage() {
  const { data } = useWorkspace();
  return (
    <Navigate
      to={data.researches.length ? `/r/${data.researches[0].id}` : "/r"}
      replace
    />
  );
}
function Shell() {
  const { researchId } = useParams();
  const { data, user, mode, saveResearch, signOut } = useWorkspace();
  const location = useLocation(),
    navigate = useNavigate();
  const research = data.researches.find((r) => r.id === researchId);
  const [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("rms-sidebar-collapsed") === "true",
    ),
    [mobileOpen, setMobileOpen] = useState(false),
    [notifications, setNotifications] = useState(false),
    [settings, setSettings] = useState(false),
    [name, setName] = useState(research?.name ?? ""),
    [saving, setSaving] = useState(false);
  useNavigationGuard({
    dirty: settings && name.trim() !== research?.name,
    busy: saving,
    label: "연구 설정",
    onDiscard: () => setSettings(false),
  });
  const currentLabel = location.pathname.includes("/results")
    ? "수정 결과"
    : (navigation.find(
        (item) => item.path && location.pathname.includes("/" + item.path),
      )?.label ?? "홈");
  const updates = unreadReviewNotifications(data, user, researchId);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  const menu = (
    <>
      <div className="sidebar-brand">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Icon name="book" size={22} />
          </span>
          <strong>RMS</strong>
        </Link>
        <IconButton
          label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          onClick={() => {
            const value = !collapsed;
            setCollapsed(value);
            localStorage.setItem("rms-sidebar-collapsed", String(value));
          }}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={15} />
        </IconButton>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="workspace-switch"
            title={research?.name ?? "내 연구"}
          >
            <span className="workspace-symbol">
              <Icon name="book" size={18} />
            </span>
            <span>
              <small>내 연구</small>
              <strong>{research?.name ?? "연구 선택"}</strong>
            </span>
            <Icon name="chevron-down" size={15} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="workspace-menu">
          <DropdownMenuLabel>연구 선택</DropdownMenuLabel>
          {data.researches.map((r) => (
            <DropdownMenuItem
              key={r.id}
              onSelect={() => navigate(`/r/${r.id}`)}
            >
              <Icon name="book" size={16} />
              {r.name}
              {r.id === researchId && <Icon name="check" size={15} />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/r")}>
            <Icon name="plus" size={16} />내 연구 · 새 연구
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="nav-caption">작업 공간</span>
      <nav className="nav-list" aria-label="주요 메뉴">
        {researchId ? (
          navigation.map((item) => (
            <NavLink
              key={item.label}
              end={!item.path}
              to={`/r/${researchId}${item.path ? "/" + item.path : ""}`}
              title={item.label}
              className={({ isActive }) =>
                `nav-item ${isActive || (item.path === "feedback" && location.pathname.includes("/results")) ? "active" : ""}`
              }
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {item.path === "reviews" && updates.length > 0 && (
                <b className="nav-badge">{updates.length}</b>
              )}
            </NavLink>
          ))
        ) : (
          <NavLink to="/r" className="nav-item active">
            <Icon name="book" size={20} />
            <span>내 연구</span>
          </NavLink>
        )}
      </nav>
      <div className="sidebar-bottom">
        {research && (
          <button
            className="nav-item sidebar-settings"
            onClick={() => {
              setName(research.name);
              setSettings(true);
            }}
            title="연구 설정"
          >
            <Icon name="settings" size={19} />
            <span>연구 설정</span>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="profile-button">
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <span>
                <strong>{user.name}</strong>
                <small>
                  {mode === "preview" ? "가상 학생 계정" : user.email}
                </small>
              </span>
              <Icon name="chevron-down" size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="account-menu"
          >
            <DropdownMenuLabel>
              {mode === "preview" ? "화면 미리보기" : user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="account-theme">
              <span>화면 테마</span>
              <ThemeSwitch />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  if (mode === "connected") await signOut();
                  navigate("/login");
                } catch (e) {
                  toast.error(friendlyError(e));
                }
              }}
            >
              <Icon name="logout" size={16} />
              {mode === "preview" ? "로그인 화면" : "로그아웃"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <aside className="sidebar">{menu}</aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="mobile-sidebar rms-mobile-sheet">
          <SheetHeader className="sr-only">
            <SheetTitle>연구 메뉴</SheetTitle>
            <SheetDescription>
              연구를 전환하거나 작업 화면으로 이동합니다.
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
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <Link to="/r">{research?.name ?? "내 연구"}</Link>
            {research && (
              <>
                <Icon name="chevron-right" size={14} />
                <strong>{currentLabel}</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span className="today">
              {new Intl.DateTimeFormat("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              }).format(new Date())}
            </span>
            <button
              className="icon-button notification-trigger"
              onClick={() => setNotifications(true)}
              aria-label={`알림 ${updates.length}개`}
            >
              <Icon name="bell" size={20} />
              {updates.length > 0 && <i />}
            </button>
            <span className="avatar avatar-small">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        {mode === "preview" && (
          <div className="preview-banner">
            <Icon name="info" size={14} />
            <span>
              화면 미리보기 · 가상 자료 · 변경 내용은 이 브라우저에 저장됩니다.
            </span>
            <Link to="/login">
              로그인 화면
              <Icon name="arrow-up-right" size={13} />
            </Link>
          </div>
        )}
        <main id="main-content" className="workspace-content">
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="workspace-footer">
          <span>RMS · 연구의 맥락을 이어서</span>
          <span>{mode === "preview" ? "로컬 미리보기" : "수업 시연용"}</span>
        </footer>
      </div>
      <Sheet open={notifications} onOpenChange={setNotifications}>
        <SheetContent className="notifications-sheet">
          <SheetHeader>
            <SheetTitle>새 응답</SheetTitle>
            <SheetDescription>
              새 댓글·응답·검토 차수가 있는 항목으로 이동합니다.
            </SheetDescription>
          </SheetHeader>
          <div className="notification-content">
            {updates.length ? (
              updates.map((event) => (
                <Link
                  key={event.id}
                  onClick={() => setNotifications(false)}
                  to={notificationHref(event)}
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
            ) : (
              <EmptyState
                icon="bell"
                title="읽지 않은 응답이 없습니다."
                description="새 응답이 도착하면 여기에 표시됩니다."
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={settings}
        onOpenChange={(nextOpen: boolean) => {
          if (!saving) setSettings(nextOpen);
        }}
      >
        <DialogContent
          className="rms-dialog"
          showCloseButton={!saving}
          aria-busy={saving}
          onEscapeKeyDown={(event: { preventDefault(): void }) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event: { preventDefault(): void }) => {
            if (saving) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>연구 설정</DialogTitle>
            <DialogDescription>
              현재 연구의 이름과 화면 테마를 설정합니다.
            </DialogDescription>
          </DialogHeader>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving || !research || !name.trim()) return;
              setSaving(true);
              try {
                await saveResearch({ ...research, name: name.trim() });
                setSettings(false);
                toast.success("연구 이름을 저장했습니다.");
              } catch (error) {
                toast.error(friendlyError(error));
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="field">
              연구 이름
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </label>
            <div className="field">
              <span>화면 테마</span>
              <ThemeSwitch />
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettings(false)}
                disabled={saving}
              >
                취소
              </Button>
              <Button disabled={saving || !name.trim()}>저장</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function InitialLoading() {
  const location = useLocation();
  if (isHomeEntry(location.pathname, location.search)) return <HomeSkeleton />;
  return (
    <div className="initial-loading">
      <LoadingState />
    </div>
  );
}
function WorkspaceRoutes() {
  const { loading, error, refreshError, refresh } = useWorkspace();
  if (loading) return <InitialLoading />;
  if (error)
    return (
      <div className="connection-error">
        <Icon name="lock" size={30} />
        <h1>작업 공간을 불러오지 못했습니다.</h1>
        <ErrorNotice message={error} retry={() => void refresh()} />
        <p>계정 연결과 시연 계정의 접근 허용 여부를 확인해 주세요.</p>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase?.auth.signOut();
          }}
        >
          다른 계정으로 로그인
        </Button>
      </div>
    );
  return (
    <>
      {refreshError && (
        <aside className="workspace-refresh-notice" role="alert">
          <Icon name="warning" size={19} />
          <div>
            <strong>최신 기록을 불러오지 못했습니다.</strong>
            <p>
              기존 화면과 작성 중인 내용은 유지됩니다. 연결을 확인한 뒤 다시
              불러오세요.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            다시 불러오기
          </Button>
        </aside>
      )}
      <Routes>
        <Route
          path="/login"
          element={<LoginPage authenticated={configured} />}
        />
        <Route path="/" element={<StartPage />} />
        <Route element={<Shell />}>
          <Route path="/r" element={<ResearchSelectPage />} />
          <Route path="/r/:researchId" element={<HomePage />} />
          <Route
            path="/r/:researchId/meetings/:meetingId?"
            element={<MeetingsPage />}
          />
          <Route
            path="/r/:researchId/feedback/:feedbackId?"
            element={<FeedbackPage />}
          />
          <Route path="/r/:researchId/tasks/:taskId?" element={<TasksPage />} />
          <Route
            path="/r/:researchId/materials/:materialId?"
            element={<MaterialsPage />}
          />
          <Route
            path="/r/:researchId/results/:resultId?"
            element={<ResultsPage />}
          />
          <Route path="/r/:researchId/reviews" element={<ReviewsPage />} />
        </Route>
        <Route
          path="/reviews/:requestId"
          element={
            <Suspense fallback={<LoadingState />}>
              <ReviewDetailPage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <div className="not-found">
              <span>404</span>
              <h1>페이지를 찾을 수 없습니다.</h1>
              <p>주소를 확인하거나 내 연구에서 다시 시작해 주세요.</p>
              <Button asChild>
                <Link to="/r">내 연구로 이동</Link>
              </Button>
            </div>
          }
        />
      </Routes>
    </>
  );
}
export function App() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(!configured);
  const location = useLocation();
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      setReady(true);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (!ready) return <InitialLoading />;
  if (configured && !session) {
    if (location.pathname !== "/login")
      return (
        <Navigate
          to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
          replace
        />
      );
    return <LoginPage />;
  }
  const user = session
    ? {
        id: session.user.id,
        email: session.user.email ?? "",
        name:
          session.user.user_metadata?.name ??
          session.user.email?.split("@")[0] ??
          "사용자",
      }
    : previewUser;
  return (
    <WorkspaceProvider user={user} mode={configured ? "connected" : "preview"}>
      <WorkspaceRoutes />
    </WorkspaceProvider>
  );
}
