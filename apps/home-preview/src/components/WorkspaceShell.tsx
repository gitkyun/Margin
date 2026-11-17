import { t } from "@/lib/i18n";
import { MiniRecorder } from "@/components/recording/MiniRecorder";
import ProfileDropdown from "@/components/kokonut/profile-dropdown";
import { useTheme } from "@/lib/theme";
import { formatDateTime } from "@/lib/domain";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PanelResizer, usePanelWidth } from "./margin-panel/PanelResizer";
import { TopBar } from "./shell/TopBar";
import { SideRail } from "./shell/SideRail";
import { MobileTabBar } from "./shell/MobileTabBar";
import { BottomDock } from "./shell/BottomDock";
import { useMediaQuery } from "@/lib/use-media-query";
import "./shell/shell.css";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Suspense } from "react";
import { toast } from "sonner";
import { Icon } from "./icons";
import { CommandPalette } from "./CommandPalette";
import { ShortcutHelp } from "./ShortcutHelp";

import { RESEARCH_NAVIGATION, isIncomingOnly } from "@/lib/command-items";
import { useGoShortcuts } from "@/lib/use-go-shortcuts";
import { Button } from "./ui/button";
import { EmptyState, LoadingState } from "./common";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { useExperience } from "@/lib/experience";
import { queryDown } from "@/design/responsive";
import {
  MarginPanelProvider,
  useMarginPanelHost,
} from "./margin-panel/MarginPanel";
import { AnimatedList, Segments } from "./experience";
import {
  unreadReviewNotifications,
  notificationHref,
  activityEnabled,
} from "@/lib/notifications";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
const navigation = RESEARCH_NAVIGATION;
const activityTitles: Record<string, string> = {
  // i18n-ignore: 서버에 저장된 알림 제목(자료)
  "새 기록이 추가되었습니다": t("새 기록을 추가했어요"),
  // i18n-ignore: 서버에 저장된 알림 제목(자료)
  "연구 기록이 변경되었습니다": t("기록을 수정했어요"),
  // i18n-ignore: 서버에 저장된 알림 제목(자료)
  "공동연구에 참여했습니다": t("공동연구에 참여했어요"),
  // i18n-ignore: 서버에 저장된 알림 제목(자료)
  "수정 결과를 검토에 공개했습니다": t("검토 요청에 수정 결과를 넣었어요"),
  // i18n-ignore: 서버에 저장된 알림 제목(자료)
  "새 차수의 재확인을 요청했습니다": t("다시 확인을 요청했어요"),
  // i18n-ignore: 서버에 저장된 알림 제목(자료)
  "미팅 시간이 확정되었습니다": t("미팅 시간을 정했어요"),
  // i18n-ignore: 서버에 저장된 알림 제목(자료)
  "시간 조율이 취소되었습니다": t("시간 조율을 취소했어요"),
};
function AccountMenu({ incomingOnly }: { incomingOnly: boolean }) {
  const { user, mode, signOut } = useWorkspace();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [attempt, setAttempt] = useState(0);
  return (
    <ProfileDropdown
      key={attempt}
      placement="bottom"
      accounts={[
        {
          id: user.id,
          name: user.name,
          email: user.email,
          initials: user.name.slice(0, 1),
          plan: "Free",
        },
      ]}
      theme={theme}
      onThemeChange={setTheme}
      items={[
        {
          label: t("프로필 설정"),
          icon: <Icon name="user" size={16} />,
          onSelect: () => navigate("/account?tab=profile"),
        },
        {
          label: t("AI 기본 설정"),
          icon: <Icon name="sparkles" size={16} />,
          onSelect: () => navigate("/account?tab=ai"),
        },
        {
          label: t("사용량·플랜"),
          icon: <Icon name="chart" size={16} />,
          value: "Free",
          onSelect: () => navigate("/account?tab=usage"),
        },
        {
          label: t("사용 안내"),
          icon: <Icon name="help" size={16} />,
          onSelect: () => navigate("/guide"),
        },
      ]}
      onSignOut={() =>
        void (async () => {
          try {
            if (mode === "connected") await signOut();
            navigate("/login");
          } catch (error) {
            toast.error(friendlyError(error));
            setAttempt((value) => value + 1);
          }
        })()
      }
    />
  );
}
/** 사이드 창이 본문을 미는 최소 폭. 이보다 좁으면 본문 위에 겹쳐 뜹니다(IA v2 02 §1.2). */
const OVERLAY_PANEL_QUERY = queryDown("lg");
/** 사이드 창이 넓게(440) 열리는 화면: 글 편집, 자료 보기(02 §1.1) */
const WIDE_PANEL_ROUTE = /^\/r\/[^/]+\/(writing|materials)\/[^/]+/;

