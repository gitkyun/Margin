import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { assertConnected, friendlyError } from "@/lib/supabase";
import { startSocialLogin } from "@/lib/social-login";

/** 라인 말풍선 기호. */
function LineSymbol() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 2C5.03 2 1 5.28 1 9.33c0 3.63 3.2 6.67 7.52 7.25.29.06.69.2.79.45.09.23.06.58.03.81l-.13.77c-.04.23-.18.89.78.49.96-.41 5.17-3.04 7.05-5.21C18.33 12.46 19 10.98 19 9.33 19 5.28 14.97 2 10 2Z"
      />
    </svg>
  );
}

/**
 * 라인으로 로그인·가입하는 버튼. 누르면 라인 화면으로 갔다가 next 주소로 돌아옵니다.
 * 카카오 버튼 아래에 붙여 쓰므로 ‘또는’ 구분선은 두지 않습니다.
 */
export function LineLoginButton({
  next,
  label,
  disabled = false,
}: {
  next: string;
  label: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const consentId = useId();

  async function start() {
    setPending(true);
    setProblem("");
    try {
      await startSocialLogin(assertConnected(), "line", next);
    } catch (failure) {
      setProblem(friendlyError(failure));
      setPending(false);
    }
  }

  return (
    <div className="social-login social-login-line">
      <button
        type="button"
        className="line-login"
        onClick={() => void start()}
        disabled={disabled || pending}
        aria-describedby={consentId}
      >
        <LineSymbol />
        {pending ? t("라인으로 이동하는 중") : label}
      </button>
      {/* 라인 이메일 주소 권한 신청에 필요한 안내·동의 문구. 버튼을 누르기 전에 읽을 수 있게 바로 아래에 둡니다. */}
      <p id={consentId} className="social-consent">
        {t(
          "라인으로 시작하면 라인 계정의 이메일 주소를 받아 마진 계정을 만들고 확인하는 데, 그리고 검토 요청·초대 같은 알림 메일을 보내는 데에만 써요. 버튼을 누르면 이에 동의하는 것으로 봐요.",
        )}{" "}
        <Link to="/privacy">{t("자료와 개인정보")}</Link>
      </p>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
