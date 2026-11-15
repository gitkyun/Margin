import { flushSync } from "react-dom";
import { Icon } from "@/components/icons";
import { t } from "@/lib/i18n";
import { useTheme, type ThemePreference } from "@/lib/theme";

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

function switchWithCircle(
  el: HTMLElement | null,
  apply: () => void,
  willChangeVisualTheme: boolean,
) {
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startVT = (
    document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    }
  ).startViewTransition;

  if (
    !willChangeVisualTheme ||
    reduced ||
    typeof startVT !== "function" ||
    !el
  ) {
    apply();
    return;
  }

  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = startVT.call(document, () => {
    flushSync(apply);
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
          duration: 450,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
}

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: () => string;
  icon: string;
}> = [
  { value: "light", label: () => t("라이트"), icon: "sun" },
  { value: "dark", label: () => t("다크"), icon: "moon" },
  { value: "system", label: () => t("시스템"), icon: "monitor" },
];

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  function choose(next: ThemePreference, target: HTMLElement | null) {
    if (next === theme) return;
    const nextResolved = resolveTheme(next);
    switchWithCircle(
      target,
      () => setTheme(next),
      nextResolved !== resolvedTheme,
    );
  }

  if (compact) {
    return (
      <div
        className="theme-switch-row"
        role="group"
        aria-label={t("화면 테마")}
      >
        <span className="theme-switch-label">
          <Icon name={resolvedTheme === "dark" ? "moon" : "sun"} size={15} />
          <span>{t("화면 테마")}</span>
        </span>
        <div className="theme-switch-pills">
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`theme-switch-pill${active ? " is-active" : ""}`}
                aria-pressed={active}
                onClick={(e) => choose(opt.value, e.currentTarget)}
              >
                {opt.label()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const nextTheme: ThemePreference =
    resolvedTheme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-switch-button"
      aria-label={t("테마 전환")}
      onClick={(e) => choose(nextTheme, e.currentTarget)}
    >
      <Icon name={resolvedTheme === "dark" ? "moon" : "sun"} size={15} />
      <span>{resolvedTheme === "dark" ? t("다크") : t("라이트")}</span>
    </button>
  );
}
