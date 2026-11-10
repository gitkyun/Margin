/** 한 연구에 등록할 수 있는 지도교수 수. 주·부 지도교수와 심사위원까지 넉넉히 잡습니다. */
export const MAX_ADVISORS = 5;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/**
 * 입력한 글(쉼표·공백·줄바꿈으로 구분)에서 지도교수 이메일을 뽑습니다.
 * 소문자로 맞추고 겹치는 것과 형식이 틀린 것은 뺍니다.
 */
export function parseAdvisorEmails(text: string): string[] {
  const emails = text
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(isEmail);
  return [...new Set(emails)].slice(0, MAX_ADVISORS);
}

/** 등록된 목록에 하나를 더한 새 목록. 이미 있거나 형식이 틀리면 그대로 돌려줍니다. */
export function addAdvisor(current: string[], email: string): string[] {
  const next = email.trim().toLowerCase();
  if (!isEmail(next) || current.includes(next)) return current;
  if (current.length >= MAX_ADVISORS) return current;
  return [...current, next];
}

/**
 * 검토 요청에서 고를 교수 목록: 연구에 등록한 지도교수가 먼저,
 * 그다음에 등록은 안 했지만 전에 검토를 요청한 이메일이 옵니다.
 */
export function advisorChoices(
  registered: string[] | undefined,
  previouslyUsed: string[],
): string[] {
  return [...new Set([...(registered ?? []), ...previouslyUsed])];
}
