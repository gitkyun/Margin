import { useMemo, type ComponentProps } from "react";
import Markdown from "react-markdown";
import { WebGroundedText, type WebGroundingData } from "./WebGroundedText";
import AICitations from "@/components/kokonut/ai-citations";
import { t } from "@/lib/i18n";
import type { AIContext } from "@/lib/domain";
interface AssistantMessageTextProps {
  text: string;
  contexts: AIContext[];
  onOpenSources?: (index?: number) => void;
  webGrounding?: WebGroundingData;
}
const CITATION_PATTERN = /\[근거\s*(\d+)\]/g;
const CITATION_HREF = /^#cite-(\d+)$/;
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
export function citationsToLinks(text: string): string {
  return text.replace(
    CITATION_PATTERN,
    (_, n: string) => `[근거 ${n}](#cite-${n})`, // i18n-ignore: protocol
  ); // i18n-ignore: 모델과 맞춘 표식
}
/** 원본 인용 칩·한 개의 움직이는 미리보기·출처 스택을 실제 근거와 Markdown에 연결합니다. */
export function AssistantMessageText({
  text,
  contexts,
  onOpenSources,
  webGrounding,
}: AssistantMessageTextProps) {
  const markdown = useMemo(() => citationsToLinks(text), [text]);
  const cited = [
    ...new Set(
      [...text.matchAll(CITATION_PATTERN)]
        .map((match) => Number(match[1]) - 1)
        .filter((index) => !!contexts[index]),
    ),
  ];
  if (webGrounding)
    return <WebGroundedText text={text} grounding={webGrounding} />;
  return (
    <div className="ai-message-content">
      <div className="ai-message-body">
        <AICitations
          parts={cited.map((index) => ({ text: "", cite: [String(index)] }))}
          sources={cited.map((index) => ({
            id: String(index),
            title: contexts[index].title,
            url: `#source-${index + 1}`,
            site: contextKindLabel(contexts[index].kind),
            snippet: contexts[index].text?.trim(),
          }))}
          onOpenSource={(id) => onOpenSources?.(Number(id))}
          renderAnswer={(citation) => (
            <div className="ai-markdown">
              <Markdown
                allowedElements={ALLOWED_ELEMENTS}
                unwrapDisallowed
                components={{
                  a({ href, children }: ComponentProps<"a">) {
                    const cite = CITATION_HREF.exec(href ?? "");
                    if (cite) {
                      const index = Number(cite[1]) - 1;
                      const part = cited.indexOf(index);
                      return part < 0 ? (
                        <>{`[근거 ${index + 1}]` /* i18n-ignore: protocol */}</>
                      ) : (
                        citation(part)
                      ); // i18n-ignore: 모델과 맞춘 표식
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {markdown}
              </Markdown>
            </div>
          )}
        />
      </div>
    </div>
  );
}
