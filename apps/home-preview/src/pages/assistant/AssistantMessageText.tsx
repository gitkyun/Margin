import { useMemo, type ComponentProps } from "react";
import Markdown from "react-markdown";
import { t } from "@/lib/i18n";
import type { AIContext } from "@/lib/domain";

interface AssistantMessageTextProps {
  text: string;
  contexts: AIContext[];
  onOpenSources?: () => void;
}

const CITATION_PATTERN = /\[근거\s*(\d+)\]/g;
const CITATION_HREF = /^#cite-(\d+)$/;
/** 답변에서 보여 줄 서식. 제목·표·그림·원문 HTML은 쓰지 않고 안쪽 글만 남겨요. */
const ALLOWED_ELEMENTS = [
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

/** `[근거 1]`을 마크다운 링크(`#cite-1`)로 바꿔 화면에서 출처 배지로 그려요. */
export function citationsToLinks(text: string): string {
  return text.replace(
    CITATION_PATTERN,
    (_, n: string) => `[근거 ${n}](#cite-${n})`, // i18n-ignore: 모델과 맞춘 표식
  );
}

/**
 * 연구 도우미 답변. 굵게·목록·인용·코드 같은 간단한 서식을 보여 주고,
 * 본문의 [근거 1] 표식은 클릭 가능한 출처 배지로 바꿉니다(Kokonut UI AI Inline Citations 패턴).
 * 첨부 근거가 있으면 아래에 요약 칩을 둡니다. 원문 HTML과 그림은 그리지 않습니다.
 */
export function AssistantMessageText({
  text,
  contexts,
  onOpenSources,
}: AssistantMessageTextProps) {
  const markdown = useMemo(() => citationsToLinks(text), [text]);
  const components = useMemo(
    () => ({
      a({ href, children }: ComponentProps<"a">) {
        const cite = CITATION_HREF.exec(href ?? "");
        if (cite) {
          const index = Number(cite[1]) - 1;
          const source = contexts[index];
          // 보내지 않은 번호는 배지 대신 적힌 그대로 둬요.
          if (!source) return <>{`[근거 ${index + 1}]`}</>; // i18n-ignore: 모델과 맞춘 표식
          return (
            <button
              type="button"
              className="ai-inline-citation"
              title={source.title}
              aria-label={t("근거 {number}: {title}", {
                number: index + 1,
                title: source.title,
              })}
              onClick={onOpenSources}
            >
              <span className="ai-inline-citation-num">{index + 1}</span>
              <span className="ai-inline-citation-label">{source.title}</span>
            </button>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    }),
    [contexts, onOpenSources],
  );
  return (
    <div className="ai-message-content">
      <div className="ai-message-body">
        <Markdown
          allowedElements={ALLOWED_ELEMENTS}
          unwrapDisallowed
          components={components}
        >
          {markdown}
        </Markdown>
      </div>
      {contexts.length > 0 && (
        <div className="ai-citation-strip" aria-label={t("참조한 근거")}>
          {contexts.map((c, idx) => (
            <button
              key={`${c.kind}-${c.id}`}
              type="button"
              className="ai-citation-chip"
              onClick={onOpenSources}
            >
              <span>{idx + 1}</span>
              <strong>{c.title}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
