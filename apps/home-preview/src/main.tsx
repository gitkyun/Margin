// 레이어 순서를 가장 먼저 정합니다(design/layers.css).
import "./design/layers.css";
import React, { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  ScrollRestoration,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "./RmsApp";
import { AppCrash } from "./components/AppCrash";
import { currentLang } from "./lib/i18n";
import { ThemeProvider, useTheme } from "./lib/theme";
import { NavigationGuardProvider } from "./lib/navigation-guard";
import { installFormValidation } from "./lib/form-validation";
import "@montage-ui/core/theme.css";
import "./styles.css";
import "./design/tokens.css";
import "./experience.css";
// 화면 언어를 문서에 알립니다(줄바꿈 규칙, 화면 낭독기 발음).
document.documentElement.lang = currentLang();
const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      closeButton
      theme={resolvedTheme}
      toastOptions={{ className: "margin-toast" }}
    />
  );
}
const router = createBrowserRouter([
  {
    path: "*",
    errorElement: <AppCrash />,
    element: (
      <NavigationGuardProvider>
        <ScrollRestoration />
        <App />
        <ThemedToaster />
      </NavigationGuardProvider>
    ),
  },
]);
installFormValidation();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);

import "./expansion.css";
import "./pages/assistant.css";
import "./pages/writing.css";
import "./pages/screens.css";
import "./reference.css";

import "./pages/public-site.css";
import "./components/brand/brand.css";

// Montage·외부 부품 조정은 레이어 밖이라 마지막에 불러옵니다.
import "./design/montage.css";
