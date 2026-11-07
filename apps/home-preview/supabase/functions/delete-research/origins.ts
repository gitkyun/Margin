// Exact origins only: the former address stays valid during the brand migration.
export function allowedOrigins(config = "http://localhost:4175,http://127.0.0.1:4175") {
  return [...new Set([
    ...config.split(",").map(value => value.trim()).filter(Boolean),
    "https://rms-classroom-demo.pages.dev",
    "https://margin-research.pages.dev",
  ])];
}
