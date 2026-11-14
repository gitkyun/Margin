import { t } from "@/lib/i18n";
import { InviteGate, InviteSignupPage } from "./pages/InvitePages";
import { admit, finishSocialLogin } from "@/lib/social-login";
import { JoinPage } from "./pages/JoinPage";
import { INVITE_PARAM, inviteCodeFrom } from "./lib/invites";
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
const LabComponentsPage = lazy(() =>
  import("@/lab/LabComponentsPage").then((m) => ({
    default: m.LabComponentsPage,
  })),
);
const LabExpandPage = lazy(() =>
  import("@/lab/LabExpandPage").then((m) => ({ default: m.LabExpandPage })),
);
const OnboardingPage = lazy(() =>
  import("@/pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage })),
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
        <h1>{t("기록을 불러오지 못했어요")}</h1>
        <ErrorNotice message={error} retry={() => void refresh()} />
        <p>{t("인터넷 연결과 로그인한 계정을 확인해 주세요.")}</p>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase?.auth.signOut();
          }}
        >
          {t("다른 계정으로 로그인")}
        </Button>
      </div>
    );
  return (
    <>
      {refreshError && (
        <aside className="workspace-refresh-notice" role="alert">
          <Icon name="warning" size={19} />
          <div>
            <strong>{t("최신 기록을 불러오지 못했어요")}</strong>
            <p>
              {t(
                "지금 화면과 작성 중인 내용은 그대로 있어요. 연결을 확인한 뒤 다시 불러오세요.",
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            {t("다시 불러오기")}
          </Button>
        </aside>
      )}
      <Routes>
        <Route
          path="/login"
          element={<LoginPage authenticated={configured} />}
        />
        <Route path="/" element={<LandingPage signedIn />} />
        <Route
          path="/r/new"
          element={
            <Suspense fallback={<LoadingState />}>
              <OnboardingPage />
            </Suspense>
          }
        />
        {/* 시안 화면. 제품 메뉴에는 연결하지 않습니다. */}
        <Route
          path="/lab/components"
          element={
            <Suspense fallback={<LoadingState />}>
              <LabComponentsPage />
            </Suspense>
          }
        />
        <Route
          path="/lab/expand"
          element={
            <Suspense fallback={<LoadingState />}>
              <LabExpandPage />
            </Suspense>
          }
        />
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
              <h1>{t("페이지를 찾을 수 없어요")}</h1>
              <p>{t("주소가 맞는지 확인해 주세요.")}</p>
              <Button asChild>
                <Link to="/r">{t("내 연구로 이동")}</Link>
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
  // 초대 코드를 방금 쓴 계정. 계정 정보가 새로 오기 전에도 다시 묻지 않게 기억합니다.
  const [redeemedUser, setRedeemedUser] = useState("");
  const location = useLocation();
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let mounted = true;
    let stop = () => {};
    // 카카오에서 돌아온 주소라면 로그인을 먼저 마친 뒤에 화면을 정합니다.
    void finishSocialLogin(client).then(() => {
      if (!mounted) return;
      client.auth.getSession().then(({ data }) => {
        if (mounted) {
          setSession(data.session);
          setReady(true);
        }
      });
      const { data } = client.auth.onAuthStateChange((_event, value) => {
        setSession(value);
        setReady(true);
      });
      stop = () => data.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
      stop();
    };
  }, []);
  // 초대 없이 가입한 계정(카카오 포함)을 첫 로그인에서 허용 목록에 넣습니다.
  const userId = session?.user.id ?? "";
  const invitePending = Boolean(
    inviteCodeFrom(session?.user.user_metadata?.invite),
  );
  const [admittedUser, setAdmittedUser] = useState("");
  useEffect(() => {
    if (!supabase || !userId || invitePending) return;
    let live = true;
    void admit(supabase, userId).finally(() => {
      if (live) setAdmittedUser(userId);
    });
    return () => {
      live = false;
    };
  }, [userId, invitePending]);
  const workspaceVisible = !configured || !!session;
  useEffect(() => {
    const path = location.pathname;
    // WorkspaceShell sets the title for its own routes; writing here would overwrite it.
    if (workspaceVisible && isWorkspaceShellPath(path)) return;
    const publicTitles: Record<string, string> = {
      "/features": t("기능 둘러보기"),
      "/pricing": t("플랜"),
      "/guide": t("사용 안내"),
      "/privacy": t("자료와 개인정보"),
    };
    const name =
      publicTitles[path] ??
      (path === "/"
        ? t("흩어진 기록을 모아, 다음 연구가 되도록")
        : path === "/signup"
          ? configured
            ? t("가입")
            : t("가입 과정 미리보기")
          : path === "/login"
            ? t("로그인")
            : path === "/join"
              ? t("연구 초대")
              : path.includes("assistant")
                ? t("연구 도우미")
                : path.includes("settings")
                  ? t("연구 설정")
                  : path === "/account"
                    ? t("계정 설정")
                    : path === "/r/new"
                      ? t("연구 만들기")
                      : path === "/r"
                        ? t("내 연구")
                        : /^\/r\/[^/]+/.test(path)
                          ? path.includes("/meetings")
                            ? t("미팅")
                            : path.includes("/writing")
                              ? t("글쓰기")
                              : path.includes("/tasks")
                                ? t("할 일")
                                : path.includes("/feedback")
                                  ? t("피드백")
                                  : path.includes("/materials")
                                    ? t("자료")
                                    : path.includes("/results")
                                      ? t("수정 결과")
                                      : path.includes("/planning")
                                        ? t("계획·일정")
                                        : t("연구 홈")
                          : path.startsWith("/reviews")
                            ? t("검토 요청")
                            : path.startsWith("/schedule")
                              ? t("미팅 시간 조율")
                              : t("페이지를 찾을 수 없어요"));
    document.title = t("{name} · 마진", { name });
  }, [location.pathname, workspaceVisible]);
  if (location.pathname === "/") return <LandingPage signedIn={!!session} />;
  if (location.pathname === "/signup") {
    if (!configured) return <SignupPage />;
    // 이미 로그인한 계정이 초대 링크를 열면(초대 없이 가입했거나 초대가 만료됐던 경우)
    // 새로 가입하지 않고 그 계정에 초대를 적용합니다.
    const linked = inviteCodeFrom(
      new URLSearchParams(location.search).get(INVITE_PARAM),
    );
    if (!session || !linked) return <InviteSignupPage />;
    if (redeemedUser === session.user.id) return <Navigate to="/r" replace />;
    return (
      <InviteGate
        code={linked}
        onDone={() => setRedeemedUser(session.user.id)}
        onSignOut={() => void supabase?.auth.signOut()}
      />
    );
  }
  // 연구 초대 메일의 수락 주소. 로그인 전후와 아직 허용되지 않은 계정 모두 여기서 이어집니다.
  if (location.pathname === "/join") {
    if (!configured) return <Navigate to="/signup" replace />;
    return <JoinPage session={session} ready={ready} />;
  }
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
    !/^\/(login|account|lab\/(?:components|expand)|r(?:\/[^/]+(?:\/(?:settings|assistant|writing|planning|meetings|feedback|tasks|materials|results|reviews)(?:\/[^/]+)?)?)?|reviews\/[^/]+|schedule\/[^/]+)\/?$/.test(
      location.pathname,
    )
  )
    return (
      <PublicFrame signedIn={!!session} compact>
        <section className="not-found">
          <Icon name="search" size={32} />
          <h1>{t("페이지를 찾을 수 없어요")}</h1>
          <p>{t("주소가 맞는지 확인해 주세요.")}</p>
          <Button asChild>
            <Link to="/">{t("첫 화면으로")}</Link>
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
  // 초대 링크로 가입한 계정은 첫 로그인에서 초대 코드를 써야 기록을 볼 수 있습니다.
  const pendingInvite = inviteCodeFrom(session?.user.user_metadata?.invite);
  if (session && pendingInvite && redeemedUser !== session.user.id)
    return (
      <InviteGate
        code={pendingInvite}
        onDone={() => setRedeemedUser(session.user.id)}
        onSignOut={() => void supabase?.auth.signOut()}
      />
    );
  if (session && !pendingInvite && admittedUser !== session.user.id)
    return <InitialLoading />;
  const user = session
    ? {
        id: session.user.id,
        email: session.user.email ?? "",
        preferences: session.user.user_metadata?.preferences ?? {},
        name:
          session.user.user_metadata?.name ??
          session.user.email?.split("@")[0] ??
          t("사용자"),
      }
    : previewUser;
  return (
    <WorkspaceProvider user={user} mode={configured ? "connected" : "preview"}>
      <WorkspaceRoutes />
    </WorkspaceProvider>
  );
}
