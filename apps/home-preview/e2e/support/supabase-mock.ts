import type { Page, Route } from "@playwright/test";
import workspace from "../fixtures/workspace.json" with { type: "json" };

/** 연결 모드 빌드가 바라보는 가짜 서버 주소(playwright.config.ts와 같아야 합니다). */
export const SUPABASE_URL = "http://127.0.0.1:54399";
/** supabase-js가 세션을 저장하는 열쇠: sb-<주소 첫 마디>-auth-token */
const SESSION_KEY = "sb-127-auth-token";

export const WORKSPACE = workspace;
export const RESEARCH_ID = workspace.researches[0].id;
/** 고정 데이터에서 연구를 가진 계정 */
export const OWNER = {
  id: workspace.researches[0].ownerId,
  email: "owner@example.test",
  name: "김학생",
};
export const GUEST = {
  id: "00000000-0000-4000-8000-0000000000aa",
  email: "guest@example.test",
  name: "초대받은 사람",
};

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

const base64Url = (value: string) => Buffer.from(value).toString("base64url");

/** 서명하지 않은 가짜 토큰. 브라우저는 모양만 읽고, 이 테스트에는 검증할 서버가 없습니다. */
export function sessionFor(user: TestUser) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = [
    base64Url(JSON.stringify({ alg: "none", typ: "JWT" })),
    base64Url(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        role: "authenticated",
        exp: expiresAt,
      }),
    ),
    "e2e",
  ].join(".");
  return {
    access_token: accessToken,
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: "2026-11-01T00:00:00Z",
      app_metadata: { provider: "email" },
      user_metadata: { name: user.name },
      identities: [{ id: user.id, provider: "email" }],
      created_at: "2026-11-01T00:00:00Z",
    },
  };
}

/** 페이지를 열기 전에 로그인된 상태로 만듭니다. */
export async function signInAs(page: Page, user: TestUser): Promise<void> {
  await page.addInitScript(
    ([key, session]) => localStorage.setItem(key, session),
    [SESSION_KEY, JSON.stringify(sessionFor(user))] as const,
  );
}

/** 처리기가 요청을 직접 끝냈을 때(예: 연결 실패 흉내) 돌려주는 값 */
export const HANDLED = Symbol("handled");
type Handler = (body: unknown, route: Route) => unknown | Promise<unknown>;

export interface ServerMock {
  /** 호출된 RPC·함수 이름과 요청 본문 */
  calls: { name: string; body: unknown }[];
  /** RPC 응답을 정합니다. { error, code, status }를 돌려주면 서버 오류로 응답합니다. */
  rpc(name: string, handler: Handler): void;
  /** Edge Function 응답을 정합니다. */
  fn(name: string, handler: Handler): void;
  /** 로그인·가입 요청이 돌려줄 계정을 정합니다. */
  account(user: TestUser): void;
  count(name: string): number;
}

interface Failure {
  error: string;
  code?: string;
  status?: number;
}

const isFailure = (value: unknown): value is Failure =>
  !!value && typeof value === "object" && "error" in value;

/** 가짜 서버로 가는 모든 요청을 가로챕니다. 정하지 않은 요청은 빈 값으로 응답합니다. */
export async function mockServer(page: Page): Promise<ServerMock> {
  const rpcs = new Map<string, Handler>();
  const fns = new Map<string, Handler>();
  const calls: ServerMock["calls"] = [];
  let account: TestUser = GUEST;
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
  };
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    const url = new URL(request.url());
    const body: unknown = request.postDataJSON?.() ?? null;
    const rpcName = url.pathname.match(/^\/rest\/v1\/rpc\/(.+)$/)?.[1];
    const fnName = url.pathname.match(/^\/functions\/v1\/(.+)$/)?.[1];
    if (rpcName || fnName) {
      const name = (rpcName ?? fnName)!;
      calls.push({ name, body });
      const handler = (rpcName ? rpcs : fns).get(name);
      const result = handler ? await handler(body, route) : null;
      if (result === HANDLED) return;
      if (isFailure(result))
        return json(
          route,
          result.status ?? 400,
          rpcName
            ? { message: result.error, code: result.code ?? "22023" }
            : { error: result.error },
        );
      return json(route, 200, result);
    }
    if (
      url.pathname === "/auth/v1/token" ||
      url.pathname === "/auth/v1/signup"
    ) {
      calls.push({ name: url.pathname, body });
      return json(route, 200, sessionFor(account));
    }
    if (url.pathname === "/auth/v1/user")
      return json(route, 200, sessionFor(account).user);
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204, headers: cors });
    return json(route, 200, []);
  });

  return {
    calls,
    rpc: (name, handler) => void rpcs.set(name, handler),
    fn: (name, handler) => void fns.set(name, handler),
    account: (user) => {
      account = user;
    },
    count: (name) => calls.filter((call) => call.name === name).length,
  };
}
