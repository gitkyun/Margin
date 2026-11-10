import {
  PermanentResearchDelete,
  PendingResearchDeletions,
} from "@/components/PermanentResearchDelete";
import { PublicFrame } from "./PublicPages";
import { ThemeSwitch } from "@/components/ThemeSwitch";
export { ThemeSwitch } from "@/components/ThemeSwitch";
import { useId, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import { Icon } from "@/components/icons";
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
    [error, setError] = useState(""),
    // 이메일·비밀번호가 맞지 않을 때만 두 칸을 오류로 표시합니다(QA D-016).
    // 연결 오류는 칸의 문제가 아니라서 표시하지 않아요.
    [credentialsInvalid, setCredentialsInvalid] = useState(false);
  const errorId = useId();
  const emailInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/r";
  const target =
    /^\/(r|reviews|schedule)(\/|\?|$)/.test(next) && !next.startsWith("//")
      ? next
      : "/r";
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
            ? "이메일과 비밀번호를 확인해 주세요."
            : "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
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
            지난 기록이
            <br />
            그대로 있어요
          </h1>
          <p>
            미팅 기록, 피드백, 검토 요청을
            <br />
            로그인하면 바로 볼 수 있어요.
          </p>
        </div>
        <section className="auth-panel">
          <h2>로그인</h2>
          <p>
            {target.startsWith("/reviews/")
              ? "학생이 검토 요청에 지정한 교수 계정 이메일로 로그인해 주세요."
              : "발급받은 계정의 이메일로 로그인하세요."}
          </p>
          {authenticated ? (
            <>
              <div className="signed-in-notice">
                <Icon name="check-circle" size={23} />
                <p>이미 로그인되어 있어요.</p>
              </div>
              <Button fullWidth size="lg" asChild>
                <Link to={target}>
                  {target === "/r" ? "내 연구 열기" : "계속하기"}
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
                    이 미리보기에서는 로그인할 수 없어요.{" "}
                    <Link to="/r">가상 기록 보기</Link>
                  </p>
                </div>
              )}
              <label className="field">
                이메일
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
                비밀번호
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
                {pending ? "로그인 중" : "로그인"}
                <Icon name="arrow-right" size={18} />
              </Button>
            </form>
          )}
          <p className="auth-switch">
            계정이 없나요? <Link to="/signup">가입 과정 미리보기</Link>
          </p>
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
  const view = creationParams.get("view") ?? "active",
    archivedView = view === "archived",
    trashView = view === "trash";
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
  // 연구 만들기는 온보딩 화면(/r/new)이 맡습니다. 예전 주소(?new=1)도 그리로 보냅니다.
  const wantsNew = creationParams.get("new") === "1";
  const noResearchYet =
    data.researches.length === 0 && !incomingOnly && invites.length === 0;
  if (wantsNew || noResearchYet) return <Navigate to="/r/new" replace />;
  return (
    <>
      <PageHeader
        title={incomingOnly ? "받은 검토 요청" : "내 연구"}
        description={
          incomingOnly
            ? "학생이 요청한 검토를 열어 항목마다 응답을 남겨 주세요."
            : "연구마다 기록과 자료가 따로 관리돼요."
        }
        actions={
          !incomingOnly && (
            <Button onClick={() => navigate("/r/new")}>
              <Icon name="plus" size={17} />
              연구 만들기
            </Button>
          )
        }
      />
      {sharedRequests.length > 0 && (
        <section
          className="shared-review-section"
          aria-label="받은 검토 요청 목록"
        >
          {!incomingOnly && <h2>받은 검토 요청</h2>}
          <div className="shared-review-list">
            {sharedRequests.map((request) => {
              const events = newEvents.filter(
                (event) => event.requestId === request.id,
              );
              const itemCount = data.reviewItems.filter(
                (item) => item.requestId === request.id,
              ).length;
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
                      검토 항목 {itemCount}개 ·{" "}
                      {formatDateTime(request.createdAt, { time: false })}
                    </span>
                  </div>
                  {events.length > 0 && (
                    <StatusBadge tone="blue">
                      새 소식 {events.length}개
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
        <section aria-label="공동연구 초대">
          <h2>받은 초대</h2>
          {invites.map((m) => (
            <div className="invitation-row" key={m.researchId}>
              <div>
                <h3>공동연구 초대</h3>
                <p>
                  {data.events.find(
                    (e) => e.researchId === m.researchId && e.kind === "invite",
                  )?.message ?? "연구에 초대받았어요."}
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
                초대 수락
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
              <p>미팅 시간 조율 · 가능한 시간을 알려 주세요.</p>
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
            label="연구 목록"
            options={[
              { value: "active", label: "진행 중인 연구" },
              {
                value: "archived",
                label: "보관함",
                count: data.researches.filter(
                  (r) => r.archivedAt && !r.deletedAt,
                ).length,
              },
              {
                value: "trash",
                label: "휴지통",
                count: data.researches.filter((r) => r.deletedAt).length,
              },
            ]}
          />
        </div>
      )}
      {visibleResearches.length ? (
        <div className="research-grid">
          {visibleResearches.map((research) => (
            <div key={research.id} className="surface research-card-wrap">
              <Link
                className="research-card"
                to={trashView ? "/r?view=trash" : `/r/${research.id}`}
                aria-disabled={trashView || undefined}
                tabIndex={trashView ? -1 : undefined}
                onClick={(e) => {
                  if (trashView) e.preventDefault();
                }}
              >
                <span className="research-card-icon">
                  <Icon name="book" size={24} />
                </span>
                <h2>{research.name}</h2>
                <p>{research.description || "설명이 없어요."}</p>
                <span className="meta">
                  {trashView ? (
                    "복원하면 기록을 다시 볼 수 있어요."
                  ) : (
                    <>
                      미팅{" "}
                      {
                        data.meetings.filter(
                          (m) => m.researchId === research.id,
                        ).length
                      }
                      개 · 남은 할 일{" "}
                      {
                        data.tasks.filter(
                          (t) =>
                            t.researchId === research.id && t.status !== "done",
                        ).length
                      }
                      개
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
                    onClick={async () => {
                      setPending(true);
                      try {
                        await saveResearch({
                          ...research,
                          deletedAt: undefined,
                          archivedAt: undefined,
                        });
                        toast.success(
                          "연구를 복원했어요. 검토 요청 공유는 직접 다시 시작해 주세요.",
                        );
                      } catch (e) {
                        toast.error(friendlyError(e));
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    복원
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link to={`/r/${research.id}/settings`}>연구 설정</Link>
                  </Button>
                )}
                {archivedView && research.ownerId === user.id && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await saveResearch({
                          ...research,
                          archivedAt: undefined,
                        });
                        toast.success("진행 중인 연구로 복원했어요.");
                      } catch (e) {
                        toast.error(friendlyError(e));
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    복원
                  </Button>
                )}
                {trashView && research.ownerId === user.id && (
                  <PermanentResearchDelete
                    id={research.id}
                    name={research.name}
                  />
                )}
                {!trashView && research.ownerId === user.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        aria-label={`${research.name} 더보기`}
                      >
                        <Icon name="more" size={18} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onSelect={() => {
                          setTrashTarget(research);
                          setTrashName("");
                        }}
                      >
                        <Icon name="trash" size={16} />
                        휴지통으로 옮기기
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : !incomingOnly ? (
        <EmptyState
          icon="book"
          title={
            trashView
              ? "휴지통이 비어 있어요"
              : archivedView
                ? "보관한 연구가 없어요"
                : "진행 중인 연구가 없어요"
          }
          description={
            trashView
              ? "휴지통으로 옮긴 연구는 여기에서 복원할 수 있어요. 자동으로 완전히 삭제되지 않아요."
              : archivedView
                ? "연구 설정에서 보관한 연구가 여기에 표시돼요."
                : "연구를 만들거나 보관함의 연구를 복원하세요."
          }
          action={
            <Button onClick={() => navigate("/r/new")}>
              <Icon name="plus" size={16} />
              연구 만들기
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
            <DialogTitle>연구를 휴지통으로 옮길까요?</DialogTitle>
            <DialogDescription>
              옮기면 공동연구자가 이 연구에 접근할 수 없고, 공유 중인 검토
              요청이 중지돼 교수님도 볼 수 없어요. 휴지통에서 복원할 수 있지만,
              검토 요청 공유는 자동으로 다시 시작되지 않아요. 확인을 위해 연구
              이름을 입력해 주세요.
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
                  "휴지통으로 옮겼어요. 휴지통에서 복원할 수 있어요.",
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
                취소
              </Button>
              <Button
                type="submit"
                disabled={pending || trashName !== trashTarget?.name}
              >
                휴지통으로 옮기기
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {trashView && <PendingResearchDeletions />}
    </>
  );
}
