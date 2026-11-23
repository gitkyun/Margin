import { defineConfig, devices } from "@playwright/test";

// E2E는 실제 서버(Supabase)와 실제 사용자 데이터를 쓰지 않습니다.
// - preview: 서버 설정 없이 빌드한 미리보기 모드. 가상 기록이 이 브라우저(IndexedDB)에만 저장됩니다.
// - connected: 가짜 서버 주소로 빌드한 연결 모드. 서버 응답은 테스트가 가로채서 정합니다(e2e/support/supabase-mock.ts).
// 서버 쪽 권한(RLS·RPC)은 supabase/tests/backend.test.mjs가 실제 SQL로 검증합니다.
const PREVIEW_PORT = 4180;
const CONNECTED_PORT = 4181;
export const MOCK_SUPABASE_URL = "http://127.0.0.1:54399";

const serve = (outDir: string, port: number) =>
  `node scripts/prepare-pdf-assets.mjs && npx vite build --outDir ${outDir} --logLevel error && npx vite preview --outDir ${outDir} --port ${port} --strictPort`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "preview",
      testMatch:
        /(preview|dialog-layout|home-layout|docs-layout|shell-quick-layout|shell-hardening|wave2-slice1-capture)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${PREVIEW_PORT}`,
      },
    },
    {
      name: "connected",
      testMatch:
        /(project-invite|open-signup|ai-composer|ai-composer-mobile|account-menu)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${CONNECTED_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: serve("dist/e2e-preview", PREVIEW_PORT),
      url: `http://127.0.0.1:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    },
    {
      command: serve("dist/e2e-connected", CONNECTED_PORT),
      url: `http://127.0.0.1:${CONNECTED_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      env: {
        VITE_SUPABASE_URL: MOCK_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
      },
    },
  ],
});
