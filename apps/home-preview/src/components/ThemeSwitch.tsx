import { flushSync } from "react-dom";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { useTheme, type ThemePreference } from "@/lib/theme";

const THEMES = [
  { value: "light", label: t("라이트"), icon: "sun" },
  { value: "dark", label: t("다크"), icon: "moon" },
  { value: "system", label: t("시스템"), icon: "monitor" },
] as const;

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
  };
};

/**
 * 화면 테마 고르기(Kokonut UI Switch Button 원형 확산 전환 + Montage 토큰).
 * 지원하는 브라우저에서 동작 줄이기 설정이 꺼져 있으면 누른 버튼 자리에서 새 테마가 원형으로 퍼져요.
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  function selectTheme(next: ThemePreference, button: HTMLButtonElement) {
    if (next === theme) return;
    const doc = document as ViewTransitionDocument;
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof doc.startViewTransition !== "function" || reduce) {
      setTheme(next);
      return;
    }
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
    void transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 420,
            easing: "cubic-bezier(0.2, 0, 0, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {});
  }

  return (
    <div
      className="theme-switch-group"
      role="radiogroup"
      aria-label={t("화면 테마")}
    >
      {THEMES.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`theme-switch-btn${selected ? " is-selected" : ""}`}
            onClick={(e) => selectTheme(option.value, e.currentTarget)}
          >
            <span className="theme-switch-icon" aria-hidden="true">
              <Icon name={option.icon} size={16} />
            </span>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
