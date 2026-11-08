import { MIN_PASSWORD_LENGTH, PASSWORD_HELP } from "../lib/password-policy";
import {
  reviewDepthOptions,
  resolveReviewDepth,
  reviewDepthHints,
  researchModelLabel,
} from "@/lib/assistant-presentation";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { assertConnected, friendlyError } from "@/lib/supabase";
import { changeAccountPassword } from "@/lib/password-change";
import { useAIUsage } from "@/lib/ai-usage";
import { useExperience } from "@/lib/experience";
import { useAICapabilities } from "@/lib/ai-capabilities";
import { Choice } from "@/components/experience";
import { ThemeSwitch } from "./AuthPages";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function UsageDetails() {
  const { mode } = useWorkspace();
  const usage = useAIUsage();
  return (
    <section className="settings-section">
      <h2>AI 사용량</h2>
      <p>
        최근 24시간 동안의 실행 요청을 집계합니다. 성공과 실패를 따로
        표시합니다.
      </p>
      <div className="usage-summary">
        <div>
          <span>실행 요청</span>
          <strong>
            {usage.data?.total ?? "—"}
            <small> / {usage.data?.limit ?? 100}회</small>
          </strong>
        </div>
        <div>
          <span>완료</span>
          <strong>{usage.data?.complete ?? "—"}</strong>
        </div>
        <div>
          <span>실패</span>
          <strong>{usage.data?.failed ?? "—"}</strong>
        </div>
      </div>
      {usage.data && (
        <progress
          className="usage-progress"
          max={usage.data.limit}
          value={usage.data.total}
          aria-label="최근 24시간 AI 요청 사용량"
        />
      )}
      <p className="settings-note">
        선택한 기록으로 실행한 작업을 기준으로 집계합니다. 완료되지 않은 작업도
        따로 확인할 수 있습니다.
      </p>
      {mode === "preview" ? (
        <p className="inline-notice">
          미리보기에서는 서버 사용량을 집계하지 않습니다.
        </p>
      ) : usage.isError ? (
        <div className="inline-notice" role="alert">
          사용량을 불러오지 못했습니다.{" "}
          <button className="text-link" onClick={() => usage.refetch()}>
            다시 불러오기
          </button>
        </div>
      ) : usage.isPending ? (
        <p role="status">실행 기록을 확인하고 있습니다.</p>
      ) : null}
      <div className="settings-list">
        <div>
          <span>처리 방식</span>
          <strong>선택한 기록과 질문만 사용</strong>
        </div>
        <div>
          <span>실행 제한</span>
          <strong>최근 24시간 100회 · 분당 6회</strong>
        </div>
      </div>
    </section>
  );
}
export function AccountPage() {
  const { user, mode } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "profile";
  const [name, setName] = useState(user.name),
    [busy, setBusy] = useState(false);
  useEffect(() => setName(user.name), [user.name]);
  const guard = useNavigationGuard({
    dirty: tab === "profile" && name.trim() !== user.name,
    busy,
    label: "프로필 이름",
  });
  return (
    <div className="settings-page">
      <div className="settings-heading">
        <h1>계정 설정</h1>
        <p>개인 정보와 화면 환경을 한곳에서 설정하세요.</p>
      </div>
      <div className="settings-layout">
        <nav aria-label="계정 설정 항목">
          {[
            ["profile", "user", "프로필"],
            ["appearance", "sun", "화면 설정"],
            ["notifications", "bell", "알림"],
            ["ai", "sparkles", "AI 기본 설정"],
            ["usage", "chart", "사용량 및 플랜"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setParams({ tab: id })}
            >
              <Icon name={icon} size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {tab === "usage" ? (
            <>
              <UsageDetails />
              <PlanComparison />
            </>
          ) : tab === "notifications" ? (
            <PreferenceSettings kind="notifications" />
          ) : tab === "ai" ? (
            <PreferenceSettings kind="ai" />
          ) : tab === "appearance" ? (
            <section className="settings-section">
              <h2>화면 설정</h2>
              <p>선택한 테마는 이 브라우저에 바로 적용됩니다.</p>
              <div className="appearance-preview" aria-hidden="true">
                <div />
                <div>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <ThemeSwitch />
              <p className="settings-note">
                시스템은 기기의 밝기 설정을 따릅니다. 기기의 ‘동작 줄이기’를
                사용하면 장식 애니메이션도 줄어듭니다.
              </p>
            </section>
          ) : (
            <section className="settings-section">
              <div className="profile-heading">
                <span className="avatar profile-avatar">
                  {user.name.slice(0, 1)}
                </span>
                <div>
                  <h2>내 프로필</h2>
                  <p>{user.email}</p>
                </div>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (busy || !name.trim()) return;
                  setBusy(true);
                  try {
                    if (mode === "preview") {
                      toast.info(
                        "미리보기에서는 계정 정보를 변경하지 않습니다.",
                      );
                      return;
                    }
                    const { error } = await assertConnected().auth.updateUser({
                      data: { name: name.trim() },
                    });
                    if (error) throw error;
                    guard.clear();
                    toast.success("프로필 이름을 저장했습니다.");
                  } catch (e) {
                    toast.error(friendlyError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="field">
                  표시 이름
                  <input
                    className="rms-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    required
                  />
                </label>
                <label className="field">
                  로그인 이메일
                  <input className="rms-input" value={user.email} readOnly />
                  <small>로그인 이메일은 이 화면에서 바꿀 수 없습니다.</small>
                </label>
                <div className="settings-form-actions">
                  <button
                    className="rms-action quiet"
                    type="button"
                    disabled={busy}
                    onClick={() => setName(user.name)}
                  >
                    변경 취소
                  </button>
                  <button
                    className="rms-action primary"
                    disabled={busy || name.trim() === user.name}
                  >
                    {busy ? "저장 중" : "변경사항 저장"}
                  </button>
                </div>
              </form>
              <PasswordSettings />
              <div className="settings-security">
                <Icon name="lock" size={21} />
                <p>
                  프로필 변경으로 연구 소유권이나 교수 검토 권한이 바뀌지
                  않습니다.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
export function PlanComparison() {
  return <SubscriptionPlans />;
}
function PreferenceSettings({ kind }: { kind: "notifications" | "ai" }) {
  const { mode } = useWorkspace(),
    caps = useAICapabilities(),
    [prefs, setPrefs] = useState<Record<string, string | boolean>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (mode === "connected")
      void assertConnected()
        .auth.getUser()
        .then(({ data }) =>
          setPrefs(data.user?.user_metadata?.preferences ?? {}),
        );
  }, [mode]);
  const selectedModel =
    caps.data?.models.find((m) => m.id === prefs.model) ?? caps.data?.models[0];
  const selectedDepth = resolveReviewDepth(
    selectedModel?.thinking ?? [],
    String(prefs.thinking ?? "minimal"),
  );
  return (
    <section className="settings-section">
      <h2>{kind === "ai" ? "AI 기본 설정" : "알림 설정"}</h2>
      <p>
        {kind === "ai"
          ? "실행할 때마다 자료 범위를 확인합니다. 기본값을 바꿔도 작업이 자동으로 실행되지는 않습니다."
          : "서비스 안에서 확인할 알림을 선택하세요. 이메일과 브라우저 푸시는 발송하지 않습니다."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (mode === "preview")
              throw new Error("로그인한 뒤 설정을 저장할 수 있습니다.");
            if (kind === "ai" && !selectedModel)
              throw new Error("AI 설정을 불러온 뒤 다시 저장해 주세요.");
            const preferences =
              kind === "ai"
                ? {
                    ...prefs,
                    model: selectedModel!.id,
                    thinking: selectedDepth,
                  }
                : prefs;
            const { error } = await assertConnected().auth.updateUser({
              data: { preferences },
            });
            if (error) throw error;
            toast.success("설정을 저장했습니다.");
          } catch (e) {
            setError(friendlyError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {kind === "ai" ? (
          <>
            <label className="field">
              기본 모델
              <Choice
                value={selectedModel?.id ?? ""}
                label="기본 모델"
                disabled={!caps.data}
                onChange={(v) =>
                  setPrefs({
                    ...prefs,
                    model: v,
                    thinking: resolveReviewDepth(
                      caps.data?.models.find((m) => m.id === v)?.thinking ?? [],
                      String(prefs.thinking ?? "minimal"),
                    ),
                  })
                }
                options={
                  caps.data?.models.map((m) => ({
                    value: m.id,
                    label: researchModelLabel(m),
                  })) ?? [
                    {
                      value: "",
                      label: caps.isError
                        ? "모델을 불러오지 못했습니다"
                        : "모델 확인 중",
                    },
                  ]
                }
              />
            </label>
            {!!selectedModel?.thinking.length && (
              <label className="field">
                기본 검토 깊이
                <Choice
                  value={selectedDepth}
                  label="기본 검토 깊이"
                  options={reviewDepthOptions(selectedModel.thinking)}
                  onChange={(v) => setPrefs({ ...prefs, thinking: v })}
                />
                <small>{reviewDepthHints[selectedDepth]}</small>
              </label>
            )}
            {caps.isError && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void caps.refetch()}
              >
                모델 다시 확인
              </Button>
            )}
          </>
        ) : (
          <div className="preferences-list">
            {[
              ["review", "교수 의견과 댓글"],
              ["assignment", "담당 작업 변경"],
              ["schedule", "미팅 일정과 조율"],
              ["collaboration", "공동연구 변경"],
            ].map(([id, label]) => (
              <label key={id}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={prefs[id] !== false}
                  onChange={(e) =>
                    setPrefs({ ...prefs, [id]: e.target.checked })
                  }
                />
              </label>
            ))}
          </div>
        )}
        {error && (
          <p className="rms-error" role="alert">
            {error}
          </p>
        )}
        <div className="bottom-actions">
          <Button disabled={busy}>{busy ? "저장 중" : "설정 저장"}</Button>
        </div>
      </form>
    </section>
  );
}
export function ResearchSettingsPage() {
  const { researchId = "" } = useParams(),
    navigate = useNavigate(),
    w = useExperience(),
    { data, user, saveResearch } = w,
    [params, setParams] = useSearchParams(),
    tab = params.get("tab") ?? "basic",
    research = data.researches.find((r) => r.id === researchId);
  const [name, setName] = useState(research?.name ?? ""),
    [description, setDescription] = useState(research?.description ?? ""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmAction, setConfirmAction] = useState<
      "archive" | "trash" | "restore" | null
    >(null);
  const base = useRef(research);
  useEffect(() => {
    base.current = research;
    setName(research?.name ?? "");
    setDescription(research?.description ?? "");
  }, [researchId]);
  const dirty =
      !!research &&
      (name !== research.name || description !== research.description),
    guard = useNavigationGuard({ dirty, busy, label: "연구 설정" });
  if (!research)
    return (
      <p>
        이 연구에 접근할 수 없습니다. <Link to="/r">모든 연구</Link>
      </p>
    );
  const owner = research.ownerId === user.id,
    members = data.members.filter((m) => m.researchId === researchId);
  async function perform(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-page">
      <div className="settings-heading">
        <h1>연구 설정</h1>
        <p>{research.name}</p>
      </div>
      <div className="settings-layout">
        <nav aria-label="연구 설정 항목">
          {[
            ["basic", "file", "기본 정보"],
            ["members", "users", "참여자"],
            ["phases", "chart", "연구 단계"],
            ["lifecycle", "folder", "보관 및 삭제"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                if (dirty) {
                  toast.info("변경한 내용을 저장하거나 취소해 주세요.");
                  return;
                }
                setError("");
                setParams({ tab: id });
              }}
            >
              <Icon name={icon} size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {error && tab !== "members" && (
            <p className="rms-error" role="alert">
              {error}
            </p>
          )}
          {tab === "basic" ? (
            <section className="settings-section">
              <h2>기본 정보</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    const saved = await saveResearch({
                      ...base.current!,
                      name: name.trim(),
                      description: description.trim(),
                    });
                    base.current = saved;
                    setName(saved.name);
                    setDescription(saved.description);
                    guard.clear();
                    toast.success("연구 정보를 저장했습니다.");
                  });
                }}
              >
                <label className="field">
                  연구 이름
                  <input
                    className="rms-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    required
                  />
                </label>
                <label className="field">
                  설명 <small>선택</small>
                  <textarea
                    className="rms-input"
                    rows={5}
                    value={description}
                    maxLength={3000}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <div className="bottom-actions">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      base.current = research;
                      setName(research.name);
                      setDescription(research.description);
                    }}
                  >
                    변경 취소
                  </Button>
                  <Button disabled={busy || !name.trim() || !dirty}>
                    {busy ? "저장 중" : "변경사항 저장"}
                  </Button>
                </div>
              </form>
            </section>
          ) : tab === "members" ? (
            <section className="settings-section">
              <h2>연구 참여자</h2>
              <p>
                공동 기록을 함께 편집합니다. 개인 메모·AI 대화·미채택 제안은
                공개되지 않습니다.
              </p>
              <div className="member-list">
                {members.map((m) => (
                  <div key={m.userId} className="member-row">
                    <span className="avatar">{m.name.slice(0, 1)}</span>
                    <div>
                      <strong>{m.name}</strong>
                      <small>{m.email}</small>
                    </div>
                    <span className="rms-pill">
                      {m.role === "owner"
                        ? "소유자"
                        : m.status === "pending"
                          ? "초대 중"
                          : "편집자"}
                    </span>
                    {owner && m.userId !== user.id && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `${m.name}님의 연구 접근을 해제할까요? 작성한 공동 기록은 남습니다.`,
                            )
                          )
                            void perform(() =>
                              w.action("rms_member_action", {
                                researchId,
                                action: "remove",
                                userId: m.userId,
                              }),
                            );
                        }}
                      >
                        해제
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {owner && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      await w.action("rms_member_action", {
                        researchId,
                        action: "invite",
                        email: email.trim(),
                      });
                      setEmail("");
                      toast.success(
                        "초대했습니다. 상대방이 수락하면 참여합니다.",
                      );
                    });
                  }}
                >
                  <label className="field">
                    공동연구자 이메일
                    <input
                      type="email"
                      className="rms-input"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-describedby={error ? "invite-error" : undefined}
                      placeholder="동료의 계정 이메일"
                    />
                  </label>
                  <p className="settings-note">
                    {error && (
                      <span
                        id="invite-error"
                        role="alert"
                        className="form-error"
                      >
                        {error}
                      </span>
                    )}
                    등록된 계정만 초대할 수 있습니다. 편집자도 지정 교수에게
                    검토를 공개할 수 있습니다.
                  </p>
                  <div className="bottom-actions">
                    <Button disabled={busy || !email.trim()}>
                      연구에 초대
                    </Button>
                  </div>
                </form>
              )}
            </section>
          ) : tab === "phases" ? (
            <section className="settings-section">
              <h2>연구 단계</h2>
              <p>
                연구에 맞게 단계 이름·순서·현재 위치를 변경하세요. 단계 변경으로
                작업 기한은 바뀌지 않습니다.
              </p>
              <div className="settings-list">
                {data.phases
                  .filter((p) => p.researchId === researchId && !p.archivedAt)
                  .sort((a, b) => a.order - b.order)
                  .map((p) => (
                    <div key={p.id}>
                      <strong>{p.title}</strong>
                      <span>
                        {research.currentPhaseId === p.id
                          ? "현재 단계"
                          : p.status === "done"
                            ? "완료"
                            : "예정"}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="bottom-actions">
                <Button asChild>
                  <Link to={`/r/${researchId}/planning`}>
                    단계와 마일스톤 편집
                  </Link>
                </Button>
              </div>
            </section>
          ) : (
            <section className="settings-section">
              <h2>보관 및 삭제</h2>
              <section className="lifecycle-block">
                <h3>보관함</h3>
                <p>
                  진행 중인 목록에서 숨깁니다. 공동 기록과 기존 교수 검토 접근은
                  유지됩니다.
                </p>
                <Button
                  variant="outline"
                  disabled={!owner || busy}
                  onClick={() =>
                    setConfirmAction(
                      research.archivedAt ? "restore" : "archive",
                    )
                  }
                >
                  {research.archivedAt ? "진행 중으로 복원" : "보관함으로 이동"}
                </Button>
              </section>
              <section className="lifecycle-block danger-zone">
                <h3>연구 삭제</h3>
                <p>
                  휴지통으로 이동하고 공동연구자와 교수의 접근을 중지합니다.
                  소유자는 언제든 복원할 수 있으며, 자동으로 영구 삭제하지
                  않습니다.
                </p>
                <Button
                  variant="destructive"
                  disabled={!owner || busy}
                  onClick={() => setConfirmAction("trash")}
                >
                  휴지통으로 이동
                </Button>
                {!owner && (
                  <p className="settings-note">
                    연구 소유자만 보관하거나 삭제할 수 있습니다.
                  </p>
                )}
              </section>
            </section>
          )}
        </div>
      </div>
      <Dialog
        open={!!confirmAction}
        onOpenChange={(v) => !v && !busy && setConfirmAction(null)}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "trash"
                ? "연구를 휴지통으로 옮길까요?"
                : confirmAction === "archive"
                  ? "연구를 보관할까요?"
                  : "연구를 복원할까요?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "trash"
                ? "공동연구자와 교수는 더 이상 접근할 수 없습니다. 기록은 휴지통에서 복원할 수 있습니다."
                : "연구 기록과 파일을 유지합니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="bottom-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmAction(null)}
            >
              취소
            </Button>
            <Button
              variant={confirmAction === "trash" ? "destructive" : "default"}
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await saveResearch({
                    ...research,
                    archivedAt:
                      confirmAction === "archive"
                        ? new Date().toISOString()
                        : undefined,
                    deletedAt:
                      confirmAction === "trash"
                        ? new Date().toISOString()
                        : undefined,
                  });
                  guard.clear();
                  navigate(
                    confirmAction === "trash"
                      ? "/r?view=trash"
                      : confirmAction === "archive"
                        ? "/r?view=archived"
                        : "/r",
                  );
                })
              }
            >
              {busy
                ? "처리 중"
                : confirmAction === "trash"
                  ? "휴지통으로 이동"
                  : confirmAction === "archive"
                    ? "보관"
                    : "복원"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PasswordSettings() {
  const { user, mode } = useWorkspace();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  return (
    <section className="password-settings">
      <h3>비밀번호 변경</h3>
      <p>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          setSuccess(false);
          if (next.length < 8) {
            setError("새 비밀번호는 8자 이상으로 입력해 주세요.");
            return;
          }
          if (next !== confirmation) {
            setError("새 비밀번호가 서로 다릅니다.");
            return;
          }
          if (current === next) {
            setError("현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
            return;
          }
          setBusy(true);
          try {
            if (mode !== "connected")
              throw new Error("로그인한 계정에서 변경할 수 있습니다.");
            await changeAccountPassword(user, current, next, confirmation);
            setCurrent("");
            setNext("");
            setConfirmation("");
            setSuccess(true);
          } catch (e) {
            setError(friendlyError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          현재 비밀번호
          <input
            className="rms-input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label className="field">
          새 비밀번호
          <input
            className="rms-input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
            disabled={busy}
          />
          <small>{PASSWORD_HELP}</small>
        </label>
        <label className="field">
          새 비밀번호 확인
          <input
            className="rms-input"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {success && <p role="status">비밀번호를 변경했습니다.</p>}
        <div className="settings-form-actions">
          <Button
            type="submit"
            disabled={busy || !current || !next || !confirmation}
          >
            {busy ? "변경 중" : "비밀번호 변경"}
          </Button>
        </div>
      </form>
    </section>
  );
}
