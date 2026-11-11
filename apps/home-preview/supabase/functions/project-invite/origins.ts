// Exact origins only: the former address stays valid during the brand migration.
export function allowedOrigins(config = "http://localhost:4175,http://127.0.0.1:4175") {
  return [...new Set([
    ...config.split(",").map(value => value.trim()).filter(Boolean),
    "https://rms-classroom-demo.pages.dev",
    "https://margin-research.pages.dev",
  ])];
}

/** 메일에 넣을 사이트 주소. APP_URL이 있으면 그것을, 없으면 요청을 보낸(허용 목록에 있는) 주소를 씁니다. */
export function appUrl(configured: string | undefined, origin: string): string {
  const value = (configured ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/\s]+$/.test(value) ? value : origin;
}
