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
