import { LanguageSwitch } from "@/components/LanguageSwitch";
import { t, tc } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH, PASSWORD_HELP } from "../lib/password-policy";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  reviewDepthOptions,
  resolveReviewDepth,
  reviewDepthHints,
  researchModelLabel,
} from "@/lib/assistant-presentation";
import { useEffect, useId, useRef, useState } from "react";
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
import { HourStyleSwitch } from "@/components/HourStyleSwitch";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { AdvisorSettings } from "./settings/AdvisorSettings";
import { ProjectInvites } from "./settings/ProjectInvites";
import {
  PURPOSE_MAX,
  parseQuestions,
  questionsText,
} from "@/lib/research-direction";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@montage-ui/core";
export function UsageDetails() {
  const { mode } = useWorkspace();
  const usage = useAIUsage();
  return (
    <section className="settings-section">
      <h2>{t("AI 사용량")}</h2>
      <p>{t("최근 24시간 동안의 실행 요청 수예요.")}</p>
      <div className="usage-summary">
        <div>
          <span>{t("실행 요청")}</span>
          <strong>
            {usage.data?.total ?? "—"}
            <small>
              {" "}
              / {t("{limit}회", { limit: usage.data?.limit ?? 100 })}
            </small>
          </strong>
        </div>
        <div>
          <span>{t("성공")}</span>
          <strong>{usage.data?.complete ?? "—"}</strong>
        </div>
        <div>
          <span>{t("실패")}</span>
          <strong>{usage.data?.failed ?? "—"}</strong>
        </div>
      </div>
      {usage.data && (
        <progress
          className="usage-progress"
          max={usage.data.limit}
          value={usage.data.total}
          aria-label={t("최근 24시간 AI 사용량")}
        />
      )}
      <p className="settings-note">
        {t("실행 요청에는 실행 중이거나 중단한 실행도 포함돼요.")}
      </p>
      {mode === "preview" ? (
        <p className="inline-notice">
          {t("미리보기에서는 AI를 실행할 수 없어 사용량을 세지 않아요.")}
        </p>
      ) : usage.isError ? (
        <div className="inline-notice" role="alert">
          {t("사용량을 불러오지 못했어요.")}{" "}
          <Button variant="link" onClick={() => usage.refetch()}>
            {t("다시 불러오기")}
          </Button>
        </div>
      ) : usage.isPending ? (
        <p role="status">{t("사용량을 불러오는 중")}</p>
      ) : null}
      <div className="settings-list">
        <div>
          <span>{t("사용 범위")}</span>
          <strong>{t("선택한 기록과 질문만")}</strong>
        </div>
        <div>
          <span>{t("실행 제한")}</span>
          <strong>{t("최근 24시간 100회 · 분당 6회")}</strong>
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
    label: t("표시 이름"),
  });
  return (
    <div className="settings-page">
      <div className="settings-heading">
        <h1>{t("계정 설정")}</h1>
      </div>
      <div className="settings-layout">
        <nav aria-label={t("계정 설정 항목")}>
          {[
            ["profile", "user", t("프로필")],
            ["appearance", "sun", t("화면 설정")],
            ["notifications", "bell", t("알림")],
            ["ai", "sparkles", t("AI 기본 설정")],
            ["usage", "chart", t("사용량·플랜")],
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
            <>
              <section className="settings-section">
                <h2>{t("화면 설정")}</h2>
                <p>
                  {t("선택한 테마는 바로 적용되고, 이 브라우저에만 저장돼요.")}
                </p>
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
                  {t(
                    "‘시스템’을 고르면 기기의 라이트·다크 설정을 따라요. 기기에서 ‘동작 줄이기’를 켜면 장식 애니메이션도 줄어요.",
                  )}
                </p>
              </section>
              <section className="settings-section">
                <h2>{t("언어")}</h2>
                <p>
                  {t(
                    t(
                      "화면에 보이는 말을 바꿔요. 이 브라우저에만 저장되고, 고르면 화면을 새로 불러와요.",
                    ),
                  )}
                </p>
                <LanguageSwitch />
                <p className="settings-note">
                  {t(
                    t(
                      "적어 둔 기록과 교수님 응답은 번역하지 않고 쓴 그대로 보여 줘요.",
                    ),
                  )}
                </p>
              </section>
              <section className="settings-section">
                <h2>{t("시각 표기")}</h2>
                <p>
                  {t(
                    "미팅 시각과 기록 시각, 시각 입력 칸에 함께 적용되고, 이 브라우저에만 저장돼요.",
                  )}
                </p>
                <HourStyleSwitch />
                <p className="settings-note">
                  {t(
                    "기본은 24시간제예요. ‘기기 설정 따르기’는 브라우저가 알려 주는 값을 써서, 기기 설정과 다르게 보일 수 있어요.",
                  )}
                </p>
              </section>
            </>
          ) : (
            <section className="settings-section">
              <div className="profile-heading">
                <span className="avatar profile-avatar">
                  {user.name.slice(0, 1)}
                </span>
                <div>
                  <h2>{t("내 프로필")}</h2>
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
                      toast.info(t("미리보기에서는 이름을 저장할 수 없어요."));
                      return;
                    }
                    const { error } = await assertConnected().auth.updateUser({
                      data: { name: name.trim() },
                    });
                    if (error) throw error;
                    guard.clear();
                    toast.success(t("표시 이름을 저장했어요."));
                  } catch (e) {
                    toast.error(friendlyError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="field">
                  {t("표시 이름")}
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    required
                  />
                </label>
                <label className="field">
                  {t("로그인 이메일")}
                  <Input value={user.email} readOnly />
                  <small>{t("로그인 이메일은 여기서 바꿀 수 없어요.")}</small>
                </label>
                <div className="settings-form-actions">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => setName(user.name)}
                  >
                    {t("변경 취소")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy || name.trim() === user.name}
                  >
                    {busy ? t("저장 중") : t("저장")}
                  </Button>
                </div>
              </form>
              <PasswordSettings />
              <div className="settings-security">
                <Icon name="lock" size={21} />
                <p>
                  {t(
                    "이름을 바꿔도 연구 소유권과 교수 검토 권한은 그대로예요.",
                  )}
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
    String(prefs.thinking ?? "high"),
  );
  return (
    <section className="settings-section">
      <h2>{kind === "ai" ? t("AI 기본 설정") : t("알림 설정")}</h2>
      <p>
        {kind === "ai"
          ? t(
              "AI를 실행할 때마다 사용할 기록을 확인해요. 기본값을 바꿔도 AI가 자동으로 실행되지 않아요.",
            )
          : t(
              "마진 안에서 받을 알림을 선택하세요. 이메일이나 브라우저 알림은 보내지 않아요.",
            )}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (mode === "preview")
              throw new Error(t("미리보기에서는 설정을 저장할 수 없어요."));
            if (kind === "ai" && !selectedModel)
              throw new Error(t("모델 목록을 불러온 뒤 다시 저장해 주세요."));
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
            toast.success(t("설정을 저장했어요."));
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
              {t("기본 모델")}
              <Choice
                value={selectedModel?.id ?? ""}
                label={t("기본 모델")}
                disabled={!caps.data}
                onChange={(v) =>
                  setPrefs({
                    ...prefs,
                    model: v,
                    thinking: resolveReviewDepth(
                      caps.data?.models.find((m) => m.id === v)?.thinking ?? [],
                      String(prefs.thinking ?? "high"),
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
                      label:
                        mode === "preview"
                          ? t("미리보기에서는 고를 수 없어요")
                          : caps.isError
                            ? t("모델을 불러오지 못했어요")
                            : t("모델 불러오는 중"),
                    },
                  ]
                }
              />
            </label>
            {!!selectedModel?.thinking.length && (
              <label className="field">
                {t("기본 답변 깊이")}
                <Choice
                  value={selectedDepth}
                  label={t("기본 답변 깊이")}
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
                {t("모델 다시 불러오기")}
              </Button>
            )}
          </>
        ) : (
          <div className="preferences-list">
            {[
              ["review", t("검토 요청·응답·댓글")],
              ["assignment", t("할 일 변경")],
              ["schedule", t("미팅 일정과 조율")],
              ["collaboration", t("공동연구 변경")],
            ].map(([id, label]) => (
              <label key={id}>
                <span>{label}</span>
                <Switch
                  checked={prefs[id] !== false}
                  onCheckedChange={(next) => setPrefs({ ...prefs, [id]: next })}
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
          <Button type="submit" disabled={busy}>
            {busy ? t("저장 중") : t("저장")}
          </Button>
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
    [purpose, setPurpose] = useState(research?.purpose ?? ""),
    [questions, setQuestions] = useState(questionsText(research?.questions)),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmAction, setConfirmAction] = useState<
      "archive" | "trash" | "restore" | null
    >(null);
  const base = useRef(research);
  const [confirmDialog, confirm] = useConfirm();
  // 이름을 비우면 저장 버튼만 꺼지지 않고 이유를 칸 아래에 알려 줍니다(QA F-005).
  const nameErrorId = useId();
  const nameBlank = !name.trim();
  useEffect(() => {
    base.current = research;
    setName(research?.name ?? "");
    setDescription(research?.description ?? "");
    setPurpose(research?.purpose ?? "");
    setQuestions(questionsText(research?.questions));
  }, [researchId]);
  const dirty =
      !!research &&
      (name !== research.name ||
        description !== research.description ||
        purpose !== (research.purpose ?? "") ||
        questions !== questionsText(research.questions)),
    guard = useNavigationGuard({ dirty, busy, label: t("연구 기본 정보") });
  if (!research)
    return (
      <p>
        {t("이 연구를 열 수 없어요.")}{" "}
        <Link to="/r">{t("내 연구로 돌아가기")}</Link>
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
      {confirmDialog}
      <div className="settings-heading">
        <h1>{t("연구 설정")}</h1>
        <p>{research.name}</p>
      </div>
      <div className="settings-layout">
        <nav aria-label={t("연구 설정 항목")}>
          {[
            ["basic", "file", t("기본 정보")],
            ["members", "users", t("공동연구자")],
            ["phases", "chart", t("연구 단계")],
            ["lifecycle", "folder", t("보관·삭제")],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                if (dirty) {
                  toast.info(t("바꾼 내용을 먼저 저장하거나 취소해 주세요."));
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
            <>
              <section className="settings-section">
                <h2>{t("기본 정보")}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      const saved = await saveResearch({
                        ...base.current!,
                        name: name.trim(),
                        description: description.trim(),
                        purpose: purpose.trim() || undefined,
                        questions: parseQuestions(questions),
                      });
                      base.current = saved;
                      setName(saved.name);
                      setDescription(saved.description);
                      setPurpose(saved.purpose ?? "");
                      setQuestions(questionsText(saved.questions));
                      guard.clear();
                      toast.success(t("연구 정보를 저장했어요."));
                    });
                  }}
                >
                  <label className="field">
                    {t("연구 이름")}
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={120}
                      required
                      aria-invalid={nameBlank || undefined}
                      aria-describedby={nameBlank ? nameErrorId : undefined}
                    />
                    {nameBlank && (
                      <small
                        id={nameErrorId}
                        className="field-error"
                        role="alert"
                      >
                        {t("연구 이름을 입력해 주세요.")}
                      </small>
                    )}
                  </label>
                  <label className="field">
                    {t("설명")} <small>{tc("optional", "선택")}</small>
                    <Textarea
                      rows={5}
                      value={description}
                      maxLength={3000}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    {t("연구 목적")} <small>{tc("optional", "선택")}</small>
                    <Textarea
                      rows={3}
                      value={purpose}
                      maxLength={PURPOSE_MAX}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder={t(
                        "이 연구로 무엇을 밝히려 하는지 한두 문장으로 적어요.",
                      )}
                    />
                  </label>
                  <label className="field">
                    {t("연구 질문")}{" "}
                    <small>{t("선택 · 한 줄에 하나씩, 5개까지")}</small>
                    <Textarea
                      rows={4}
                      value={questions}
                      onChange={(e) => setQuestions(e.target.value)}
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
                        setPurpose(research.purpose ?? "");
                        setQuestions(questionsText(research.questions));
                      }}
                    >
                      {t("변경 취소")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={busy || !name.trim() || !dirty}
                    >
                      {busy ? t("저장 중") : t("저장")}
                    </Button>
                  </div>
                </form>
              </section>
              <AdvisorSettings
                emails={research.advisorEmails ?? []}
                canEdit={
                  owner ||
                  members.some(
                    (m) => m.userId === user.id && m.status === "active",
                  )
                }
                busy={busy}
                onSave={(emails) =>
                  perform(async () => {
                    // 기본 정보 폼과 같은 기준값을 써서 서로 덮어쓰지 않게 합니다.
                    base.current = await saveResearch({
                      ...base.current!,
                      advisorEmails: emails,
                    });
                    toast.success(t("지도교수 목록을 저장했어요."));
                  })
                }
              />
            </>
          ) : tab === "members" ? (
            <section className="settings-section">
              <h2>{t("공동연구자")}</h2>
              <p>
                {t(
                  "참여자는 공동 기록을 함께 보고 편집할 수 있어요. ‘나만 보기’로 둔 기록, 개인 메모, AI 대화, 선택하지 않은 AI 제안은 다른 참여자에게 보이지 않아요.",
                )}
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
                        ? t("소유자")
                        : m.status === "pending"
                          ? t("수락 대기")
                          : t("편집자")}
                    </span>
                    {owner && m.userId !== user.id && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await confirm({
                              title:
                                m.status === "pending"
                                  ? t("{name}님의 초대를 취소할까요?", {
                                      name: m.name,
                                    })
                                  : t(
                                      "{name}님의 연구 접근을 해제할까요? 작성한 공동 기록은 그대로 남아요.",
                                      { name: m.name },
                                    ),
                              confirmLabel:
                                m.status === "pending"
                                  ? t("초대 취소")
                                  : t("접근 해제"),
                              destructive: true,
                            })
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
                        {m.status === "pending"
                          ? t("초대 취소")
                          : t("접근 해제")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {w.mode === "connected" ? (
                <ProjectInvites
                  researchId={researchId}
                  canInviteEditor={owner}
                  canInviteAdvisor={
                    owner ||
                    members.some(
                      (m) => m.userId === user.id && m.status === "active",
                    )
                  }
                />
              ) : (
                owner && (
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
                          t(
                            "초대했어요. 상대방이 수락하면 공동연구에 참여해요.",
                          ),
                        );
                      });
                    }}
                  >
                    <label className="field">
                      {t("공동연구자 이메일")}
                      <Input
                        type="email"

                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-describedby={error ? "invite-error" : undefined}
                        placeholder={t("예: name@example.com")}
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
                      {t(
                        "발급받은 마진 계정이 있는 사람만 초대할 수 있어요. 편집자도 검토 요청을 만들어 수정 결과를 교수님께 공유할 수 있어요.",
                      )}
                    </p>
                    <div className="bottom-actions">
                      <Button type="submit" disabled={busy || !email.trim()}>
                        {t("초대하기")}
                      </Button>
                    </div>
                  </form>
                )
              )}
            </section>
          ) : tab === "phases" ? (
            <section className="settings-section">
              <h2>{t("연구 단계")}</h2>
              <p>
                {t(
                  "단계 이름, 순서, 현재 단계는 계획·일정에서 바꿀 수 있어요. 단계를 바꿔도 할 일 기한은 그대로예요.",
                )}
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
                          ? t("현재 단계")
                          : p.status === "done"
                            ? t("완료")
                            : p.status === "active"
                              ? t("진행 중")
                              : t("예정")}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="bottom-actions">
                <Button asChild>
                  <Link to={`/r/${researchId}/planning`}>
                    {t("단계와 주요 목표 편집")}
                  </Link>
                </Button>
              </div>
            </section>
          ) : (
            <section className="settings-section">
              <h2>{t("보관·삭제")}</h2>
              <section className="lifecycle-block">
                <h3>{t("연구 보관")}</h3>
                <p>
                  {t(
                    "진행 중인 연구 목록에서 숨겨요. 기록, 공동연구자의 접근, 공유 중인 검토 요청은 그대로예요.",
                  )}
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
                  {research.archivedAt ? t("연구 복원") : t("연구 보관")}
                </Button>
              </section>
              <section className="lifecycle-block danger-zone">
                <h3>{t("휴지통으로 옮기기")}</h3>
                <p>
                  {t(
                    "휴지통으로 옮기면 공동연구자가 이 연구에 접근할 수 없고, 공유 중인 검토 요청이 중지돼 교수님도 볼 수 없어요. 소유자는 휴지통에서 언제든 복원할 수 있고, 자동으로 완전히 삭제되지 않아요.",
                  )}
                </p>
                <Button
                  variant="destructive"
                  disabled={!owner || busy}
                  onClick={() => setConfirmAction("trash")}
                >
                  {t("휴지통으로 옮기기")}
                </Button>
                {!owner && (
                  <p className="settings-note">
                    {t("연구 소유자만 보관하거나 휴지통으로 옮길 수 있어요.")}
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
                ? t("연구를 휴지통으로 옮길까요?")
                : confirmAction === "archive"
                  ? t("연구를 보관할까요?")
                  : t("연구를 복원할까요?")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "trash"
                ? t(
                    "공동연구자가 이 연구에 접근할 수 없고, 공유 중인 검토 요청이 중지돼 교수님도 볼 수 없어요. 휴지통에서 복원할 수 있지만, 검토 요청 공유는 자동으로 다시 시작되지 않아요.",
                  )
                : confirmAction === "archive"
                  ? t(
                      "진행 중인 연구 목록에서 숨겨요. 기록, 공동연구자의 접근, 공유 중인 검토 요청은 그대로이고, 보관함에서 복원할 수 있어요.",
                    )
                  : t("진행 중인 연구 목록에 다시 보여요.")}
            </DialogDescription>
          </DialogHeader>
          <div className="bottom-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmAction(null)}
            >
              {t("취소")}
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
              {confirmAction === "trash"
                ? busy
                  ? t("옮기는 중")
                  : t("휴지통으로 옮기기")
                : confirmAction === "archive"
                  ? busy
                    ? t("보관하는 중")
                    : t("보관")
                  : busy
                    ? t("복원하는 중")
                    : t("복원")}
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
      <h3>{t("비밀번호 변경")}</h3>
      <p>{t("현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿔요.")}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          setSuccess(false);
          if (next.length < 8) {
            setError(t("새 비밀번호는 8자 이상으로 입력해 주세요."));
            return;
          }
          if (next !== confirmation) {
            setError(t("새 비밀번호 확인이 일치하지 않아요."));
            return;
          }
          if (current === next) {
            setError(t("현재 비밀번호와 다른 비밀번호를 입력해 주세요."));
            return;
          }
          setBusy(true);
          try {
            if (mode !== "connected")
              throw new Error(t("미리보기에서는 비밀번호를 바꿀 수 없어요."));
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
          {t("현재 비밀번호")}
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label className="field">
          {t("새 비밀번호")}
          <Input
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
          {t("새 비밀번호 확인")}
          <Input
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
        {success && <p role="status">{t("비밀번호를 바꿨어요.")}</p>}
        <div className="settings-form-actions">
          <Button
            type="submit"
            disabled={busy || !current || !next || !confirmation}
          >
            {busy ? t("변경 중") : t("비밀번호 변경")}
          </Button>
        </div>
      </form>
    </section>
  );
}
