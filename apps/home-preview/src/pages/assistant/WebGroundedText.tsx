import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import AICitations from "@/components/kokonut/ai-citations";
import { t } from "@/lib/i18n";

export interface WebGroundingData {
  sources: { url: string; title: string }[];
  citations: {
    startIndex: number;
    endIndex: number;
    sourceIndices: number[];
  }[];
  queries: string[];
  searchEntryPointHtml?: string;
}

export function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Only Google's returned support offsets create inline web citations. */
export function webCitationMarkdown(
  text: string,
  grounding: WebGroundingData,
): string {
  const insertions = new Map<number, Set<number>>();
  for (const citation of grounding.citations) {
    const { startIndex, endIndex } = citation;
    if (
      !Number.isInteger(startIndex) ||
      !Number.isInteger(endIndex) ||
      startIndex < 0 ||
      endIndex <= startIndex ||
      endIndex > text.length
    )
      continue;
    const indices = citation.sourceIndices.filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        !!grounding.sources[index] &&
        !!safeWebUrl(grounding.sources[index].url),
    );
    if (!indices.length) continue;
    const entry = insertions.get(endIndex) ?? new Set<number>();
    indices.forEach((index) => entry.add(index));
    insertions.set(endIndex, entry);
  }
  let result = text;
  for (const [at, indices] of [...insertions].sort(([a], [b]) => b - a)) {
    const marks = [...indices]
      .map(
        (index) =>
          `[${t("웹 근거 {number}", { number: index + 1 })}](#web-cite-${index})`,
      )
      .join(" "); // i18n-ignore: citation protocol
    result = result.slice(0, at) + " " + marks + result.slice(at);
  }
  return result;
}

const SEARCH_HTML_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https:; base-uri 'none'; form-action 'none'">`;
const ELEMENTS = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
];

export function WebGroundedText({
  text,
  grounding,
}: {
  text: string;
  grounding: WebGroundingData;
}) {
  const sources = grounding.sources.flatMap((source, index) => {
    const url = safeWebUrl(source.url);
    return url
      ? [
          {
            id: String(index),
            title: source.title || new URL(url).hostname,
            url,
            site: new URL(url).hostname,
          },
        ]
      : [];
  });
  const markdown = webCitationMarkdown(text, grounding);
  return (
    <div
      className="ai-message-content assistant-web-answer"
      aria-label={t("웹 검색 답변")}
    >
      <p className="assistant-web-answer-label">{t("웹 검색 근거")}</p>
      {!sources.length && (
        <p className="assistant-web-source-warning" role="status">
          {t(
            "확인 가능한 웹 출처가 반환되지 않았어요. 최신 사실은 직접 확인해 주세요.",
          )}
        </p>
      )}
      <AICitations
        parts={sources.map((source) => ({ text: "", cite: [source.id] }))}
        sources={sources}
        renderAnswer={(citation) => (
          <div className="ai-markdown">
            <Markdown
              allowedElements={ELEMENTS}
              unwrapDisallowed
              components={{
                a({ href, children }: ComponentProps<"a">) {
                  const mark = /^#web-cite-(\d+)$/.exec(href ?? "");
                  if (mark) {
                    const part = sources.findIndex(
                      (source) => source.id === mark[1],
                    );
                    return part >= 0 ? citation(part) : <>{children}</>;
                  }
                  const safe = href ? safeWebUrl(href) : null;
                  return safe ? (
                    <a href={safe} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ) : (
                    <>{children}</>
                  );
                },
              }}
            >
              {markdown}
            </Markdown>
          </div>
        )}
      />
      {!!grounding.queries.length && (
        <details className="assistant-web-queries">
          <summary>{t("Google 검색어")}</summary>
          <ul>
            {grounding.queries.map((query, index) => (
              <li key={index}>{query}</li>
            ))}
          </ul>
        </details>
      )}
      {grounding.searchEntryPointHtml && (
        <iframe
          className="assistant-search-suggestions"
          title={t("Google 검색 추천")}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={SEARCH_HTML_CSP + grounding.searchEntryPointHtml}
        />
      )}
    </div>
  );
}
