import { t } from "@/lib/i18n";
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_HELP = t("{count}자 이상 입력해 주세요.", {
  count: MIN_PASSWORD_LENGTH,
});

export function validateNewPassword(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? t("새 비밀번호는 {count}자 이상으로 입력해 주세요.", {
        count: MIN_PASSWORD_LENGTH,
      })
    : null;
}

export type PasswordStrength = 0 | 1 | 2 | 3;

/** 0 비어 있음 · 1 짧음 · 2 쓸 수 있음 · 3 좋음. 보안 보증이 아니라 입력 안내용 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 0;
  if (password.length < MIN_PASSWORD_LENGTH) return 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  return password.length >= 12 || kinds >= 3 ? 3 : 2;
}
