import { useState } from "react";
import { t } from "@/lib/i18n";
import { assertConnected, friendlyError } from "@/lib/supabase";
import { startKakaoLogin } from "@/lib/social-login";

/** 카카오 말풍선 기호(카카오 로그인 디자인 가이드의 모양). */
function KakaoSymbol() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 1.5C4.58 1.5 1 4.3 1 7.75c0 2.2 1.46 4.13 3.66 5.24l-.75 2.76c-.07.25.21.45.43.3l3.27-2.16c.45.06.92.1 1.39.1 4.42 0 8-2.8 8-6.24S13.42 1.5 9 1.5Z"
      />
    </svg>
  );
}

/** 카카오로 로그인·가입하는 버튼. 누르면 카카오 화면으로 갔다가 next 주소로 돌아옵니다. */
export function KakaoLoginButton({
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

  async function start() {
    setPending(true);
    setProblem("");
    try {
      await startKakaoLogin(assertConnected(), next);
    } catch (failure) {
      setProblem(friendlyError(failure));
      setPending(false);
    }
  }

  return (
    <div className="social-login">
      <div className="social-divider" role="separator">
        <span>{t("또는")}</span>
      </div>
      <button
        type="button"
        className="kakao-login"
        onClick={() => void start()}
        disabled={disabled || pending}
      >
        <KakaoSymbol />
        {pending ? t("카카오로 이동하는 중") : label}
      </button>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
