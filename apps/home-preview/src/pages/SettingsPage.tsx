import { LanguageSwitch } from "@/components/LanguageSwitch";
import { t, tc, dateLocale } from "@/lib/i18n";
import { DateField } from "@/components/ui/date-field";
import { submissionDateProblem, todayKey } from "@/lib/roadmap-plan";
import { MIN_PASSWORD_LENGTH, PASSWORD_HELP } from "../lib/password-policy";
import { PasswordStrength } from "@/components/PasswordStrength";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { useAIUsage, MONTHLY_AI_CREDITS, formatCredits } from "@/lib/ai-usage";
import {
  AI_SETTINGS_SCOPE_NOTE,
  AI_USAGE_SCOPE_SUMMARY,
} from "@/lib/ai-execution-policy";
import { AIModelSelector } from "@/components/ai/AIModelSelector";
import { useExperience } from "@/lib/experience";
import { useAICapabilities, resolveAISelection } from "@/lib/ai-capabilities";
import { ThemeSwitch } from "./AuthPages";
import { HourStyleSwitch } from "@/components/HourStyleSwitch";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { useConfirm } from "@/components/ConfirmDialog";
import { AdvisorSettings } from "./settings/AdvisorSettings";
import { ProjectInvites } from "./settings/ProjectInvites";
import { ResearchProfileFields } from "./settings/ResearchProfileFields";
import { usePreferences } from "./settings/use-preferences";
import { AgentSettings } from "./settings/AgentSettings";
import { SoundSetting } from "./settings/SoundSetting";
import { PanelSideSetting } from "./settings/PanelSideSetting";
import { UsageMeters } from "./settings/UsageMeters";
import "./settings/account-settings.css";
import {
  NO_CITATION_STYLE,
  addKeyword,
  readCitationStyle,
  readKeywords,
  sameKeywords,
} from "@/lib/research-profile";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@montage-ui/core";
import {
  DisabledReason,
  PageHeader,
  StatusBadge,
  useDisabledReason,
} from "@/components/common";
/** 좁은 화면에서 설정 메뉴가 가로로 넘칠 때, 지금 항목이 가려져 있으면 보이는 곳으로 옮깁니다. */
function showCurrentItem(item: HTMLButtonElement | null) {
  const nav = item?.parentElement;
  if (!item || !nav) return;
  const box = nav.getBoundingClientRect();
  const own = item.getBoundingClientRect();
  // 페이지 세로 위치는 건드리지 않고 메뉴 줄만 가로로 옮겨요.
  if (own.right > box.right) nav.scrollLeft += own.right - box.right;
  else if (own.left < box.left) nav.scrollLeft -= box.left - own.left;
}
export function UsageDetails() {
  const { mode } = useWorkspace();
  const usage = useAIUsage();
  const credits = usage.isError ? undefined : usage.data?.credits;
  const amount = (value: number | undefined) =>
    value === undefined ? "—" : formatCredits(value);
  const date = (value: string) =>
    Number.isNaN(Date.parse(value))
      ? "—"
      : new Date(value).toLocaleString(dateLocale());
  const kinds: Record<string, string> = {
    grant: t("크레딧 지급"),
    allowance: t("월 지급"),
    monthly_grant: t("크레딧 지급"),
    reserve: t("사용 예약"),
    reservation: t("사용 예약"),
    release: t("예약 해제"),
    refund: t("환급"),
    usage: t("실제 사용"),
    charge: t("실제 사용"),
    debit: t("실제 사용"),
    settle: t("실제 사용"),
    settlement: t("실제 사용"),
  };
  return (
    <section className="settings-section">
      <h2>{t("내 AI 크레딧")}</h2>
      <p>
        {t("개인 계정에 매월 20,000크레딧을 지급해요. 1크레딧은 $0.001이에요.")}
      </p>
      <div className="usage-summary">
        <div>
          <span>{t("남은 크레딧")}</span>
          <strong>{amount(credits?.balance)}</strong>
        </div>
        <div>
          <span>{t("이번 달 실제 사용")}</span>
          <strong>{amount(credits?.used)}</strong>
        </div>
        <div>
          <span>{t("사용 예약 중")}</span>
          <strong>{amount(credits?.reserved)}</strong>
        </div>
      </div>
      {credits && (
        <progress
          className="usage-progress"
          max={credits.allowance}
          value={Math.min(credits.allowance, Math.max(0, credits.used))}
          aria-label={t("이번 달 크레딧 사용량")}
        />
      )}
      <p className="settings-note">
        {t(
          "실제 입력·출력 토큰과 모델 단가로 서버에서 정산해요. 사용 예약은 확정 사용량이 아니에요.",
        )}
      </p>
      {mode === "preview" ? (
        <p className="inline-notice">
          {t("미리보기에서는 크레딧 잔액과 이력을 만들지 않아요.")}
        </p>
      ) : usage.isError ? (
        <div className="inline-notice" role="alert">
          {t("크레딧 정보를 불러오지 못했어요.")}{" "}
          <Button variant="link" onClick={() => usage.refetch()}>
            {t("다시 불러오기")}
          </Button>
        </div>
      ) : usage.isPending ? (
        <p role="status">{t("사용량을 불러오는 중")}</p>
      ) : !credits ? (
        <p className="inline-notice">
          {t("서버에서 크레딧 정보를 아직 제공하지 않아요.")}
        </p>
      ) : null}
      <div className="settings-list">
        <div>
          <span>{t("월 지급 크레딧")}</span>
          <strong>
            {formatCredits(credits?.allowance ?? MONTHLY_AI_CREDITS)}
          </strong>
        </div>
        <div>
          <span>{t("다음 지급일")}</span>
          <strong>{credits?.resetsAt ? date(credits.resetsAt) : "—"}</strong>
        </div>
        <div>
          <span>{t("사용 범위")}</span>
          <strong>{AI_USAGE_SCOPE_SUMMARY()}</strong>
        </div>
      </div>
      <Disclosure summary={t("크레딧 이력")}>
        {credits?.ledger.length ? (
          <ul className="ai-credit-ledger">
            {[...credits.ledger]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{kinds[entry.kind] ?? t("크레딧 조정")}</strong>
                    <small>
                      {date(entry.createdAt)}
                      {entry.model ? ` · ${entry.model}` : ""}
                    </small>
                  </div>
                  <strong>
                    {t("{amount}크레딧", {
                      amount: `${entry.amount > 0 ? "+" : ""}${formatCredits(entry.amount)}`,
                    })}
                  </strong>
                </li>
              ))}
          </ul>
        ) : (
          <p className="settings-note">
            {credits
              ? t("아직 크레딧 이력이 없어요.")
              : t("크레딧 정보는 서버 연결 후 표시돼요.")}
          </p>
        )}
      </Disclosure>
    </section>
  );
}
/** 설정 창(IA v2 07 §1) 안에 넣을 때 쓰는 값. 넣으면 제목·왼쪽 탭을 그리지 않고 구획은 밖에서 받습니다. */
export interface EmbeddedSettingsProps {
  embedded?: boolean;
  /** 지금 화면의 `tab=` 값과 같은 이름 */
  section?: string;
}
export function AccountPage({ embedded, section }: EmbeddedSettingsProps = {}) {
  const { user, mode } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const tab = (embedded ? section : params.get("tab")) ?? "profile";
  const [name, setName] = useState(user.name),
    [busy, setBusy] = useState(false);
  useEffect(() => setName(user.name), [user.name]);
  const guard = useNavigationGuard({
    dirty: tab === "profile" && name.trim() !== user.name,
    busy,
    label: t("표시 이름"),
  });
  // 빈 이름은 required가 막으므로 바뀐 것이 없을 때만 이유를 보여요.
  const nameReason = useDisabledReason(
    !busy && name.trim() === user.name && t("바뀐 내용이 없어요."),
  );
  return (
    <div className={`settings-page ${embedded ? "settings-embedded" : ""}`}>
      {!embedded && <PageHeader title={t("계정 설정")} />}
      <div className="settings-layout">
        <nav aria-label={t("계정 설정 항목")} hidden={embedded}>
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
              ref={tab === id ? showCurrentItem : undefined}
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
              <UsageMeters />
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
                    "화면에 보이는 말을 바꿔요. 이 브라우저에만 저장되고, 고르면 화면을 새로 불러와요.",
                  )}
                </p>
                <LanguageSwitch />
                <p className="settings-note">
                  {t(
                    "적어 둔 기록과 교수님 응답은 번역하지 않고 쓴 그대로 보여 줘요.",
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
              <SoundSetting />
              <PanelSideSetting />
            </>
          ) : (
            <section className="settings-section">
              <div className="profile-heading">
                <span className="avatar profile-avatar">
                  {user.name.slice(0, 1)}
                </span>
                <div>
                  <div className="profile-heading-title">
                    <h2>{t("내 프로필")}</h2>
                    <StatusBadge tone={mode === "preview" ? "neutral" : "blue"}>
                      {mode === "preview" ? t("미리보기") : t("연결됨")}
                    </StatusBadge>
                  </div>
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
                  <small className="field-hint">
                    {t("로그인 이메일은 여기서 바꿀 수 없어요.")}
                  </small>
                </label>
                <div className="settings-form-actions">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => setName(user.name)}
                  >
                    {t("취소")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy || name.trim() === user.name}
                    aria-describedby={nameReason.describedBy}
                  >
                    {busy ? t("저장 중") : t("저장")}
                  </Button>
                </div>
                {nameReason.node}
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
    preferences = usePreferences(),
    { prefs, setPrefs, persist, busy, error, setError } = preferences;
  const selection = resolveAISelection(
    caps.isError ? [] : caps.data?.models,
    prefs,
  );
  return (
    <>
      <section className="settings-section">
        <h2>{kind === "ai" ? t("AI 기본 설정") : t("알림 설정")}</h2>
        <p>
          {kind === "ai"
            ? AI_SETTINGS_SCOPE_NOTE()
            : t(
                "마진 안에서 받을 알림을 선택하세요. 이메일이나 브라우저 알림은 보내지 않아요. 스위치를 바꾸면 바로 저장돼요.",
              )}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (kind === "ai" && !selection.model) {
              setError(t("모델 목록을 불러온 뒤 다시 저장해 주세요."));
              return;
            }
            const preferences =
              kind === "ai"
                ? {
                    ...prefs,
                    model: selection.model!,
                    thinking: selection.thinking ?? "",
                  }
                : prefs;
            if (await persist(preferences))
              toast.success(t("설정을 저장했어요."));
          }}
        >
          {kind === "ai" ? (
            <>
              <div className="field">
                <span>{t("기본 모델")}</span>
                <AIModelSelector
                  placement="bottom"
                  models={caps.data?.models ?? []}
                  model={selection.model}
                  thinking={selection.thinking}
                  disabled={busy || mode === "preview"}
                  loading={mode === "connected" && caps.isPending}
                  failed={caps.isError}
                  onChange={(next) => setPrefs({ ...prefs, ...next })}
                />
              </div>
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
                    disabled={busy}
                    onCheckedChange={async (next) => {
                      const before = prefs;
                      const updated = { ...prefs, [id]: next };
                      setPrefs(updated);
                      // 저장에 실패하면 스위치를 원래 자리로 돌려요.
                      if (!(await persist(updated))) setPrefs(before);
                    }}
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
          {kind === "ai" && (
            <div className="bottom-actions">
              <Button type="submit" disabled={busy}>
                {busy ? t("저장 중") : t("저장")}
              </Button>
            </div>
          )}
        </form>
      </section>
      {kind === "ai" && <AgentSettings preferences={preferences} />}
    </>
  );
}
export function ResearchSettingsPage({
  embedded,
  section,
  researchIdOverride,
}: EmbeddedSettingsProps & { researchIdOverride?: string } = {}) {
  const params0 = useParams(),
    researchId = researchIdOverride ?? params0.researchId ?? "",
    navigate = useNavigate(),
    w = useExperience(),
    { data, user, saveResearch } = w,
    [params, setParams] = useSearchParams(),
    tab = (embedded ? section : params.get("tab")) ?? "basic",
    research = data.researches.find((r) => r.id === researchId);
  const [name, setName] = useState(research?.name ?? ""),
    [description, setDescription] = useState(research?.description ?? ""),
    [purpose, setPurpose] = useState(research?.purpose ?? ""),
    [questions, setQuestions] = useState(questionsText(research?.questions)),
    [submission, setSubmission] = useState(research?.submissionDate ?? ""),
    [keywords, setKeywords] = useState(() => readKeywords(research?.keywords)),
    [keywordDraft, setKeywordDraft] = useState(""),
    [citation, setCitation] = useState(
      research?.citationStyle ?? NO_CITATION_STYLE,
    ),
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
  // 꺼진 버튼의 이유 한 줄(감사 B2). 조건은 research를 확인한 뒤에 정합니다.
  const unchangedReasonId = useId(),
    inviteReasonId = useId(),
    ownerReasonId = useId();
  useEffect(() => {
    base.current = research;
    setName(research?.name ?? "");
    setDescription(research?.description ?? "");
    setPurpose(research?.purpose ?? "");
    setQuestions(questionsText(research?.questions));
    setSubmission(research?.submissionDate ?? "");
    setKeywords(readKeywords(research?.keywords));
    setKeywordDraft("");
    setCitation(research?.citationStyle ?? NO_CITATION_STYLE);
  }, [researchId]);
  // 칩이 되기 전 입력도 형식이 맞으면 함께 저장해요(온보딩 지도교수 칸과 같은 방식).
  const keywordList = addKeyword(keywords, keywordDraft);
  const dirty =
      !!research &&
      (name !== research.name ||
        description !== research.description ||
        purpose !== (research.purpose ?? "") ||
        questions !== questionsText(research.questions) ||
        submission !== (research.submissionDate ?? "") ||
        !sameKeywords(keywordList, readKeywords(research.keywords)) ||
        citation !== (research.citationStyle ?? NO_CITATION_STYLE)),
    guard = useNavigationGuard({ dirty, busy, label: t("연구 기본 정보") }),
    // 이미 저장된 날짜가 지났어도 그대로 두면 막지 않아요(바꿀 때만 검사).
    submissionProblem =
      !!submission &&
      submission !== (research?.submissionDate ?? "") &&
      !!submissionDateProblem(todayKey(), submission);
  if (!research)
    return (
      <p>
        {t("이 연구를 열 수 없어요.")}{" "}
        <Link to="/r">{t("내 연구로 돌아가기")}</Link>
      </p>
    );
  const owner = research.ownerId === user.id,
    members = data.members.filter((m) => m.researchId === researchId);
  // 빈 이름은 칸 아래 오류가 알려 주므로 바뀐 것이 없을 때만 보여요.
  const unchangedReason =
      !busy && !nameBlank && !dirty && t("바뀐 내용이 없어요."),
    inviteReason =
      !busy && !email.trim() && t("이메일을 입력하면 초대할 수 있어요."),
    ownerReason =
      !owner && t("연구 소유자만 보관하거나 휴지통으로 옮길 수 있어요.");
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
    <div className={`settings-page ${embedded ? "settings-embedded" : ""}`}>
      {confirmDialog}
      {!embedded && (
        <PageHeader
          title={t("연구 설정")}
          description={research.name}
          meta={
            <>
              <span className="settings-summary-chip">
                {t("현재 단계 · {title}", {
                  title:
                    data.phases.find((p) => p.id === research.currentPhaseId)
                      ?.title ?? t("단계 미지정"),
                })}
              </span>
              <span className="settings-summary-chip">
                {t("지도교수 {count}명", {
                  count: (research.advisorEmails ?? []).length,
                })}
              </span>
              <span className="settings-summary-chip">
                {t("키워드 {count}개", { count: keywords.length })}
              </span>
              {research.submissionDate && (
                <span className="settings-summary-chip">
                  {t("목표일 {date}", { date: research.submissionDate })}
                </span>
              )}
            </>
          }
        />
      )}
      <div className="settings-layout">
        <nav aria-label={t("연구 설정 항목")} hidden={embedded}>
          {[
            ["basic", "file", t("기본 정보")],
            ["members", "users", t("공동연구자")],
            ["phases", "chart", t("연구 단계")],
            ["lifecycle", "folder", t("보관·삭제")],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              ref={tab === id ? showCurrentItem : undefined}
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
                        submissionDate: submission || undefined,
                        keywords: keywordList.length ? keywordList : undefined,
                        citationStyle: readCitationStyle(citation),
                      });
                      base.current = saved;
                      setKeywords(readKeywords(saved.keywords));
                      setKeywordDraft("");
                      setCitation(saved.citationStyle ?? NO_CITATION_STYLE);
                      setName(saved.name);
                      setDescription(saved.description);
                      setPurpose(saved.purpose ?? "");
                      setQuestions(questionsText(saved.questions));
                      setSubmission(saved.submissionDate ?? "");
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
                    <span className="field-label">
                      {t("설명")} <small>{tc("optional", "선택")}</small>
                    </span>
                    <Textarea
                      rows={5}
                      value={description}
                      maxLength={3000}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      {t("연구 목적")} <small>{tc("optional", "선택")}</small>
                    </span>
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
                    <span className="field-label">
                      {t("연구 질문")}{" "}
                      <small>{t("선택 · 한 줄에 하나씩, 5개까지")}</small>
                    </span>
                    <Textarea
                      rows={4}
                      value={questions}
                      onChange={(e) => setQuestions(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      {t("투고·제출 목표일")}{" "}
                      <small>{tc("optional", "선택")}</small>
                    </span>
                    <DateField value={submission} onChange={setSubmission} />
                    <small
                      className={
                        submissionProblem ? "field-error" : "field-hint"
                      }
                    >
                      {submissionProblem
                        ? t("오늘 뒤 5년 안의 날짜만 저장해요.")
                        : t(
                            "연구 홈에 D-Day로 보이고, 로드맵 계획 제안에 미리 채워져요.",
                          )}
                    </small>
                  </label>
                  <ResearchProfileFields
                    keywords={keywords}
                    onKeywordsChange={setKeywords}
                    keywordDraft={keywordDraft}
                    onKeywordDraftChange={setKeywordDraft}
                    citation={citation}
                    onCitationChange={setCitation}
                    disabled={busy}
                  />
                  <div className="bottom-actions">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        base.current = research;
                        setKeywords(readKeywords(research.keywords));
                        setKeywordDraft("");
                        setCitation(
                          research.citationStyle ?? NO_CITATION_STYLE,
                        );
                        setName(research.name);
                        setDescription(research.description);
                        setPurpose(research.purpose ?? "");
                        setQuestions(questionsText(research.questions));
                        setSubmission(research.submissionDate ?? "");
                      }}
                    >
                      {t("취소")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        busy || !name.trim() || !dirty || submissionProblem
                      }
                      aria-describedby={
                        unchangedReason ? unchangedReasonId : undefined
                      }
                    >
                      {busy ? t("저장 중") : t("저장")}
                    </Button>
                  </div>
                  <DisabledReason
                    id={unchangedReasonId}
                    reason={unchangedReason}
                  />
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
                  "공동연구자는 공동 기록을 함께 보고 편집할 수 있어요. ‘나만 보기’로 둔 기록, 개인 메모, AI 대화, 선택하지 않은 AI 제안은 다른 공동연구자에게 보이지 않아요.",
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
                    <StatusBadge
                      tone={
                        m.role === "owner"
                          ? "blue"
                          : m.status === "pending"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {m.role === "owner"
                        ? t("소유자")
                        : m.status === "pending"
                          ? t("수락 대기")
                          : t("편집자")}
                    </StatusBadge>
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
                      <Button
                        type="submit"
                        disabled={busy || !email.trim()}
                        aria-describedby={
                          inviteReason ? inviteReasonId : undefined
                        }
                      >
                        {t("초대하기")}
                      </Button>
                    </div>
                    <DisabledReason id={inviteReasonId} reason={inviteReason} />
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
                  aria-describedby={ownerReason ? ownerReasonId : undefined}
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
                  aria-describedby={ownerReason ? ownerReasonId : undefined}
                  onClick={() => setConfirmAction("trash")}
                >
                  {t("휴지통으로 옮기기")}
                </Button>
                <DisabledReason id={ownerReasonId} reason={ownerReason} />
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
          <DialogFooter>
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
          </DialogFooter>
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
  const passwordReason = useDisabledReason(
    !busy &&
      (!current || !next || !confirmation) &&
      t("세 칸을 모두 입력하면 비밀번호를 바꿀 수 있어요."),
  );
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
          {next ? (
            <PasswordStrength value={next} />
          ) : (
            <small className="field-hint">{PASSWORD_HELP}</small>
          )}
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
            aria-describedby={passwordReason.describedBy}
          >
            {busy ? t("변경 중") : t("비밀번호 변경")}
          </Button>
        </div>
        {passwordReason.node}
      </form>
    </section>
  );
}
