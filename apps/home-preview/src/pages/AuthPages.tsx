import { useNavigationGuard } from "@/lib/navigation-guard";
import { useRef, useState, type FormEvent } from "react";
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
import { useTheme } from "@/lib/theme";
import { unreadReviewNotifications } from "@/lib/notifications";
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="화면 테마">
      {(
        [
          { value: "light", label: "라이트", icon: "sun" },
          { value: "dark", label: "다크", icon: "moon" },
          { value: "system", label: "시스템", icon: "monitor" },
        ] as const
      ).map((t) => (
        <button
          type="button"
          key={t.value}
          aria-label={t.label + " 테마"}
          aria-pressed={theme === t.value}
          onClick={() => setTheme(t.value)}
        >
          <Icon name={t.icon} size={16} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
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
  const next = params.get("next") ?? "/";
  const target =
    /^\/(r|reviews)(\/|\?|$)/.test(next) && !next.startsWith("//") ? next : "/";
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
      if (error) throw new Error("이메일과 비밀번호를 확인해 주세요.");
      setPassword("");
      navigate(target, { replace: true });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-top">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Icon name="book" size={23} />
          </span>
          RMS
        </Link>
        <ThemeSwitch />
      </div>
      <main className="login-main">
        <div className="login-intro">
          <div className="login-dots" aria-hidden="true">
            {Array.from({ length: 49 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <h1>
            지난 지도를
            <br />
            다음 연구로.
          </h1>
          <p>
            미팅 기록부터 수정 결과까지,
            <br />
            흩어진 연구의 맥락을 한곳에서 이어갑니다.
          </p>
          <div className="login-flow">
            <span>기록</span>
            <Icon name="chevron-right" size={14} />
            <span>수정</span>
            <Icon name="chevron-right" size={14} />
            <span>검토</span>
            <Icon name="chevron-right" size={14} />
            <span>다음 미팅</span>
          </div>
        </div>
        <section className="login-card">
          <h2>로그인</h2>
          <p>발급받은 계정으로 접속해 주세요.</p>
          {authenticated ? (
            <Button asChild>
              <Link to={target}>
                작업 공간으로 이동
                <Icon name="arrow-right" size={17} />
              </Link>
            </Button>
          ) : (
            <form onSubmit={submit}>
              <Field label="이메일" required>
                <Input
                  type="email"
                  autoComplete="username"
                  aria-label="이메일"
                  placeholder="name@university.ac.kr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!configured}
                />
              </Field>
              <Field label="비밀번호" required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  aria-label="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  disabled={!configured}
                />
              </Field>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <Button
                className="login-submit"
                type="submit"
                disabled={pending || !configured}
              >
                {pending ? "로그인 중" : "로그인"}
                <Icon name="arrow-right" size={17} />
              </Button>
            </form>
          )}
          <div className="login-help">
            <Icon name="lock" size={16} />
            <p>교수 검토 링크로 들어왔다면 로그인 후 해당 검토로 이동합니다.</p>
          </div>
          {!configured && (
            <div className="preview-entry">
              <p>현재는 서버 연결 전 화면 미리보기입니다.</p>
              <Button variant="outline" asChild>
                <Link to="/">
                  가상 연구 둘러보기
                  <Icon name="arrow-up-right" size={16} />
                </Link>
              </Button>
            </div>
          )}
        </section>
      </main>
      <footer>
        RMS · 논문 지도 협업 및 연구 진행 관리
        <span>수업 시연용 · 가상 자료 사용</span>
      </footer>
    </div>
  );
}
export function ResearchSelectPage() {
  const { data, user, saveResearch, seedDemo, mode } = useWorkspace();
  const sharedRequests = data.reviews
    .filter(
      (request) =>
        request.professorId === user.id && request.status === "shared",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const incomingOnly =
    sharedRequests.length > 0 && data.researches.length === 0;
  const newEvents = unreadReviewNotifications(data, user);
  const navigate = useNavigate();
  const createId = useRef(uid());
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [pending, setPending] = useState(false);
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
      {data.researches.length ? (
        <div className="research-grid">
          {data.researches.map((research) => (
            <Link
              key={research.id}
              className="surface research-card"
              to={`/r/${research.id}`}
            >
              <span className="research-card-icon">
                <Icon name="book" size={24} />
              </span>
              <h2>{research.name}</h2>
              <p>
                {research.description || "설명을 추가하지 않은 연구입니다."}
              </p>
              <span className="meta">
                {
                  data.meetings.filter((m) => m.researchId === research.id)
                    .length
                }
                개 미팅 ·{" "}
                {
                  data.tasks.filter(
                    (t) => t.researchId === research.id && t.status !== "done",
                  ).length
                }
                개 남은 작업
                <Icon name="arrow-up-right" size={16} />
              </span>
            </Link>
          ))}
        </div>
      ) : !incomingOnly ? (
        <EmptyState
          icon="book"
          title="첫 연구를 만들어 보세요."
          description="이름만 정하면 미팅을 기록하고 작업을 모을 수 있습니다."
          action={
            <Button onClick={() => setOpen(true)}>
              <Icon name="plus" size={16} />
              연구 만들기
            </Button>
          }
        />
      ) : null}
      {!incomingOnly && (
        <div className="demo-seed">
          <Icon name="info" size={18} />
          <div>
            <strong>가상 자료로 흐름을 살펴보려면</strong>
            <p>
              {mode === "preview"
                ? "미리보기 기록을 처음 상태로 다시 불러올 수 있습니다."
                : "가상 연구와 미팅 메모를 추가합니다. 다른 연구는 바뀌지 않습니다."}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={async () => {
              if (
                mode === "preview" &&
                !confirm("현재 미리보기 기록을 초기 상태로 되돌릴까요?")
              )
                return;
              setPending(true);
              try {
                navigate(`/r/${await seedDemo()}`);
              } catch (e) {
                toast.error(friendlyError(e));
              } finally {
                setPending(false);
              }
            }}
          >
            가상 연구 불러오기
          </Button>
        </div>
      )}
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
