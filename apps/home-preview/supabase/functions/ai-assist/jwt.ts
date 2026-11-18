/**
 * Bearer 토큰에서 sub(사용자 id)를 서명 확인 없이 꺼냅니다. 로그인 확인(/auth/v1/user)과 DB 확인을
 * 동시에 시작하는 데만 쓰고, 결과는 로그인 확인이 같은 id를 돌려준 뒤에만 씁니다.
 */
export function unverifiedSubject(authorization: string): string | undefined {
  try {
    const part = authorization.replace(/^Bearer\s+/, "").split(".")[1];
    if (!part) return undefined;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded));
    return typeof claims?.sub === "string" &&
      /^[0-9a-f-]{36}$/i.test(claims.sub)
      ? claims.sub
      : undefined;
  } catch {
    return undefined;
  }
}