export function WorkspaceShell({
  children,
  researchOverride,
}: { children?: ReactNode; researchOverride?: string } = {}) {
  const params = useParams();
  const researchId = researchOverride ?? params.researchId;
  const { data, user, mode, markEvent } = useExperience(),
    location = useLocation();
  const research = data.researches.find((r) => r.id === researchId);
  const [search, setSearch] = useState(false),
    [shortcutsOpen, setShortcutsOpen] = useState(false),
    [notifications, setNotifications] = useState(false);
  const overlayPanel = useMediaQuery(OVERLAY_PANEL_QUERY);
  const updates = unreadReviewNotifications(data, user, researchId);
  const [panelWidth, setPanelWidth] = usePanelWidth();
  const [notificationFilter, setNotificationFilter] = useState("unread");
  const events = data.events.filter(
    (e) =>
      (!researchId || e.researchId === researchId) &&
      activityEnabled(e, user, data),
  );
  const newEvents = events.filter((e) => !e.readAt);
  const totalUnread = updates.length + newEvents.length;
  // 교수 계정(내 연구 없이 받은 검토 요청만 있음)은 메뉴·⌘K를 받은 검토 요청 기준으로 둡니다(감사 F5).
  const incomingOnly = isIncomingOnly(data, user.id);
  const homeLabel = incomingOnly ? t("받은 검토 요청") : t("내 연구");
  useGoShortcuts(research ? researchId : undefined);
  const panel = useMarginPanelHost();
  // ] 키로 사이드 창을 여닫습니다(입력 중이거나 조합 키와 함께일 때는 제외).
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
  // 겹쳐 뜬 사이드 창(1199px 이하)은 다른 화면으로 가면 닫힙니다(D15).
  useEffect(() => {
    if (overlayPanel) panelRef.current.active?.onClose();
  }, [location.pathname, overlayPanel]);
  // 겹쳐 뜬 사이드 창은 뒤를 가리지 않고, 바깥을 누르면 닫힙니다(D15).
  useEffect(() => {
    if (!overlayPanel || !panel.active) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          ".margin-panel, .ia-rail, .margin-panel-resizer, [data-radix-popper-content-wrapper], [role='dialog'], [role='menu']",
        )
      )
        return;
      panelRef.current.active?.onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [overlayPanel, panel.active]);
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
      ? t("계정 설정")
      : location.pathname.endsWith("/settings")
        ? t("연구 설정")
        : location.pathname.endsWith("/assistant")
          ? t("연구 도우미")
          : location.pathname.includes("/tasks")
            ? t("할 일")
            : location.pathname.includes("/results")
              ? t("수정 결과")
              : location.pathname.includes("/feedback")
                ? t("피드백")
                : /\/(writing|docs|materials)(\/|$)/.test(location.pathname)
                  ? t("글·자료")
                  : (navigation.find(
                      ([path]) =>
                        path && location.pathname.includes("/" + path),
                    )?.[2] ?? (research ? t("홈") : homeLabel));
  useEffect(() => {
    document.title = t("{name} · 마진", {
      name: `${current}${research ? ` · ${research.name}` : ""}`,
    });
  }, [current, research?.name]);
  if (researchId && (!research || research.deletedAt))
    return (
      <div className="not-found">
        <Icon name="lock" size={32} />
        <h1>{t("이 연구를 열 수 없어요")}</h1>
        <p>{t("휴지통에 있거나 접근 권한이 없는 연구예요.")}</p>
        <Button asChild>
          <Link to="/r">{t("내 연구로 돌아가기")}</Link>
        </Button>
      </div>
    );
  const inResearch = !!research && !!researchId;
  const widePanel = WIDE_PANEL_ROUTE.test(location.pathname);
  return (
    <div
      style={
        panelWidth
          ? ({
              "--margin-panel-user-width": `${panelWidth}px`,
            } as CSSProperties)
          : undefined
      }
      className={`app-shell floating-workspace ia-shell ${inResearch ? "" : "ia-shell-outside"} ${widePanel ? "ia-panel-wide" : ""} ${panel.active ? "margin-panel-open" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        {t("본문으로 이동")}
      </a>
      <TopBar
        data={data}
        researchId={inResearch ? researchId : undefined}
        researchName={research?.name}
        incomingOnly={incomingOnly}
        hasReviewUpdates={updates.length > 0}
        totalUnread={totalUnread}
        onSearch={() => setSearch(true)}
        onNotifications={() => setNotifications(true)}
        account={<AccountMenu incomingOnly={incomingOnly} />}
      />
      <div className="ia-body workspace-body">
        <div className="main-shell">
          <ShellBanners
            preview={mode === "preview"}
            archived={!!research?.archivedAt}
            researchId={researchId}
          />
          <main id="main-content" className="workspace-content">
            <MarginPanelProvider value={panel.context}>
              <Suspense fallback={<LoadingState />}>
                {children ?? <Outlet />}
              </Suspense>
            </MarginPanelProvider>
          </main>
          <footer className="workspace-footer">
            {/* 슬로건은 소개 화면에만 둡니다(ux-writing). 작업 화면은 이름만. */}
            <span>{t("마진")}</span>
            <span className="workspace-footer-links">
              <a href="mailto:admin@margin.com">{t("문의 admin@margin.com")}</a>
              <Link to="/privacy">{t("자료·개인정보 안내")}</Link>
            </span>
          </footer>
        </div>
        {panel.active && (
          <button
            type="button"
            className="margin-panel-backdrop"
            aria-label={t("{label} 닫기", { label: panel.active.label })}
            tabIndex={-1}
            onClick={panel.active.onClose}
          />
        )}
        {panel.active && (
          <PanelResizer
            width={panelWidth}
            onChange={setPanelWidth}
            currentWidth={() =>
              document.querySelector<HTMLElement>(".margin-panel")
                ?.offsetWidth ?? 312
            }
          />
        )}
        <aside
          id="margin-panel"
          className="margin-panel"
          aria-label={panel.active?.label ?? t("여백 패널")}
          hidden={!panel.active}
          tabIndex={-1}
          ref={panel.setSlot}
        />
        {inResearch && (
          <SideRail
            researchId={researchId}
            offered={panel.offered}
            active={panel.active}
          />
        )}
      </div>
      <BottomDock>
        <MiniRecorder />
        {inResearch && !incomingOnly && (
          <MobileTabBar researchId={researchId} />
        )}
      </BottomDock>
      <Sheet open={notifications} onOpenChange={setNotifications}>
        <SheetContent className="notifications-sheet">
          <SheetHeader>
            <SheetTitle>{t("알림")}</SheetTitle>
            <SheetDescription>
              {data.researches.length === 0
                ? t("검토 요청과 댓글, 미팅 시간 조율 알림을 확인하세요.")
                : t(
                    "교수 응답과 댓글, 담당 할 일, 미팅 일정, 공동연구 알림을 확인하세요.",
                  )}
            </SheetDescription>
          </SheetHeader>
          <div className="notification-content">
            <div className="button-row">
              <Segments
                value={notificationFilter}
                onChange={setNotificationFilter}
                label={t("알림 필터")}
                options={[
                  {
                    value: "unread",
                    label: t("읽지 않음"),
                    count: totalUnread,
                  },
                  { value: "all", label: t("전체") },
                ]}
              />
              <Button
                variant="ghost"
                onClick={() =>
                  void markEvent().catch((e) => toast.error(friendlyError(e)))
                }
              >
                {t("검토 알림 빼고 모두 읽음")}
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
                        {e.readAt ? ` · ${t("읽음")}` : ""}
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
                      {t("{round}차 검토", { round: event.roundNumber })} ·{" "}
                      {formatDateTime(event.createdAt)}
                    </small>
                  </div>
                </Link>
              ))
            ) : !(notificationFilter === "all"
                ? events.length
                : newEvents.length) ? (
              <EmptyState icon="bell" title={t("확인할 새 알림이 없어요.")} />
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

/** 상단 줄 아래 띠: 미리보기 모드, 보관한 연구(02 §7). */
function ShellBanners({
  preview,
  archived,
  researchId,
}: {
  preview: boolean;
  archived: boolean;
  researchId?: string;
}) {
  return (
    <>
      {preview && (
        <div className="preview-banner">
          <Icon name="info" size={15} />
          <span>{t("미리보기 · 가상 기록은 이 브라우저에만 저장돼요.")}</span>
          <Link to="/login">
            {t("로그인 화면으로")}
            <Icon name="arrow-up-right" size={14} />
          </Link>
        </div>
      )}
      {archived && (
        <div className="archived-banner" role="status">
          <Icon name="folder" size={17} />
          <span>
            {t("보관한 연구예요. 기록과 공유 중인 검토 요청은 그대로예요.")}
          </span>
          <Link to={`/r/${researchId}/settings?tab=lifecycle`}>
            {t("연구 복원하기")}
          </Link>
        </div>
      )}
    </>
  );
}
