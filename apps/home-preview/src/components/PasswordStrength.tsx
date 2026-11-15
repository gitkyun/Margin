import { t } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/password-policy";

/** 새 비밀번호 칸 아래 세 칸 막대와 한 줄 안내. 비어 있으면 그리지 않아요. */
export function PasswordStrength({
  value,
  id,
}: {
  value: string;
  id?: string;
}) {
  const level = passwordStrength(value);
  if (level === 0) return null;
  const label =
    level === 1
      ? t("{count}자보다 짧아요", { count: MIN_PASSWORD_LENGTH })
      : level === 2
        ? t("쓸 수 있어요. 숫자나 기호를 섞으면 더 안전해요")
        : t("안전한 비밀번호예요");
  return (
    <div className="password-strength" data-level={level} id={id}>
      <span className="password-strength-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <small aria-live="polite">{label}</small>
    </div>
  );
}
