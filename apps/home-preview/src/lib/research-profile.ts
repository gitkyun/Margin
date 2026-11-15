import { t } from "./i18n";

/** 연구 키워드는 칩으로 10개까지 적어요. */
export const MAX_KEYWORDS = 10;
/** 키워드 하나의 최대 글자 수 */
export const KEYWORD_MAX_LENGTH = 40;

/** 키워드가 될 수 있는 글: 비어 있지 않고 너무 길지 않음 */
export function isKeyword(value: string): boolean {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > 0 && text.length <= KEYWORD_MAX_LENGTH;
}

/** 키워드를 하나 더한 새 목록. 대소문자만 다른 겹침, 틀린 형식, 꽉 찬 목록이면 그대로 돌려줍니다. */
export function addKeyword(current: string[], value: string): string[] {
  const next = value.trim().replace(/\s+/g, " ");
  if (!isKeyword(next) || current.length >= MAX_KEYWORDS) return current;
  const key = next.toLocaleLowerCase();
  if (current.some((item) => item.toLocaleLowerCase() === key)) return current;
  return [...current, next];
}

/** 저장된 값을 화면 목록으로(형식이 틀린 값은 빼고 최대 개수까지) */
export function readKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .reduce<string[]>(addKeyword, []);
}

/** 두 키워드 목록이 같은지(순서 포함) */
export function sameKeywords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * 목표 학회·학술지의 인용 양식 프리셋. 직접 입력은 받지 않아요.
 * 값은 저장용 식별자이고 이름은 양식 고유 이름이라 번역하지 않습니다.
 */
export const CITATION_STYLES = [
  { value: "apa7", label: "APA 7" },
  { value: "ieee", label: "IEEE" },
  { value: "acm", label: "ACM" },
  { value: "chicago", label: "Chicago" },
  { value: "mla", label: "MLA" },
] as const;

export type CitationStyle = (typeof CITATION_STYLES)[number]["value"];

/** 고르지 않음을 나타내는 선택 값 */
export const NO_CITATION_STYLE = "none";

export function readCitationStyle(value: unknown): CitationStyle | undefined {
  return CITATION_STYLES.find((style) => style.value === value)?.value;
}

export function citationStyleOptions(): { value: string; label: string }[] {
  return [
    { value: NO_CITATION_STYLE, label: t("정하지 않음") },
    ...CITATION_STYLES,
  ];
}
