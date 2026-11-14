import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/domain";
import { t } from "@/lib/i18n";
import { signupProblem } from "@/lib/invites";
import { MIN_PASSWORD_LENGTH, PASSWORD_HELP } from "@/lib/password-policy";
import {
  JOIN_PARAM,
  acceptProjectInvite,
  forgetPendingJoin,
  joinPath,
  joinTokenFrom,
  previewProjectInvite,
  rememberPendingJoin,
  roleLabel,
  type InvitePreview,
} from "@/lib/project-invites";
import { assertConnected, friendlyError } from "@/lib/supabase";
import { AuthLayout } from "./InvitePages";

const NAME_MAX = 40;

type Loaded =
  | { state: "checking" }
  | { state: "unreachable" }
  | { state: "missing" }
  | { state: "ready"; invite: InvitePreview };

interface JoinPageProps {
  session: Session | null;
  /** 로그인 상태를 확인했는지. 확인 전에는 로그인/가입 선택지를 보여 주지 않습니다. */
  ready: boolean;
}

function Closed({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AuthLayout>
      <h2>{title}</h2>
      <p>{children}</p>
      <div className="join-actions">
        <Button asChild fullWidth size="lg">
          <Link to="/r">
            {t("마진으로 이동")}
            <Icon name="arrow-right" size={18} />
          </Link>
        </Button>
      </div>
    </AuthLayout>
  );
}

function InviteSummary({ invite }: { invite: InvitePreview }) {
  return (
    <dl className="join-summary">
      <div>
        <dt>{t("연구")}</dt>
        <dd>{invite.researchName || t("이름 없는 연구")}</dd>
      </div>
      <div>
        <dt>{t("초대한 사람")}</dt>
        <dd>{invite.invitedByName || t("마진 사용자")}</dd>
      </div>
      <div>
        <dt>{t("역할")}</dt>
        <dd>{roleLabel(invite.role)}</dd>
      </div>
      <div>
        <dt>{t("받는 이메일")}</dt>
        <dd>{invite.email}</dd>
      </div>
    </dl>
  );
}

