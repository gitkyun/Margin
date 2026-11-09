import type { ReactNode } from "react";
import {
  ThemeProvider as MontageThemeProvider,
  useThemeControl,
} from "@montage-ui/core";

/**
 * 테마 상태는 Montage ThemeProvider 하나가 가집니다(쿠키 저장).
 * 첫 화면 결정과 이전 저장값(localStorage rms-theme) 이전은
 * public/theme-bootstrap.js가 React보다 먼저 처리합니다.
 */
export const THEME_COOKIE_KEY = "margin-theme";

export type ThemePreference = "light" | "dark" | "system";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <MontageThemeProvider
      enableDarkMode
      disableDefaultGlobalStyle
      cookie={{ key: THEME_COOKIE_KEY, domain: "none" }}
    >
      {children}
    </MontageThemeProvider>
  );
}

/**
 * 기존 호출부 호환용. 새 코드는 Montage useThemeControl을 바로 써도 됩니다.
 * - theme: 사용자가 고른 값(light·dark·system)
 * - resolvedTheme: 실제 적용된 값(light·dark)
 */
export function useTheme() {
  const control = useThemeControl();
  return {
    theme: (control.themeOriginValue ?? "system") as ThemePreference,
    resolvedTheme: control.theme,
    setTheme: (next: ThemePreference) => control.setTheme(next),
  };
}
