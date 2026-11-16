import { useId } from "react";
import { useReducedMotion } from "motion/react";
import SwitchButton from "@/components/kokonut/switch-button";
import { ProfileThemeRow } from "@/components/kokonut/profile-dropdown";
import { useTheme } from "@/lib/theme";
import { t } from "@/lib/i18n";

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const uid = useId();
  const reduced = useReducedMotion() === true;
  return compact ? (
    <ProfileThemeRow
      uid={uid}
      theme={theme}
      onChange={setTheme}
      reduced={reduced}
      menu={false}
    />
  ) : (
    <SwitchButton
      theme={resolvedTheme}
      onThemeChange={setTheme}
      aria-label={t("테마 전환")}
    />
  );
}
