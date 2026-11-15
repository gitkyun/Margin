import { useMemo, useState, type ComponentProps } from "react";
import Markdown from "react-markdown";
import { t } from "@/lib/i18n";
import type { AIContext } from "@/lib/domain";

interface AssistantMessageTextProps {
  text: string;
  contexts: AIContext[];
  onOpenSources?: (index?: number) => void;
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

function contextKindLabel(kind: AIContext["kind"]): string {
  if (kind === "meetings") return t("미팅 메모");
  if (kind === "feedback") return t("피드백");
  if (kind === "documents") return t("문서");
  if (kind === "versions") return t("파일 버전");
  if (kind === "attachments") return t("첨부 자료");
  if (kind === "tasks") return t("할 일");
  return t("연구 단계");
}

/** `[근거 1]`을 마크다운 링크(`#cite-1`)로 바꿔 화면에서 출처 배지로 그려요. */
export function citationsToLinks(text: string): string {
  return text.replace(
    CITATION_PATTERN,
    (_, n: string) => `[근거 ${n}](#cite-${n})`, // i18n-ignore: 모델과 맞춘 표식
  );
}

/**
 * 연구 도우미 답변(Kokonut AI Inline Citations).
 * 본문의 [근거 N] 표식에 호버·포커스하면 출처 스냅샷 미리보기가 뜨고,
 * 아래 출처 칩과 같은 번호를 함께 강조해요.
 */
export function AssistantMessageText({
  text,
  contexts,
  onOpenSources,
}: AssistantMessageTextProps) {
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const markdown = useMemo(() => citationsToLinks(text), [text]);
  const components = useMemo(
    () => ({
      a({ href, children }: ComponentProps<"a">) {
        const cite = CITATION_HREF.exec(href ?? "");
        if (cite) {
          const index = Number(cite[1]) - 1;
          const source = contexts[index];
          if (!source) return <>{`[근거 ${index + 1}]`}</>; // i18n-ignore: 모델과 맞춘 표식
          const isActive = activeCite === index;
          const snippet = source.text?.trim().slice(0, 140);
          return (
            <span
              className="ai-citation-wrap"
              onMouseEnter={() => setActiveCite(index)}
              onMouseLeave={() =>
                setActiveCite((cur) => (cur === index ? null : cur))
              }
            >
              <button
                type="button"
                className={`ai-inline-citation${isActive ? " is-highlighted" : ""}`}
                title={source.title}
                aria-label={t("근거 {number}: {title}", {
                  number: index + 1,
                  title: source.title,
                })}
                onFocus={() => setActiveCite(index)}
                onBlur={() =>
                  setActiveCite((cur) => (cur === index ? null : cur))
                }
                onClick={() => onOpenSources?.(index)}
              >
                <span className="ai-inline-citation-num">{index + 1}</span>
                <span className="ai-inline-citation-label">{source.title}</span>
              </button>
              {isActive && (
                <span className="ai-citation-preview" role="tooltip">
                  <small>{contextKindLabel(source.kind)}</small>
                  <strong>{source.title}</strong>
                  {source.page && (
                    <small>{t("{page}쪽", { page: source.page })}</small>
                  )}
                  {snippet && <p>{snippet}</p>}
                </span>
              )}
            </span>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    }),
    [contexts, onOpenSources, activeCite],
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
              className={`ai-citation-chip${activeCite === idx ? " is-highlighted" : ""}`}
              onMouseEnter={() => setActiveCite(idx)}
              onMouseLeave={() =>
                setActiveCite((cur) => (cur === idx ? null : cur))
              }
              onFocus={() => setActiveCite(idx)}
              onBlur={() => setActiveCite((cur) => (cur === idx ? null : cur))}
              onClick={() => onOpenSources?.(idx)}
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
