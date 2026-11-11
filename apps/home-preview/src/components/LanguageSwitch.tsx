import { Segments } from "@/components/experience";
import { LANGUAGES, currentLang, setLang, t, type Lang } from "@/lib/i18n";

/** 화면 언어 선택. 이 브라우저에만 저장하고, 고르면 화면을 새로 불러옵니다. */
export function LanguageSwitch() {
  return (
    <Segments
      label={t("화면 언어")}
      value={currentLang()}
      onChange={(next) => setLang(next as Lang)}
      options={LANGUAGES}
    />
  );
}
