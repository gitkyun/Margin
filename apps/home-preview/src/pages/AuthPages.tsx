import {PermanentResearchDelete, PendingResearchDeletions} from "@/components/PermanentResearchDelete";
import { PublicFrame } from "./PublicPages";
import { ThemeSwitch } from "@/components/ThemeSwitch";
export { ThemeSwitch } from "@/components/ThemeSwitch";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { now, uid } from "@/lib/domain";
import { configured, assertConnected, friendlyError } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Field,
  StatusBadge,
} from "@/components/common";
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
    [error, setError] = useState("");
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
    try {
      const { error } = await assertConnected().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error)
        throw new Error(
          error.message?.includes("fetch")
            ? "서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요."
            : "이메일과 비밀번호를 확인해 주세요.",
        );
      setPassword("");
      navigate(target, { replace: true });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <PublicFrame compact signedIn={authenticated}>
      <section className="signup-layout login-layout">
        <div className="auth-story">
          <h1>
            다시 이어가는
            <br />
            나의 연구.
          </h1>
          <p>
            지난 미팅의 기록과
            <br />
            다음에 할 일이 기다리고 있어요.
          </p>

        </div>
        <section className="auth-panel">
          <h2>로그인</h2>
          <p>이메일로 로그인하고 연구를 이어가세요.</p>
          {authenticated ? (
            <>
              <div className="signed-in-notice">
                <Icon name="check-circle" size={23} />
                <p>이미 로그인되어 있습니다.</p>
              </div>
              <Link className="rms-action primary full" to={target}>
                작업 공간으로 이동
                <Icon name="arrow-right" size={18} />
              </Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <label className="field">
                이메일
                <input
                  className="rms-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.ac.kr"
                  required
                  disabled={!configured || pending}
                />
              </label>
              <label className="field">
                비밀번호
                <input
                  className="rms-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                  disabled={!configured || pending}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="rms-action primary full"
                disabled={pending || !configured}
              >
                {pending ? "로그인 중" : "로그인"}
                <Icon name="arrow-right" size={18} />
              </button>
            </form>
          )}
          <p className="auth-switch">
            처음 오셨나요? <Link to="/signup">가입 과정 살펴보기</Link>
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
  const [trashTarget, setTrashTarget] = useState<(typeof data.researches)[number] | null>(null);
  const [trashName, setTrashName] = useState("");
  const navigate = useNavigate();
  const createId = useRef(uid());
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    if (creationParams.get("new") === "1") {
      setOpen(true);
      const next = new URLSearchParams(creationParams);
      next.delete("new");
      setCreationParams(next, { replace: true });
    }
  }, [creationParams, setCreationParams]);
  const researchGuard = useNavigationGuard({
    dirty: open && (!!name.trim() || !!description.trim()),
    busy: pending,
    label: "새 연구",
    onDiscard: () => setOpen(false),
  });
  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending || !name.trim()) return;
    setPending(true);
    try {
      const time = now();
      const value = await saveResearch({
        id: createId.current,
        ownerId: user.id,
        name: name.trim(),
        description: description.trim(),
        createdAt: time,
        updatedAt: time,
      });
      createId.current = uid();
      researchGuard.clear();
      setOpen(false);
      navigate(`/r/${value.id}`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader
        title={incomingOnly ? "공유받은 검토" : "내 연구"}
        description={
          incomingOnly
            ? "학생이 공유한 수정 결과를 열어 항목별로 검토하세요."
            : "연구별로 기록과 자료를 나누고, 이어서 작업할 연구를 선택하세요."
        }
        actions={
          !incomingOnly && (
            <Button onClick={() => setOpen(true)}>
              <Icon name="plus" size={17} />
              연구 만들기
            </Button>
          )
        }
      />
      {sharedRequests.length > 0 && (
        <section
          className="shared-review-section"
          aria-label="공유받은 검토 목록"
        >
          {!incomingOnly && <h2>공유받은 검토</h2>}
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
                      {new Date(request.createdAt).toLocaleDateString("ko-KR")}
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
                  )?.message ?? "연구 공간에 초대받았습니다."}
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
              <p>미팅 시간 조율 · 가능한 시간을 알려주세요.</p>
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
                <p>
                  {research.description || "설명을 추가하지 않은 연구입니다."}
                </p>
                <span className="meta">
                  {trashView ? "연구를 복원하면 기록을 확인할 수 있습니다." : <>
                  {
                    data.meetings.filter((m) => m.researchId === research.id)
                      .length
                  }
                  개 미팅 ·{" "}
                  {
                    data.tasks.filter(
                      (t) =>
                        t.researchId === research.id && t.status !== "done",
                    ).length
                  }
                  개 남은 작업
                  <Icon name="arrow-up-right" size={16} />
                  </>}
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
                          "복원했습니다. 교수 공유는 직접 다시 시작해 주세요.",
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
                {archivedView && research.ownerId === user.id && <Button variant="outline" disabled={pending} onClick={async () => {
                  setPending(true);
                  try { await saveResearch({ ...research, archivedAt: undefined }); toast.success("진행 중인 연구로 복원했습니다."); }
                  catch (e) { toast.error(friendlyError(e)); } finally { setPending(false); }
                }}>복원</Button>}
                {trashView && research.ownerId === user.id && <PermanentResearchDelete id={research.id} name={research.name}/>}
                {!trashView && research.ownerId === user.id && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => { setTrashTarget(research); setTrashName(""); }}
                  >
                    삭제
                  </Button>
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
              ? "휴지통이 비어 있습니다."
              : archivedView
                ? "보관한 연구가 없습니다."
                : "진행 중인 연구가 없습니다."
          }
          description={
            trashView
              ? "삭제한 연구는 이곳에서 복원할 수 있습니다. 자동으로 영구 삭제하지 않습니다."
              : archivedView
                ? "보관한 연구를 열어 설정에서 다시 복원할 수 있습니다."
                : "연구를 만들거나 보관함의 연구를 복원하세요."
          }
          action={
            <Button onClick={() => setOpen(true)}>
              <Icon name="plus" size={16} />
              연구 만들기
            </Button>
          }
        />
      ) : null}
      <Dialog open={!!trashTarget} onOpenChange={(open) => { if (!pending && !open) setTrashTarget(null); }}>
        <DialogContent className="rms-dialog">
          <DialogHeader><DialogTitle>연구를 휴지통으로 옮길까요?</DialogTitle><DialogDescription>기록은 보존되며 복원할 수 있습니다. 공동연구자와 교수의 접근은 중지됩니다. 확인을 위해 연구 이름을 입력해 주세요.</DialogDescription></DialogHeader>
          <form onSubmit={async (e) => { e.preventDefault(); if (!trashTarget || pending || trashName !== trashTarget.name) return; setPending(true); try { await saveResearch({...trashTarget, deletedAt: new Date().toISOString()}); setTrashTarget(null); toast.success("휴지통으로 옮겼습니다. 휴지통에서 복원할 수 있습니다."); } catch(e) { toast.error(friendlyError(e)); } finally { setPending(false); } }}>
            <label className="field">{trashTarget?.name}<Input value={trashName} onChange={e => setTrashName(e.target.value)} autoComplete="off" /></label>
            <div className="button-row"><Button type="button" variant="outline" disabled={pending} onClick={() => setTrashTarget(null)}>취소</Button><Button type="submit" disabled={pending || trashName !== trashTarget?.name}>휴지통으로 이동</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      {trashView && <PendingResearchDeletions/>}
      <Dialog
        open={open}
        onOpenChange={(nextOpen: boolean) => {
          if (!pending) setOpen(nextOpen);
        }}
      >
        <DialogContent
          className="rms-dialog"
          showCloseButton={!pending}
          aria-busy={pending}
          onEscapeKeyDown={(event: { preventDefault(): void }) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event: { preventDefault(): void }) => {
            if (pending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>연구 만들기</DialogTitle>
            <DialogDescription>
              지도받는 연구 단위로 공간을 만듭니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="stack">
            <Field label="연구 이름" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoFocus
                required
                placeholder="예: 대학원생의 연구 도구 사용 경험"
              />
            </Field>
            <Field label="설명" hint="지금 적지 않아도 됩니다.">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="어떤 연구인지 짧게 적어 주세요."
              />
            </Field>
            <div className="form-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                취소
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                연구 만들기
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
