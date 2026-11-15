import { incomingSummary } from "./reviews/helpers";
import {
  PermanentResearchDelete,
  PendingResearchDeletions,
} from "@/components/PermanentResearchDelete";
import { PublicFrame } from "./PublicPages";
import { ThemeSwitch } from "@/components/ThemeSwitch";
export { ThemeSwitch } from "@/components/ThemeSwitch";
import { useId, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { dDayLabel, daysUntil } from "@/lib/submission-countdown";
import { todayKey } from "@/lib/roadmap-plan";
import {
  ResearchCardContextMenu,
  ResearchCardMoreMenu,
} from "@/components/ResearchCardMenu";
import {
  researchCardActions,
  researchListView,
  researchStatusBadge,
  type ResearchCardActionId,
} from "@/lib/research-card-actions";
import type { Research } from "@/lib/domain";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { formatDateTime } from "@/lib/domain";
import { configured, assertConnected, friendlyError } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PageHeader,
  EmptyState,
  StatusBadge,
  useDisabledReason,
} from "@/components/common";
import { Icon } from "@/components/icons";
import { t } from "@/lib/i18n";
import { joinPath, pendingJoin } from "@/lib/project-invites";
import { safeNext, takeSocialProblem } from "@/lib/social-login";
import { KakaoLoginButton } from "@/components/KakaoLoginButton";
import { useExperience } from "@/lib/experience";
import { Segments } from "@/components/experience";
import { unreadReviewNotifications } from "@/lib/notifications";
export function LoginPage({
  authenticated = false,
}: {
  authenticated?: boolean;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [pending, setPending] = useState(false),
    // 카카오에서 돌아오다 실패한 경우 그 이유를 한 번 보여 줍니다.
    [error, setError] = useState(takeSocialProblem),
    // 이메일·비밀번호가 맞지 않을 때만 두 칸을 오류로 표시합니다(QA D-016).
    // 연결 오류는 칸의 문제가 아니라서 표시하지 않아요.
    [credentialsInvalid, setCredentialsInvalid] = useState(false);
  const errorId = useId();
  const emailInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 초대 수락 중에 로그인하러 온 경우(메일 확인 뒤 포함) 그 초대로 돌아갑니다.
  const resumeJoin = pendingJoin();
  const next = params.get("next") ?? (resumeJoin ? joinPath(resumeJoin) : "/r");
  const target = safeNext(next);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setPending(true);
    setError("");
    setCredentialsInvalid(false);
    let wrongCredentials = false;
    try {
      const { error } = await assertConnected().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        wrongCredentials = !error.message?.includes("fetch");
        throw new Error(
          wrongCredentials
            ? t("이메일과 비밀번호를 확인해 주세요.")
            : t(
                "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
              ),
        );
      }
      setPassword("");
      navigate(target, { replace: true });
    } catch (e) {
      setError(friendlyError(e));
      setCredentialsInvalid(wrongCredentials);
    } finally {
      setPending(false);
    }
    // 칸이 다시 켜진 뒤 첫 칸으로 포커스를 옮겨요.
    if (wrongCredentials)
      requestAnimationFrame(() => emailInput.current?.focus());
  }
  return (
    <PublicFrame compact signedIn={authenticated}>
      <section className="signup-layout login-layout">
        <div className="auth-story">
          <h1>
            {t("지난 기록이")}
            <br />
            {t("그대로 있어요")}
          </h1>
          <p>
            {t("미팅 기록, 피드백, 검토 요청을")}
            <br />
            {t("로그인하면 바로 볼 수 있어요.")}
          </p>
        </div>
        <section className="auth-panel">
          <h2>{t("로그인")}</h2>
          <p>
            {target.startsWith("/reviews/")
              ? t(
                  "학생이 검토 요청에 지정한 교수 계정 이메일로 로그인해 주세요.",
                )
              : t("가입한 이메일로 로그인하세요.")}
          </p>
          {authenticated ? (
            <>
              <div className="signed-in-notice">
                <Icon name="check-circle" size={23} />
                <p>{t("이미 로그인되어 있어요.")}</p>
              </div>
              <Button fullWidth size="lg" asChild>
                <Link to={target}>
                  {target === "/r" ? t("내 연구 열기") : t("계속하기")}
                  <Icon name="arrow-right" size={18} />
                </Link>
              </Button>
            </>
          ) : (
            <form onSubmit={submit}>
              {!configured && (
                <div className="signed-in-notice" role="note">
                  <Icon name="info" size={23} />
                  <p>
                    {t("이 미리보기에서는 로그인할 수 없어요.")}{" "}
                    <Link to="/r">{t("가상 기록 보기")}</Link>
                  </p>
                </div>
              )}
              <label className="field">
                {t("이메일")}
                <Input
                  ref={emailInput}
                  type="email"
                  autoComplete="username"
                  value={email}
                  aria-invalid={credentialsInvalid || undefined}
                  aria-describedby={credentialsInvalid ? errorId : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setCredentialsInvalid(false);
                  }}
                  placeholder="name@university.ac.kr"
                  required
                  disabled={!configured || pending}
                />
              </label>
              <label className="field">
                {t("비밀번호")}
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={credentialsInvalid || undefined}
                  aria-describedby={credentialsInvalid ? errorId : undefined}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setCredentialsInvalid(false);
                  }}
                  required
                  disabled={!configured || pending}
                />
              </label>
              {error && (
                <p id={errorId} className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button
                fullWidth
                size="lg"
                type="submit"
                disabled={pending || !configured}
              >
                {pending ? t("로그인 중") : t("로그인")}
                <Icon name="arrow-right" size={18} />
              </Button>
            </form>
          )}
          {configured && !authenticated && (
            <KakaoLoginButton
              next={target}
              label={t("카카오로 시작하기")}
              disabled={pending}
            />
          )}
          <p className="auth-switch">
            {t("계정이 없나요?")}{" "}
            <Link to="/signup">
              {configured ? t("가입하기") : t("가입 과정 미리보기")}
            </Link>
          </p>
          {configured && (
            <p className="auth-switch">
              {t("비밀번호를 잊었나요?")}{" "}
              <a href="mailto:admin@margin.com">
                {t("admin@margin.com으로 알려 주세요")}
              </a>
            </p>
          )}
        </section>
      </section>
    </PublicFrame>
  );
}

