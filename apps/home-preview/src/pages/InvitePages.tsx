import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INVITE_PARAM,
  inviteCodeFrom,
  inviteLink,
  signupProblem,
} from "@/lib/invites";
import { KakaoLoginButton } from "@/components/KakaoLoginButton";
import { MIN_PASSWORD_LENGTH, PASSWORD_HELP } from "@/lib/password-policy";
import { assertConnected, friendlyError } from "@/lib/supabase";
import { PublicFrame } from "./PublicPages";

const NAME_MAX = 40;

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PublicFrame compact>
      <section className="signup-layout">
        <div className="auth-story">
          <h1>
            {t("지난 미팅에서")}
            <br />
            {t("다음 미팅까지")}
          </h1>
          <p>
            {t("피드백, 할 일, 원고 버전, 교수님 응답을")}
            <br />
            {t("연구별로 모아 둬요.")}
          </p>
          <div className="auth-proof">
            <Icon name="lock" size={19} />
            <span>
              {t("공동연구자가 참여하기 전에는 기록을 나만 볼 수 있어요.")}
              <br />
              {t("교수님께는 검토 요청에 넣은 항목과 연구 방향만 보여요.")}
            </span>
          </div>
        </div>
        <div className="auth-panel">{children}</div>
      </section>
    </PublicFrame>
  );
}

/** 초대 링크를 붙여 넣는 칸. 가입 화면과 초대 확인 화면이 같이 씁니다. */
function InviteLinkForm({
  submitLabel,
  onCode,
}: {
  submitLabel: string;
  onCode: (code: string) => void;
}) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const code = inviteCodeFrom(text);
        if (!code) {
          setProblem(t("초대 링크를 다시 확인해 주세요."));
          return;
        }
        setProblem("");
        onCode(code);
      }}
    >
      <label className="field">
        {t("받은 초대 링크")}
        <Input
          required
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setProblem("");
          }}
          placeholder={inviteLink("https://…", t("초대 코드"))}
        />
      </label>
      {problem && (
        <p className="rms-error" role="alert">
          {problem}
        </p>
      )}
      <Button fullWidth size="lg" type="submit">
        {submitLabel}
        <Icon name="arrow-right" size={18} />
      </Button>
    </form>
  );
}

type InviteState = "checking" | "open" | "closed" | "unreachable";

