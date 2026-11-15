export type Publisher = "google";
export interface ModelDefinition {
  id: string;
  label: string;
  provider: Publisher;
  description: string;
  thinking: string[];
  recommended?: boolean;
  inputPrice?: number;
  outputPrice?: number;
  cachedInputPrice?: number;
  disabled?: boolean;
  availability?: string;
}
// Published global standard rates, USD per million tokens; billing credits are excluded.
// https://cloud.google.com/model-garden/pricing?hl=en (checked 2026-11-15)
export function availableModels(
  _defaultModel = "gemini-3.8-flash",
  now = new Date(),
): ModelDefinition[] {
  const flashIntro = now < new Date("2027-01-01T00:00:00Z");
  const gemini4Intro = now < new Date("2026-12-01T00:00:00Z");
  return [
    {
      id: "gemini-3.8-flash",
      label: "Gemini 3.8 Flash",
      description: "일반 대화와 기록 정리에 추천해요.",
      recommended: true,
      inputPrice: flashIntro ? 0.75 : 1.5,
      outputPrice: flashIntro ? 3.75 : 7.5,
      cachedInputPrice: flashIntro ? 0.075 : 0.15,
    },
    {
      id: "gemini-4-hydrogen",
      label: "Gemini 4 Hydrogen",
      description: "빠른 문서 이해와 정리에 써 볼 수 있어요.",
      inputPrice: 1.5,
      outputPrice: 7.5,
      cachedInputPrice: 0.075,
    },
    {
      id: "gemini-4-carbon",
      label: "Gemini 4 Carbon",
      description: "문서 분석과 원고 검토에 써 볼 수 있어요.",
      inputPrice: gemini4Intro ? 2 : 4,
      outputPrice: gemini4Intro ? 10 : 20,
      cachedInputPrice: gemini4Intro ? 0.1 : 0.2,
    },
    {
      id: "gemini-4-argon",
      label: "Gemini 4 Argon",
      description: "복잡한 분석과 긴 검토에 써 볼 수 있어요.",
      inputPrice: gemini4Intro ? 2 : 4,
      outputPrice: gemini4Intro ? 10 : 20,
      cachedInputPrice: gemini4Intro ? 0.1 : 0.2,
    },
  ].map((model) => ({
    ...model,
    provider: "google" as const,
    thinking: ["high", "medium", "low"],
  }));
}
export const modelCatalog = availableModels();
export function generationUrl(provider: string, model: string, projectId = "") {
  const resource = `publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  if (provider !== "vertex")
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const scope = projectId
    ? `projects/${encodeURIComponent(projectId)}/locations/global/`
    : "";
  return `https://aiplatform.googleapis.com/v1/${scope}${resource}`;
}
