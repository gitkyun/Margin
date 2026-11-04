import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "./RmsApp";
import { ThemeProvider } from "./lib/theme";
import { NavigationGuardProvider } from "./lib/navigation-guard";
import "./styles.css";
const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <NavigationGuardProvider>
        <App />
        <Toaster position="bottom-right" richColors closeButton />
      </NavigationGuardProvider>
    ),
  },
]);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
