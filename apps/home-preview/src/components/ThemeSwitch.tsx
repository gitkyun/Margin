import { Icon } from "@/components/icons";
import { Segments } from "@/components/experience";
import { useTheme } from "@/lib/theme";

const THEMES = [
  { value: "light", label: "라이트", icon: "sun" },
  { value: "dark", label: "다크", icon: "moon" },
  { value: "system", label: "시스템", icon: "monitor" },
] as const;

/** 화면 테마 고르기. 다른 보기 전환과 같은 Montage SegmentedControl을 씁니다. */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <Segments
      label="화면 테마"
      value={theme}
      onChange={(next) => setTheme(next as (typeof THEMES)[number]["value"])}
      options={THEMES.map((t) => ({
        value: t.value,
        label: t.label,
        icon: <Icon name={t.icon} size={16} />,
      }))}
    />
  );
}
