import { Icon } from "@/components/icons";
import { useTheme } from "@/lib/theme";
import "./footer-controls.css";

const themes = [
  { value: "light", label: "라이트", icon: "sun" },
  { value: "dark", label: "다크", icon: "moon" },
  { value: "system", label: "시스템", icon: "monitor" },
] as const;

export function FooterControls() {
  const { theme, setTheme } = useTheme();

  function scrollToTop(button: HTMLButtonElement) {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "instant"
      : "smooth";
    const roots = new Set<Element>();
    if (document.scrollingElement) roots.add(document.scrollingElement);
    for (let node = button.parentElement; node; node = node.parentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (
        /auto|scroll/.test(overflowY) &&
        node.scrollHeight > node.clientHeight
      ) {
        roots.add(node);
      }
    }
    roots.forEach((node) => node.scrollTo({ top: 0, left: 0, behavior }));
    window.scrollTo({ top: 0, left: 0, behavior });
    document
      .querySelector<HTMLAnchorElement>(".lp-header .lp-brand")
      ?.focus({ preventScroll: true });
  }

  return (
    <div className="lp-footer-controls">
      <div className="lp-footer-theme" role="group" aria-label="화면 테마 선택">
        {themes.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`${option.label} 테마`}
            aria-pressed={theme === option.value}
            onClick={() => setTheme(option.value)}
          >
            <Icon name={option.icon} size={15} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <button
        className="lp-back-to-top"
        type="button"
        onClick={(event) => scrollToTop(event.currentTarget)}
        aria-label="맨 위로 이동"
      >
        맨 위로
        <Icon name="arrow-up" size={16} />
      </button>
    </div>
  );
}
