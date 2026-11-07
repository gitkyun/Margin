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
import { ThemeProvider } from "./lib/theme";
import { NavigationGuardProvider } from "./lib/navigation-guard";
import "./styles.css";
import "./experience.css";
const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <NavigationGuardProvider>
        <ScrollRestoration />
        <App />
        <Toaster position="bottom-right" richColors closeButton />
      </NavigationGuardProvider>
    ),
  },
]);
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

import "./pages/workspace-refinements.css";
