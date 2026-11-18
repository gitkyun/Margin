import { t } from "@/lib/i18n";

/**
 * 연구 도우미 답을 글(TipTap 문서)로 옮깁니다(IA v2 06 §2.4 [글로 저장]·[이 글에 넣기]).
 * 답은 짧은 Markdown이라 제목(#), 글머리 목록(-, *), 번호 목록(1.), 굵게(**)만 옮기고
 * 그 밖의 표시는 글자 그대로 둡니다. 근거 표시 [근거 n]은 글 안에서 가리킬 곳이 없어 뺍니다.
 */
type Mark = { type: "bold" };
type TextNode = { type: "text"; text: string; marks?: Mark[] };
type Block =
  | { type: "paragraph"; content?: TextNode[] }
  | { type: "heading"; attrs: { level: 1 | 2 | 3 }; content?: TextNode[] }
  | {
      type: "bulletList" | "orderedList";
      content: { type: "listItem"; content: Block[] }[];
    };

const CITATION = /\s*\[근거\s*\d+(?:\s*[,·]\s*\d+)*\]/g;

/** 한 줄 안의 **굵게**를 굵은 글자로 나눕니다. */
export function inline(line: string): TextNode[] {
  const text = line.replace(CITATION, "");
  const nodes: TextNode[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push({ type: "text", text: text.slice(last, at) });
    nodes.push({ type: "text", text: match[1], marks: [{ type: "bold" }] });
    last = at + match[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.filter((n) => n.text.length > 0);
}

const paragraph = (line: string): Block => {
  const content = inline(line);
  return content.length
    ? { type: "paragraph", content }
    : { type: "paragraph" };
};

/** 답 글자를 문단·제목·목록 블록으로 나눕니다. */
export function answerBlocks(answer: string): Block[] {
  const blocks: Block[] = [];
  let list: Extract<Block, { type: "bulletList" | "orderedList" }> | null =
    null;
  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of answer.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const content = inline(heading[2]);
      blocks.push({
        type: "heading",
        attrs: { level: heading[1].length as 1 | 2 | 3 },
        ...(content.length ? { content } : {}),
      });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      const type = bullet ? "bulletList" : "orderedList";
      if (!list || list.type !== type) {
        flush();
        list = { type, content: [] };
      }
      list.content.push({
        type: "listItem",
        content: [paragraph((bullet ?? ordered)![1])],
      });
      continue;
    }
    flush();
    blocks.push(paragraph(line));
  }
  flush();
  return blocks.length ? blocks : [{ type: "paragraph" }];
}

/**
 * 새 글의 본문(JSON)과 평문. 평문은 편집기 `getText()`와 같은 규칙(블록마다 앞에 "\n\n", 맨 앞 제외)이어야
 * 서버가 이 글을 근거·수정 제안 위치로 쓸 때 맞습니다.
 */
export function answerDocument(answer: string): {
  content: { type: "doc"; content: Block[] };
  text: string;
} {
  const content = answerBlocks(answer);
  let text = "";
  let first = true;
  type Node = { type: string; text?: string; content?: Node[] };
  const visit = (node: Node) => {
    if (node.type === "text") {
      text += node.text ?? "";
      return;
    }
    if (!first) text += "\n\n";
    first = false;
    for (const child of node.content ?? []) visit(child);
  };
  for (const block of content) visit(block as Node);
  return { content: { type: "doc", content }, text };
}

/** 저장할 글의 제목 후보: 첫 제목 줄, 없으면 질문 앞부분 */
export function draftTitle(answer: string, question = ""): string {
  const heading = /^#{1,3}\s+(.+)$/m.exec(answer)?.[1];
  const base = (heading ?? question ?? "").replace(CITATION, "").trim();
  return (base || t("연구 도우미 답")).slice(0, 60);
}
