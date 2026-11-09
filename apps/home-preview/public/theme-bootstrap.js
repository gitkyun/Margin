/*
 * 첫 화면 테마 결정. React보다 먼저 <head>에서 동기로 실행해 깜빡임을 막습니다.
 * CSP(script-src 'self') 때문에 인라인 대신 이 파일을 씁니다.
 *
 * 1. Montage ThemeProvider가 쓰는 쿠키(margin-theme)를 읽습니다.
 * 2. 쿠키가 없고 아직 옮기지 않았다면 이전 저장값(localStorage rms-theme)을
 *    한 번만 쿠키로 옮기고 margin-theme-migrated로 표시합니다.
 * 3. html에 data-theme과 color-scheme을 붙입니다.
 *
 * 쿠키 이름은 src/lib/theme.tsx의 THEME_COOKIE_KEY와 같아야 합니다.
 */
(function () {
  try {
    var KEY = "margin-theme";
    var LEGACY_KEY = "rms-theme";
    var MIGRATED_KEY = "margin-theme-migrated";
    var valid = function (v) {
      return v === "light" || v === "dark" || v === "system";
    };
    var read = function () {
      var parts = document.cookie ? document.cookie.split("; ") : [];
      for (var i = 0; i < parts.length; i++) {
        var eq = parts[i].indexOf("=");
        if (parts[i].slice(0, eq) === KEY) {
          var value = parts[i].slice(eq + 1);
          if (valid(value)) return value;
        }
      }
      return undefined;
    };
    var theme = read();
    try {
      if (!localStorage.getItem(MIGRATED_KEY)) {
        var legacy = localStorage.getItem(LEGACY_KEY);
        if (theme === undefined && valid(legacy)) {
          document.cookie =
            KEY + "=" + legacy + "; Path=/; Max-Age=31536000; SameSite=Lax";
          theme = legacy;
        }
        localStorage.setItem(MIGRATED_KEY, "1");
      }
    } catch (e) {
      /* 저장소를 쓸 수 없으면 옮기지 않고 기본값을 씁니다. */
    }
    var resolved =
      theme === "light" || theme === "dark"
        ? theme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.style.colorScheme = resolved;
  } catch (e) {
    /* 실패하면 Montage 기본(라이트)으로 그립니다. */
  }
})();
