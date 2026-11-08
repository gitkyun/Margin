export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_HELP = `${MIN_PASSWORD_LENGTH}자 이상으로 입력하세요.`;

export function validateNewPassword(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상으로 입력해 주세요.`
    : null;
}
