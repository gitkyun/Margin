import { LANGUAGES, currentLang, setLang, t } from "@/lib/i18n";

/**
 * 위쪽 줄(공개 헤더, 로그인 후 상단 줄)의 언어 선택.
 * 공개 푸터의 라이트·다크 선택과 같은 모양입니다: 알약 안에 버튼 둘, 고른 쪽이 밝은 면.
 * 이 브라우저에만 저장하고, 바꾸면 화면을 새로 불러옵니다.
 */
export function LanguageMenu({ className = "" }: { className?: string }) {
  const lang = currentLang();
  return (
    <div
      className={`language-segments ${className}`.trim()}
      role="group"
      aria-label={t("화면 언어")}
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={lang === option.value}
          onClick={() => setLang(option.value)}
        >
          <span aria-hidden="true">{option.flag}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
