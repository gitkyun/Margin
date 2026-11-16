export interface WebGrounding {
  sources: { url: string; title: string }[];
  citations: {
    startIndex: number;
    endIndex: number;
    sourceIndices: number[];
  }[];
  queries: string[];
  searchEntryPointHtml?: string;
}
export function safeWebUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 8192) return;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return;
    return url.href;
  } catch {
    return;
  }
}
function byteIndex(text: string, offset: unknown): number | undefined {
  if (!Number.isSafeInteger(offset) || Number(offset) < 0) return;
  let bytes = 0,
    index = 0;
  for (const char of text) {
    if (bytes === offset) return index;
    bytes += new TextEncoder().encode(char).length;
    index += char.length;
    if (bytes > Number(offset)) return;
  }
  return bytes === offset ? index : undefined;
}
/** Google segment offsets address UTF-8 bytes inside the original response Part. */
export function readGrounding(candidate: any): {
  text: string;
  grounding: WebGrounding;
  searchQueries?: number;
} {
  let text = "";
  const parts = new Map<number, { text: string; offset: number }>();
  (candidate?.content?.parts ?? []).forEach((part: any, index: number) => {
    if (part.thought || typeof part.text !== "string") return;
    parts.set(index, { text: part.text, offset: text.length });
    text += part.text;
  });
  const raw = candidate?.groundingMetadata;
  const sources: WebGrounding["sources"] = [];
  const indices = new Map<number, number>();
  const urls = new Map<string, number>();
  (Array.isArray(raw?.groundingChunks) ? raw.groundingChunks : []).forEach(
    (chunk: any, index: number) => {
      const url = safeWebUrl(chunk?.web?.uri);
      if (!url) return;
      let mapped = urls.get(url);
      if (mapped === undefined) {
        if (sources.length >= 64) return;
        mapped = sources.length;
        urls.set(url, mapped);
        sources.push({
          url,
          title:
            typeof chunk.web.title === "string"
              ? chunk.web.title.slice(0, 400)
              : new URL(url).hostname,
        });
      }
      indices.set(index, mapped);
    },
  );
  const citations: WebGrounding["citations"] = [];
  for (const support of (Array.isArray(raw?.groundingSupports)
    ? raw.groundingSupports
    : []
  ).slice(0, 1000)) {
    const segment = support?.segment;
    const part = parts.get(segment?.partIndex ?? 0);
    if (!part) continue;
    const start = byteIndex(part.text, segment.startIndex ?? 0);
    const end = byteIndex(part.text, segment.endIndex);
    if (start === undefined || end === undefined || start >= end) continue;
    if (
      typeof segment.text === "string" &&
      part.text.slice(start, end) !== segment.text
    )
      continue;
    const sourceIndices = [
      ...new Set<number>(
        (Array.isArray(support.groundingChunkIndices)
          ? support.groundingChunkIndices
          : []
        )
          .map((i: number) => indices.get(i))
          .filter((i: number | undefined) => i !== undefined),
      ),
    ];
    if (sourceIndices.length)
      citations.push({
        startIndex: part.offset + start,
        endIndex: part.offset + end,
        sourceIndices,
      });
  }
  const queries = Array.isArray(raw?.webSearchQueries)
    ? [
        ...new Set<string>(
          raw.webSearchQueries
            .filter((q: unknown) => typeof q === "string" && q.trim())
            .map((q: string) => q.trim()),
        ),
      ]
    : [];
  const html =
    typeof raw?.searchEntryPoint?.renderedContent === "string"
      ? raw.searchEntryPoint.renderedContent
      : undefined;
  return {
    text,
    grounding: {
      sources,
      citations,
      queries: queries.slice(0, 128),
      ...(html && html.length <= 100000 ? { searchEntryPointHtml: html } : {}),
    },
    searchQueries: Array.isArray(raw?.webSearchQueries)
      ? queries.length
      : undefined,
  };
}
