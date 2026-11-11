import { ja } from "@/i18n/ja";

/**
 * 화면 언어. 한국어가 원문이고, 일본어는 한국어 문구를 열쇠로 한 사전(`src/i18n/ja`)에서 찾습니다.
 * 사전에 없는 문구는 한국어 그대로 보여 줍니다(빈칸이나 열쇠 이름을 보여 주지 않음).
 * 언어를 바꾸면 화면을 새로 불러옵니다. 그래서 파일 맨 위 상수에서도 `t()`를 쓸 수 있습니다.
 */
export type Lang = "ko" | "ja";

const STORAGE_KEY = "margin-lang";

/** 언어 이름은 그 언어로 적고, 앞에 국기 이모지를 붙여 보여 줍니다. */
export const LANGUAGES: { value: Lang; label: string; flag: string }[] = [
  { value: "ko", label: "한국어", flag: "🇰🇷" }, // i18n-ignore
  { value: "ja", label: "日本語", flag: "🇯🇵" },
];

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ko" || saved === "ja") return saved;
  } catch {
    // 저장소를 쓸 수 없으면 브라우저 언어를 봅니다.
  }
  // 고른 적이 없으면 브라우저 언어가 일본어일 때만 일본어로 시작합니다.
  return typeof navigator !== "undefined" &&
    navigator.language?.toLowerCase().startsWith("ja")
    ? "ja"
    : "ko";
}

let lang: Lang = readLang();

export function currentLang(): Lang {
  return lang;
}

/** 언어를 이 브라우저에 저장하고 화면을 새로 불러옵니다(서버에 저장하지 않음). */
export function setLang(next: Lang): void {
  if (next === lang) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 저장하지 못해도 이번 화면에서는 바꿉니다.
  }
  lang = next;
  if (typeof window !== "undefined") window.location.reload();
}

/** 테스트에서만: 새로 불러오지 않고 언어를 바꿉니다. */
export function setLangForTest(next: Lang): void {
  lang = next;
}

/** 날짜·시각을 쓰는 `Intl` 로캘 */
export function dateLocale(): string {
  return lang === "ja" ? "ja-JP" : "ko-KR";
}

/**
 * 같은 한국어 낱말이 자리에 따라 뜻이 다를 때 씁니다. 한국어에서는 원문 그대로이고,
 * 일본어 사전에서는 `원문@@뜻` 열쇠를 찾습니다(없으면 원문 열쇠, 그것도 없으면 원문).
 *   tc("optional", "선택")  → 선택 / 任意
 */
export function tc(
  context: string,
  key: string,
  vars?: Record<string, string | number | null | undefined>,
): string {
  if (lang === "ja" && `${key}@@${context}` in ja)
    return t(`${key}@@${context}`, vars);
  return t(key, vars);
}

/**
 * 문구를 지금 언어로. 열쇠는 한국어 원문 그대로이고, `{이름}` 자리에 값을 넣습니다.
 *   t("저장했어요.")
 *   t("할 일 {count}개", { count })
 */
export function t(
  key: string,
  vars?: Record<string, string | number | null | undefined>,
): string {
  const text = lang === "ja" ? (ja[key] ?? key) : key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name] ?? "") : match,
  );
}