/** 초대 링크로 들어온 사람만 가입할 수 있는 화면(/signup?invite=<코드>). */
export function InviteSignupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = inviteCodeFrom(params.get(INVITE_PARAM));
  // 초대 없이도 가입할 수 있습니다. 초대 링크로 왔을 때만 그 링크가 유효한지 확인합니다.
  const [invite, setInvite] = useState<InviteState>(code ? "checking" : "open");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!code) {
      setInvite("open");
      return;
    }
    let live = true;
    setInvite("checking");
    assertConnected()
      .rpc("rms_check_invite", { p_code: code })
      .then(({ data, error }) => {
        if (!live) return;
        setInvite(error ? "unreachable" : data ? "open" : "closed");
      });
    return () => {
      live = false;
    };
  }, [code]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setProblem("");
    try {
      const { data, error } = await assertConnected().auth.signUp({
        email: email.trim(),
        password,
        options: {
          // 초대 코드는 계정에 실어 두었다가 첫 로그인 때 씁니다(InviteGate).
          data: code
            ? { name: name.trim(), invite: code }
            : { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw new Error(signupProblem(error.message));
      // 이미 가입한 이메일이면 인증 서버가 오류 없이 빈 계정을 돌려줍니다.
      if (data.user && data.user.identities?.length === 0)
        throw new Error(signupProblem("already registered"));
      setPassword("");
      if (data.session) navigate("/r", { replace: true });
      else setSent(true);
    } catch (failure) {
      setProblem(
        failure instanceof Error ? failure.message : signupProblem(""),
      );
    } finally {
      setPending(false);
    }
  }

  if (sent)
    return (
      <AuthLayout>
        <div className="signup-finish" role="status">
          <Icon name="check-circle" size={38} />
          <h2>{t("확인 메일을 보냈어요")}</h2>
          <p>{email.trim()}</p>
          <p>
            {t("메일에 있는 링크를 누른 뒤 로그인하면")}
            <br />
            {t("바로 시작할 수 있어요.")}
          </p>
          <Link className="rms-action primary full" to="/login">
            {t("로그인")}
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </AuthLayout>
    );

  if (invite === "checking")
    return (
      <AuthLayout>
        <h2>{t("초대 링크를 확인하고 있어요")}</h2>
        <p role="status">{t("잠시만 기다려 주세요.")}</p>
      </AuthLayout>
    );

  if (invite !== "open")
    return (
      <AuthLayout>
        <h2>{t("초대 링크를 확인해 주세요")}</h2>
        <p>
          {invite === "unreachable"
            ? t(
                "초대 링크를 확인하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
              )
            : t(
                "이 초대 링크는 만료됐거나 올바르지 않아요. 새 링크를 받거나, 초대 없이 가입할 수 있어요.",
              )}
        </p>
        <InviteLinkForm
          submitLabel={t("초대 링크 확인")}
          onCode={(next) =>
            navigate(`/signup?${INVITE_PARAM}=${next}`, { replace: true })
          }
        />
        <p className="auth-switch">
          {t("초대 링크가 없나요?")}{" "}
          <Link to="/signup" replace>
            {t("초대 없이 가입하기")}
          </Link>
        </p>
        <p className="auth-switch">
          {t("이미 가입했나요?")} <Link to="/login">{t("로그인")}</Link>
        </p>
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <h2>{t("마진 시작하기")}</h2>
      <p>
        {code
          ? t("초대받은 링크로 들어왔어요. 계정을 만들면 바로 쓸 수 있어요.")
          : t("계정을 만들면 바로 쓸 수 있어요.")}
      </p>
      <form onSubmit={submit}>
        <label className="field">
          {t("이름")}
          <Input
            required
            maxLength={NAME_MAX}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("예: 홍길동")}
            disabled={pending}
          />
        </label>
        <label className="field">
          {t("이메일")}
          <Input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@university.ac.kr"
            disabled={pending}
          />
          <small>
            {t("검토 요청을 받는 교수님은 학생이 적은 이메일로 가입해 주세요.")}
          </small>
        </label>
        <label className="field">
          {t("비밀번호")}
          <Input
            type="password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={PASSWORD_HELP}
            disabled={pending}
          />
        </label>
        {problem && (
          <p className="rms-error" role="alert">
            {problem}
          </p>
        )}
        <Button fullWidth size="lg" type="submit" disabled={pending}>
          {pending ? t("가입하는 중") : t("가입하기")}
          <Icon name="arrow-right" size={18} />
        </Button>
      </form>
      <KakaoLoginButton
        next="/r"
        label={t("카카오로 시작하기")}
        disabled={pending}
      />
      <p className="auth-switch">
        {t("이미 가입했나요?")} <Link to="/login">{t("로그인")}</Link>
      </p>
    </AuthLayout>
  );
}

/**
 * 가입한 계정이 초대 코드를 써서 허용 목록에 들어가는 단계.
 * 가입할 때 계정에 실어 둔 코드를 첫 로그인에서 한 번 씁니다.
 */
export function InviteGate({
  code,
  onDone,
  onSignOut,
}: {
  code: string;
  onDone: () => void;
  onSignOut: () => void;
}) {
  // 같은 코드를 다시 붙여 넣어도 다시 확인하도록 시도 횟수를 함께 둡니다.
  const [attempt, setAttempt] = useState({ code, count: 0 });
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let live = true;
    setProblem("");
    const client = assertConnected();
    client
      .rpc("rms_redeem_invite", { p_code: attempt.code })
      .then(async ({ error }) => {
        if (!live) return;
        if (error) {
          setProblem(friendlyError(new Error(error.message)));
          return;
        }
        // 다 쓴 코드를 계정에서 지웁니다. 지우지 못해도 다음 로그인에서
        // 같은 호출이 '이미 허용됨'으로 끝나므로 진행을 막지 않습니다.
        await client.auth.updateUser({ data: { invite: null } });
        if (live) onDone();
      });
    return () => {
      live = false;
    };
    // onDone은 부모가 매번 새로 만들어 넘기므로 의존성에서 뺍니다.
  }, [attempt]);

  if (!problem)
    return (
      <AuthLayout>
        <h2>{t("초대를 확인하고 있어요")}</h2>
        <p role="status">{t("잠시만 기다려 주세요.")}</p>
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <h2>{t("초대를 확인하지 못했어요")}</h2>
      <p className="rms-error" role="alert">
        {problem}
      </p>
      <p>{t("새 초대 링크를 받았다면 아래에 붙여 넣어 주세요.")}</p>
      <InviteLinkForm
        submitLabel={t("다시 확인")}
        onCode={(next) =>
          setAttempt((prev) => ({ code: next, count: prev.count + 1 }))
        }
      />
      <p className="auth-switch">
        {t("다른 계정으로 들어가려면")}{" "}
        <Button variant="link" size="sm" onClick={onSignOut}>
          {t("로그아웃")}
        </Button>
      </p>
    </AuthLayout>
  );
}