/** 연구 초대 메일의 ‘초대 수락’이 여는 화면(/join?token=<토큰>). 로그인 전후 모두 여기서 이어집니다. */
export function JoinPage({ session, ready }: JoinPageProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const token = joinTokenFrom(params.get(JOIN_PARAM));
  const [loaded, setLoaded] = useState<Loaded>(
    token ? { state: "checking" } : { state: "missing" },
  );
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<"choose" | "signup">("choose");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoaded({ state: "missing" });
      return;
    }
    let live = true;
    setLoaded({ state: "checking" });
    previewProjectInvite(token)
      .then((invite) => {
        if (!live) return;
        setLoaded(invite ? { state: "ready", invite } : { state: "missing" });
      })
      .catch(() => {
        if (live) setLoaded({ state: "unreachable" });
      });
    return () => {
      live = false;
    };
  }, [token, attempt]);

  async function accept() {
    if (pending || !token) return;
    setPending(true);
    setProblem("");
    try {
      const done = await acceptProjectInvite(token);
      forgetPendingJoin();
      // 이미 열려 있던 기록 캐시에는 새 연구가 없으므로 다시 받게 합니다.
      await client.invalidateQueries({ queryKey: ["workspace"] });
      toast.success(
        done.role === "advisor"
          ? t("초대를 수락했어요. 검토 요청이 오면 여기에서 볼 수 있어요.")
          : done.already
            ? t("이미 참여하고 있는 연구예요.")
            : t("초대를 수락했어요. 이제 연구에 참여해요."),
      );
      navigate(done.role === "editor" ? `/r/${done.researchId}` : "/r", {
        replace: true,
      });
    } catch (failure) {
      setProblem(friendlyError(failure));
      // 그 사이 취소·만료됐을 수 있으니 초대 상태를 다시 확인합니다.
      setAttempt((count) => count + 1);
    } finally {
      setPending(false);
    }
  }

  async function signUp(event: FormEvent, email: string) {
    event.preventDefault();
    if (pending || !token) return;
    setPending(true);
    setProblem("");
    try {
      const { data, error } = await assertConnected().auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw new Error(signupProblem(error.message));
      // 이미 가입한 이메일이면 인증 서버가 오류 없이 빈 계정을 돌려줍니다.
      if (data.user && data.user.identities?.length === 0)
        throw new Error(signupProblem("already registered"));
      setPassword("");
      // 메일 확인이 필요한 설정이면 로그인한 뒤 이 초대로 돌아오도록 기억해 둡니다.
      rememberPendingJoin(token);
      if (!data.session) setConfirmSent(true);
    } catch (failure) {
      setProblem(
        failure instanceof Error ? failure.message : signupProblem(""),
      );
    } finally {
      setPending(false);
    }
  }

  if (loaded.state === "missing")
    return (
      <Closed title={t("초대 링크를 확인해 주세요")}>
        {t(
          "초대 링크가 올바르지 않아요. 메일의 ‘초대 수락’ 버튼을 다시 누르거나, 초대한 사람에게 다시 보내 달라고 요청해 주세요.",
        )}
      </Closed>
    );
  if (loaded.state === "checking" || !ready)
    return (
      <AuthLayout>
        <h2>{t("초대를 확인하고 있어요")}</h2>
        <p role="status">{t("잠시만 기다려 주세요.")}</p>
      </AuthLayout>
    );
  if (loaded.state === "unreachable")
    return (
      <AuthLayout>
        <h2>{t("초대를 확인하지 못했어요")}</h2>
        <p role="alert">
          {t(
            "서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
          )}
        </p>
        <Button fullWidth size="lg" onClick={() => setAttempt((n) => n + 1)}>
          {t("다시 시도")}
        </Button>
      </AuthLayout>
    );

  const { invite } = loaded;
  const signedInEmail = session?.user.email?.toLowerCase() ?? "";
  const matches = !!session && signedInEmail === invite.email;

  if (invite.status === "expired")
    return (
      <Closed title={t("초대가 만료됐어요")}>
        {t(
          "{when}까지 수락할 수 있던 초대예요. {name}님에게 초대를 다시 보내 달라고 요청해 주세요.",
          {
            when: formatDateTime(invite.expiresAt),
            name: invite.invitedByName || t("초대한 사람"),
          },
        )}
      </Closed>
    );
  if (invite.status === "revoked")
    return (
      <Closed title={t("취소된 초대예요")}>
        {t(
          "초대한 사람이 이 초대를 취소했거나 새 초대를 보냈어요. 가장 최근에 받은 메일의 링크를 열어 주세요.",
        )}
      </Closed>
    );
  if (invite.status === "closed")
    return (
      <Closed title={t("지금은 수락할 수 없는 초대예요")}>
        {t(
          "연구가 정리됐거나 초대한 사람의 권한이 바뀌었어요. {name}님에게 다시 초대해 달라고 요청해 주세요.",
          { name: invite.invitedByName || t("초대한 사람") },
        )}
      </Closed>
    );
  if (invite.status === "accepted" && !matches)
    return (
      <Closed title={t("이미 수락한 초대예요")}>
        {t(
          "이 초대는 이미 사용됐어요. 초대받은 이메일({email})로 로그인하면 연구를 볼 수 있어요.",
          { email: invite.email },
        )}
      </Closed>
    );

  if (confirmSent)
    return (
      <AuthLayout>
        <div className="signup-finish" role="status">
          <Icon name="check-circle" size={38} />
          <h2>{t("확인 메일을 보냈어요")}</h2>
          <p>{invite.email}</p>
          <p>
            {t(
              "메일에 있는 링크를 누른 뒤 로그인하면 초대 수락 화면으로 돌아와요.",
            )}
          </p>
          <Link
            className="rms-action primary full"
            to={`/login?next=${encodeURIComponent(joinPath(token ?? ""))}`}
          >
            {t("로그인")}
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </AuthLayout>
    );

  const heading =
    invite.role === "advisor"
      ? t("지도교수로 초대받았어요")
      : t("연구에 초대받았어요");
  const scope =
    invite.role === "advisor"
      ? t(
          "수락하면 마진 계정이 열려요. 학생이 검토를 요청한 항목과 연구 방향만 볼 수 있고, 연구의 다른 기록은 보이지 않아요.",
        )
      : t(
          "수락하면 이 연구의 공동 기록을 함께 보고 편집할 수 있어요. 다른 공동연구자의 개인 메모와 AI 대화는 보이지 않아요.",
        );

  if (session && !matches)
    return (
      <AuthLayout>
        <h2>{t("다른 이메일로 로그인되어 있어요")}</h2>
        <InviteSummary invite={invite} />
        <p role="alert">
          {t(
            "지금은 {current}로 로그인되어 있어요. 이 초대는 {email} 앞으로 왔어요. 로그아웃한 뒤 초대받은 이메일로 로그인하거나 가입해 주세요.",
            { current: session.user.email ?? "", email: invite.email },
          )}
        </p>
        <Button
          fullWidth
          size="lg"
          disabled={pending}
          onClick={() => {
            if (token) rememberPendingJoin(token);
            void assertConnected().auth.signOut({ scope: "local" });
          }}
        >
          {t("로그아웃하고 다시 로그인")}
        </Button>
        <p className="auth-switch">
          <Link to="/r">{t("지금 계정으로 마진 열기")}</Link>
        </p>
      </AuthLayout>
    );

  if (session)
    return (
      <AuthLayout>
        <h2>{heading}</h2>
        <InviteSummary invite={invite} />
        <p>{scope}</p>
        {problem && (
          <p className="rms-error" role="alert">
            {problem}
          </p>
        )}
        <div className="join-actions">
          <Button
            fullWidth
            size="lg"
            disabled={pending}
            onClick={() => void accept()}
          >
            {pending
              ? t("수락하는 중")
              : invite.status === "accepted"
                ? t("연구 열기")
                : t("초대 수락")}
            <Icon name="arrow-right" size={18} />
          </Button>
        </div>
        <p className="auth-switch">
          {t("{when}까지 수락할 수 있어요.", {
            when: formatDateTime(invite.expiresAt),
          })}
        </p>
      </AuthLayout>
    );

  if (mode === "signup")
    return (
      <AuthLayout>
        <h2>{t("계정 만들고 초대 수락하기")}</h2>
        <p>
          {t("초대받은 이메일({email})로 계정을 만들어요.", {
            email: invite.email,
          })}
        </p>
        <form onSubmit={(event) => void signUp(event, invite.email)}>
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
              readOnly
              autoComplete="username"
              value={invite.email}
            />
            <small>{t("초대받은 이메일로만 수락할 수 있어요.")}</small>
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
            {pending ? t("가입하는 중") : t("가입하고 계속")}
            <Icon name="arrow-right" size={18} />
          </Button>
        </form>
        <p className="auth-switch">
          {t("이미 가입했나요?")}{" "}
          <Link to={`/login?next=${encodeURIComponent(joinPath(token ?? ""))}`}>
            {t("로그인")}
          </Link>
        </p>
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <h2>{heading}</h2>
      <InviteSummary invite={invite} />
      <p>{scope}</p>
      <p>
        {t(
          "초대받은 이메일로 로그인하거나 가입하면 수락할 수 있어요. {when}까지 유효해요.",
          { when: formatDateTime(invite.expiresAt) },
        )}
      </p>
      <div className="join-actions">
        <Button asChild fullWidth size="lg">
          <Link
            to={`/login?next=${encodeURIComponent(joinPath(token ?? ""))}`}
            onClick={() => token && rememberPendingJoin(token)}
          >
            {t("로그인하고 수락")}
            <Icon name="arrow-right" size={18} />
          </Link>
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={() => {
            setProblem("");
            setMode("signup");
          }}
        >
          {t("처음이에요. 계정 만들기")}
        </Button>
      </div>
    </AuthLayout>
  );
}