export function ResearchSelectPage() {
  const [creationParams, setCreationParams] = useSearchParams();
  const w = useExperience();
  const { data, user, saveResearch } = w;
  const sharedRequests = data.reviews
    .filter(
      (request) =>
        request.professorId === user.id && request.status === "shared",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const incomingOnly =
    sharedRequests.length > 0 && data.researches.length === 0;
  const newEvents = unreadReviewNotifications(data, user);
  const view = researchListView(creationParams.get("view")),
    archivedView = view === "archived",
    trashView = view === "trash";
  const statusBadge = researchStatusBadge(view);
  const invites = data.members.filter(
    (m) => m.userId === user.id && m.status === "pending",
  );
  const visibleResearches = data.researches.filter((r) =>
    trashView
      ? !!r.deletedAt
      : !r.deletedAt && (archivedView ? !!r.archivedAt : !r.archivedAt),
  );
  const [trashTarget, setTrashTarget] = useState<
    (typeof data.researches)[number] | null
  >(null);
  const [trashName, setTrashName] = useState("");
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const trashReason = useDisabledReason(
    !!trashTarget &&
      !pending &&
      trashName !== trashTarget.name &&
      t("연구 이름을 똑같이 입력하면 옮길 수 있어요."),
  );
  // 연구 만들기는 온보딩 화면(/r/new)이 맡습니다. 예전 주소(?new=1)도 그리로 보냅니다.
  const wantsNew = creationParams.get("new") === "1";
  const noResearchYet =
    data.researches.length === 0 && !incomingOnly && invites.length === 0;

  /** 보관·복원처럼 연구 상태만 바꾸는 저장. 실패하면 이유를 알리고 화면은 그대로 둡니다. */
  async function changeResearch(
    next: Research,
    success: string,
  ): Promise<Research | null> {
    setPending(true);
    try {
      const saved = await saveResearch(next);
      toast.success(success);
      return saved;
    } catch (e) {
      toast.error(friendlyError(e));
      return null;
    } finally {
      setPending(false);
    }
  }

  /** 우클릭 메뉴와 ⋯ 메뉴가 함께 쓰는 카드 동작 */
  function runCardAction(research: Research, id: ResearchCardActionId) {
    if (pending) return;
    if (id === "open") navigate(`/r/${research.id}`);
    else if (id === "open-tab")
      window.open(`/r/${research.id}`, "_blank", "noopener");
    else if (id === "settings") navigate(`/r/${research.id}/settings`);
    else if (id === "trash") {
      setTrashTarget(research);
      setTrashName("");
    } else if (id === "archive")
      void changeResearch(
        { ...research, archivedAt: new Date().toISOString() },
        t("연구를 보관했어요. 보관함에서 복원할 수 있어요."),
      );
    else if (id === "unarchive")
      void changeResearch(
        { ...research, archivedAt: undefined },
        t("진행 중인 연구로 복원했어요."),
      );
    else if (id === "restore")
      void changeResearch(
        { ...research, deletedAt: undefined, archivedAt: undefined },
        t("연구를 복원했어요. 검토 요청 공유는 직접 다시 시작해 주세요."),
      );
  }

  if (wantsNew || noResearchYet) return <Navigate to="/r/new" replace />;
  return (
    <div className="research-list-page">
      <PageHeader
        title={incomingOnly ? t("받은 검토 요청") : t("내 연구")}
        description={
          incomingOnly
            ? t("학생이 요청한 검토를 열어 항목마다 응답을 남겨 주세요.")
            : undefined
        }
        actions={
          !incomingOnly && (
            <Button onClick={() => navigate("/r/new")}>
              <Icon name="plus" size={17} />
              {t("연구 만들기")}
            </Button>
          )
        }
      />
      {sharedRequests.length > 0 && (
        <section
          className="shared-review-section"
          aria-label={t("받은 검토 요청 목록")}
        >
          {!incomingOnly && <h2>{t("받은 검토 요청")}</h2>}
          <div className="shared-review-list">
            {sharedRequests.map((request) => {
              const events = newEvents.filter(
                (event) => event.requestId === request.id,
              );
              const summary = incomingSummary(data, request.id);
              return (
                <Link
                  key={request.id}
                  to={`/reviews/${request.id}`}
                  className="surface shared-review-row"
                >
                  <Icon name="send" size={22} />
                  <div>
                    <strong>{request.title}</strong>
                    <span>
                      {summary.studentName && `${summary.studentName} · `}
                      {request.researchName && `${request.researchName} · `}
                      {t("검토 항목 {count}개", {
                        count: summary.total,
                      })}{" "}
                      · {formatDateTime(request.createdAt, { time: false })}
                    </span>
                  </div>
                  {summary.pending > 0 ? (
                    <StatusBadge tone="amber">
                      {t("응답 전 {count}개", { count: summary.pending })}
                    </StatusBadge>
                  ) : (
                    summary.total > 0 && (
                      <StatusBadge tone="green">{t("모두 응답함")}</StatusBadge>
                    )
                  )}
                  {events.length > 0 && (
                    <StatusBadge tone="blue">
                      {t("새 알림 {count}개", { count: events.length })}
                    </StatusBadge>
                  )}
                  <Icon name="chevron-right" size={17} />
                </Link>
              );
            })}
          </div>
        </section>
      )}
      {invites.length > 0 && (
        <section aria-label={t("공동연구 초대")}>
          <h2>{t("받은 초대")}</h2>
          {invites.map((m) => (
            <div className="invitation-row" key={m.researchId}>
              <div>
                <h3>{t("공동연구 초대")}</h3>
                <p>
                  {data.events.find(
                    (e) => e.researchId === m.researchId && e.kind === "invite",
                  )?.message ?? t("연구에 초대받았어요.")}
                </p>
              </div>
              <Button
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    await w.action("rms_member_action", {
                      researchId: m.researchId,
                      action: "accept",
                    });
                    navigate(`/r/${m.researchId}`);
                  } catch (e) {
                    toast.error(friendlyError(e));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {t("초대 수락")}
              </Button>
            </div>
          ))}
        </section>
      )}
      {data.polls
        .filter(
          (p) =>
            p.status === "open" &&
            p.participants.some((m) => m.userId === user.id),
        )
        .map((p) => (
          <Link key={p.id} to={`/schedule/${p.id}`} className="invitation-row">
            <div>
              <h3>{p.title}</h3>
              <p>{t("미팅 시간 조율 · 가능한 시간을 알려 주세요.")}</p>
            </div>
            <Icon name="arrow-right" size={18} />
          </Link>
        ))}
      {!incomingOnly && (
        <div className="research-view-switch">
          <Segments
            value={view}
            onChange={(v) =>
              setCreationParams(v === "active" ? {} : { view: v })
            }
            label={t("연구 목록")}
            options={[
              { value: "active", label: t("진행 중인 연구") },
              {
                value: "archived",
                label: t("보관함"),
                count: data.researches.filter(
                  (r) => r.archivedAt && !r.deletedAt,
                ).length,
              },
              {
                value: "trash",
                label: t("휴지통"),
                count: data.researches.filter((r) => r.deletedAt).length,
              },
            ]}
          />
        </div>
      )}
      {visibleResearches.length ? (
        <div className="research-grid">
          {visibleResearches.map((research) => {
            const actions = researchCardActions(
              view,
              research.ownerId === user.id,
            );
            return (
              <ResearchCardContextMenu
                key={research.id}
                actions={actions}
                disabled={pending}
                onAction={(id) => runCardAction(research, id)}
              >
                <div className="surface research-card-wrap">
                  <Link
                    className="research-card"
                    to={trashView ? "/r?view=trash" : `/r/${research.id}`}
                    aria-disabled={trashView || undefined}
                    tabIndex={trashView ? -1 : undefined}
                    onClick={(e) => {
                      if (trashView) e.preventDefault();
                    }}
                  >
                    <span className="research-card-top">
                      <span className="research-card-icon">
                        <Icon name="book" size={24} />
                      </span>
                      <span className="research-card-badge" key={view}>
                        <StatusBadge tone={statusBadge.tone}>
                          {statusBadge.label}
                        </StatusBadge>
                      </span>
                    </span>
                    <h2>{research.name}</h2>
                    <p>{research.description || t("설명이 없어요.")}</p>
                    <span className="meta">
                      {trashView ? (
                        t("복원하면 기록을 다시 볼 수 있어요.")
                      ) : (
                        <>
                          {t("미팅 {meetings}개 · 남은 할 일 {tasks}개", {
                            meetings: data.meetings.filter(
                              (m) => m.researchId === research.id,
                            ).length,
                            tasks: data.tasks.filter(
                              (task) =>
                                task.researchId === research.id &&
                                task.status !== "done",
                            ).length,
                          })}
                          {research.submissionDate &&
                            daysUntil(todayKey(), research.submissionDate) !==
                              null &&
                            ` · ${t("투고 {label}", {
                              label: dDayLabel(
                                daysUntil(todayKey(), research.submissionDate)!,
                              ),
                            })}`}
                          <Icon name="arrow-up-right" size={16} />
                        </>
                      )}
                    </span>
                  </Link>
                  <div className="research-card-actions">
                    {trashView ? (
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() => runCardAction(research, "restore")}
                      >
                        {t("복원")}
                      </Button>
                    ) : (
                      <Button asChild variant="outline">
                        <Link to={`/r/${research.id}/settings`}>
                          {t("연구 설정")}
                        </Link>
                      </Button>
                    )}
                    {archivedView && research.ownerId === user.id && (
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() => runCardAction(research, "unarchive")}
                      >
                        {t("복원")}
                      </Button>
                    )}
                    {trashView && research.ownerId === user.id && (
                      <PermanentResearchDelete
                        id={research.id}
                        name={research.name}
                      />
                    )}
                    {!trashView && (
                      <ResearchCardMoreMenu
                        name={research.name}
                        actions={actions}
                        disabled={pending}
                        onAction={(id) => runCardAction(research, id)}
                      />
                    )}
                  </div>
                </div>
              </ResearchCardContextMenu>
            );
          })}
        </div>
      ) : !incomingOnly ? (
        <EmptyState
          icon="book"
          title={
            trashView
              ? t("휴지통이 비어 있어요")
              : archivedView
                ? t("보관한 연구가 없어요")
                : t("진행 중인 연구가 없어요")
          }
          description={
            trashView
              ? t(
                  "휴지통으로 옮긴 연구는 여기에서 복원할 수 있어요. 자동으로 완전히 삭제되지 않아요.",
                )
              : archivedView
                ? t("연구 설정에서 보관한 연구가 여기에 표시돼요.")
                : t("연구를 만들거나 보관함의 연구를 복원하세요.")
          }
          action={
            <Button onClick={() => navigate("/r/new")}>
              <Icon name="plus" size={16} />
              {t("연구 만들기")}
            </Button>
          }
        />
      ) : null}
      <Dialog
        open={!!trashTarget}
        onOpenChange={(open) => {
          if (!pending && !open) setTrashTarget(null);
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>{t("연구를 휴지통으로 옮길까요?")}</DialogTitle>
            <DialogDescription>
              {t(
                "옮기면 공동연구자가 이 연구에 접근할 수 없고, 공유 중인 검토 요청이 중지돼 교수님도 볼 수 없어요. 휴지통에서 복원할 수 있지만, 검토 요청 공유는 자동으로 다시 시작되지 않아요. 확인을 위해 연구 이름을 입력해 주세요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!trashTarget || pending || trashName !== trashTarget.name)
                return;
              setPending(true);
              try {
                await saveResearch({
                  ...trashTarget,
                  deletedAt: new Date().toISOString(),
                });
                setTrashTarget(null);
                toast.success(
                  t("휴지통으로 옮겼어요. 휴지통에서 복원할 수 있어요."),
                );
              } catch (e) {
                toast.error(friendlyError(e));
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field">
              {trashTarget?.name}
              <Input
                value={trashName}
                onChange={(e) => setTrashName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="button-row">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setTrashTarget(null)}
              >
                {t("취소")}
              </Button>
              <Button
                type="submit"
                disabled={pending || trashName !== trashTarget?.name}
                aria-describedby={trashReason.describedBy}
              >
                {t("휴지통으로 옮기기")}
              </Button>
            </div>
            {trashReason.node}
          </form>
        </DialogContent>
      </Dialog>
      {trashView && <PendingResearchDeletions />}
    </div>
  );
}
