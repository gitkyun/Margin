import { readGrounding, type WebGrounding } from "./grounding.ts";
import type { ModelDefinition } from "./models.ts";
import { generationUrl } from "./models.ts";
export interface TokenUsage {
  searchQueries?: number;
  input: number;
  output: number;
  cached: number;
  cacheWrite: number;
  reasoning: number;
  known: boolean;
}
export interface ProviderResult {
  grounding?: WebGrounding;
  response: Response;
  text: string;
  usage: TokenUsage;
  /** 제공사가 생성을 멈춘 이유(STOP, MAX_TOKENS 등). 응답이 없으면 비어 있습니다. */
  finishReason?: string;
}
interface RequestOptions {
  webSearch?: boolean;
  model: ModelDefinition;
  system: string;
  prompt: string;
  schema: unknown;
  thinking?: string;
  maxOutput: number;
  signal: AbortSignal;
  apiKey: string;
  projectId: string;
  provider: string;
}
export async function generate(
  options: RequestOptions,
): Promise<ProviderResult> {
  const {
    webSearch = false,
    model,
    system,
    prompt,
    schema,
    thinking,
    maxOutput,
    signal,
    apiKey,
    projectId,
    provider,
  } = options;
  const headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
  const url = generationUrl(provider, model.id, projectId);
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}),
    generationConfig: {
      ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      ...(!webSearch
        ? { responseMimeType: "application/json", responseSchema: schema }
        : {}),
      maxOutputTokens: maxOutput,
    },
  };
  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify(body),
  });
  if (!response.ok)
    return {
      response,
      text: "",
      usage: {
        input: 0,
        output: 0,
        cached: 0,
        cacheWrite: 0,
        reasoning: 0,
        known: false,
      },
    };
  const data = await response.json();
  const n = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : 0;
  const u = data.usageMetadata;
  // 생성한 토큰 전체(답변+생각)는 총합에서 요청 입력과 도구 결과 입력을 뺀 값입니다.
  // Google 검색 결과 입력은 별도 토큰 청구 대상이 아니며 검색어 요금으로 정산합니다. 제공사 경로마다 답변 수에
  // 생각 토큰이 들어 있는지가 달라질 수 있어, 총합이 있으면 그 값을 쓰고 없을 때만 더합니다.
  const generated =
    typeof u?.totalTokenCount === "number" &&
    typeof u?.promptTokenCount === "number"
      ? Math.max(
          n(u.candidatesTokenCount),
          n(u.totalTokenCount) -
            n(u.promptTokenCount) -
            n(u.toolUsePromptTokenCount),
        )
      : n(u?.candidatesTokenCount) + n(u?.thoughtsTokenCount);
  const grounded = readGrounding(data.candidates?.[0]);
  const finishReason = data.candidates?.[0]?.finishReason;
  return {
    response,
    text: grounded.text,
    ...(typeof finishReason === "string" ? { finishReason } : {}),
    ...(webSearch ? { grounding: grounded.grounding } : {}),
    usage: {
      ...(webSearch && grounded.searchQueries !== undefined
        ? { searchQueries: grounded.searchQueries }
        : {}),
      input: n(u?.promptTokenCount),
      cached: n(u?.cachedContentTokenCount),
      output: generated,
      reasoning: n(u?.thoughtsTokenCount),
      cacheWrite: 0,
      known:
        (!webSearch || grounded.searchQueries !== undefined) &&
        !!u &&
        typeof u.promptTokenCount === "number" &&
        typeof u.candidatesTokenCount === "number",
    },
  };
}

export function usageCredits(
  model: ModelDefinition,
  usage: TokenUsage,
): number {
  if (
    !usage.known ||
    model.inputPrice === undefined ||
    model.outputPrice === undefined
  )
    throw new Error("USAGE_UNCONFIRMED");
  const fresh = Math.max(0, usage.input - usage.cached - usage.cacheWrite);
  // 토큰 × (백만 토큰당 USD) = 마이크로달러. 1크레딧 = 1000마이크로달러이므로
  // 크레딧을 소수 셋째 자리에서 올림하면 마이크로달러를 정수로 올림한 뒤 1000으로 나눈 값입니다.
  return (
    Math.ceil(
      fresh * model.inputPrice +
        usage.cached * (model.cachedInputPrice ?? model.inputPrice) +
        usage.cacheWrite * model.inputPrice * 1.25 +
        usage.output * model.outputPrice +
        (usage.searchQueries ?? 0) * GOOGLE_SEARCH_QUERY_CREDITS * 1000,
    ) / 1000
  );
}
export function reserveCredits(
  model: ModelDefinition,
  system: string,
  prompt: string,
  schema: unknown,
  maxOutput: number,
  webSearch = false,
): number {
  // UTF-8 bytes conservatively bound text tokens; include schema and request framing.
  const input =
    new TextEncoder().encode(system + prompt + JSON.stringify(schema)).length +
    2048;
  return (
    Math.ceil(input * model.inputPrice! + maxOutput * model.outputPrice!) /
      1000 +
    (webSearch ? GOOGLE_SEARCH_QUERY_CREDITS * WEB_SEARCH_RESERVE_QUERIES : 0)
  );
}

// Published $14/1,000 queries, 1 credit = $0.001; project free quota/discounts excluded.
// https://cloud.google.com/model-garden/pricing (checked 2026-11-16)
export const GOOGLE_SEARCH_QUERY_CREDITS = 14;
// Reservation headroom, not a provider-enforced query cap. Actual reported queries settle afterward.
export const WEB_SEARCH_RESERVE_QUERIES = 16;
