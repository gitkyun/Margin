import { Icon } from "@/components/icons";
import { useTheme } from "@/lib/theme";
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="화면 테마">
      {(
        [
          { value: "light", label: "라이트", icon: "sun" },
          { value: "dark", label: "다크", icon: "moon" },
          { value: "system", label: "시스템", icon: "monitor" },
        ] as const
      ).map((t) => (
        <button
          type="button"
          key={t.value}
          aria-label={t.label + " 테마"}
          aria-pressed={theme === t.value}
          onClick={() => setTheme(t.value)}
        >
          <Icon name={t.icon} size={16} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
