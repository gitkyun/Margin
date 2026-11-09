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
import { WorkspaceShell as Shell } from "@/components/WorkspaceShell";
import {
  LandingPage,
  SignupPage,
  InfoPage,
  FeatureTourPage,
  PricingPage,
  PublicFrame,
} from "@/pages/PublicPages";
import { AccountPage, ResearchSettingsPage } from "@/pages/SettingsPage";
import { ResearchAssistant } from "@/pages/ResearchAssistant";
import { isHomeEntry } from "@/lib/entry-route";
import { isWorkspaceShellPath } from "@/lib/page-title";
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
const WritingPage = lazy(() =>
  import("@/pages/WritingPage").then((m) => ({ default: m.WritingPage })),
);
const PlanningPage = lazy(() =>
  import("@/pages/PlanningPage").then((m) => ({ default: m.PlanningPage })),
);
const PollPage = lazy(() =>
  import("@/pages/PlanningPage").then((m) => ({ default: m.PollPage })),
);
function ReviewRoute() {
  const { requestId } = useParams(),
    { data } = useWorkspace();
  const q = data.reviews.find((r) => r.id === requestId);
  return q && data.researches.some((r) => r.id === q.researchId) ? (
    <Shell researchOverride={q.researchId}>
      <ReviewDetailPage embedded />
    </Shell>
  ) : (
    <ReviewDetailPage />
  );
}
function PollRoute() {
  const { pollId } = useParams(),
    { data } = useWorkspace(),
    p = data.polls.find((p) => p.id === pollId);
  return p && data.researches.some((r) => r.id === p.researchId) ? (
    <Shell researchOverride={p.researchId}>
      <PollPage />
    </Shell>
  ) : (
    <div className="standalone-page">
      <PollPage />
    </div>
  );
}
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
        <h1>기록을 불러오지 못했어요</h1>
        <ErrorNotice message={error} retry={() => void refresh()} />
        <p>인터넷 연결과 로그인한 계정을 확인해 주세요.</p>
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
            <strong>최신 기록을 불러오지 못했어요</strong>
            <p>
              지금 화면과 작성 중인 내용은 그대로 있어요. 연결을 확인한 뒤 다시
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
        <Route path="/" element={<LandingPage signedIn />} />
        <Route element={<Shell />}>
          <Route path="/r" element={<ResearchSelectPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/r/:researchId/settings"
            element={<ResearchSettingsPage />}
          />
          <Route
            path="/r/:researchId/assistant"
            element={<ResearchAssistant />}
          />
          <Route path="/r/:researchId" element={<HomePage />} />
          <Route
            path="/r/:researchId/writing/:documentId?"
            element={<WritingPage />}
          />
          <Route path="/r/:researchId/planning" element={<PlanningPage />} />
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
          path="/schedule/:pollId"
          element={
            <Suspense fallback={<LoadingState />}>
              <PollRoute />
            </Suspense>
          }
        />
        <Route
          path="/reviews/:requestId"
          element={
            <Suspense fallback={<LoadingState />}>
              <ReviewRoute />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <div className="not-found">
              <span>404</span>
              <h1>페이지를 찾을 수 없어요</h1>
              <p>주소가 맞는지 확인해 주세요.</p>
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
  const workspaceVisible = !configured || !!session;
  useEffect(() => {
    const path = location.pathname;
    // WorkspaceShell sets the title for its own routes; writing here would overwrite it.
    if (workspaceVisible && isWorkspaceShellPath(path)) return;
    const publicTitles: Record<string, string> = {
      "/features": "기능 둘러보기",
      "/pricing": "플랜",
      "/guide": "사용 안내",
      "/privacy": "자료와 개인정보",
    };
    const name =
      publicTitles[path] ??
      (path === "/"
        ? "흩어진 기록을 모아, 다음 연구가 되도록"
        : path === "/signup"
          ? "가입 과정 미리보기"
          : path === "/login"
            ? "로그인"
            : path.includes("assistant")
              ? "연구 도우미"
              : path.includes("settings")
                ? "연구 설정"
                : path === "/account"
                  ? "계정 설정"
                  : path === "/r"
                    ? "내 연구"
                    : /^\/r\/[^/]+/.test(path)
                      ? path.includes("/meetings")
                        ? "미팅"
                        : path.includes("/writing")
                          ? "글쓰기"
                          : path.includes("/tasks")
                            ? "할 일"
                            : path.includes("/feedback")
                              ? "피드백"
                              : path.includes("/materials")
                                ? "자료"
                                : path.includes("/results")
                                  ? "수정 결과"
                                  : path.includes("/planning")
                                    ? "계획·일정"
                                    : "연구 홈"
                      : path.startsWith("/reviews")
                        ? "교수 검토"
                        : path.startsWith("/schedule")
                          ? "미팅 시간 조율"
                          : "페이지를 찾을 수 없어요");
    document.title = `${name} · 마진`;
  }, [location.pathname, workspaceVisible]);
  if (location.pathname === "/") return <LandingPage signedIn={!!session} />;
  if (location.pathname === "/signup") return <SignupPage />;
  if (location.pathname === "/features")
    return <FeatureTourPage signedIn={!!session} />;
  if (location.pathname === "/pricing")
    return <PricingPage signedIn={!!session} />;
  if (location.pathname === "/guide" || location.pathname === "/privacy")
    return (
      <InfoPage
        privacy={location.pathname === "/privacy"}
        signedIn={!!session}
      />
    );
  if (
    !/^\/(login|account|r(?:\/[^/]+(?:\/(?:settings|assistant|writing|planning|meetings|feedback|tasks|materials|results|reviews)(?:\/[^/]+)?)?)?|reviews\/[^/]+|schedule\/[^/]+)\/?$/.test(
      location.pathname,
    )
  )
    return (
      <PublicFrame signedIn={!!session} compact>
        <section className="not-found">
          <Icon name="search" size={32} />
          <h1>페이지를 찾을 수 없어요</h1>
          <p>주소가 맞는지 확인해 주세요.</p>
          <Button asChild>
            <Link to="/">첫 화면으로</Link>
          </Button>
        </section>
      </PublicFrame>
    );
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
        preferences: session.user.user_metadata?.preferences ?? {},
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
