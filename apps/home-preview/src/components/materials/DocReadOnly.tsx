import type { ReactNode } from "react";

/** 글 본문(Tiptap JSON)의 한 마디. 편집기와 같은 StarterKit·표 노드만 그리고, 모르는 노드는 안쪽만 그립니다. */
interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
}

/** 링크는 http(s)·mailto만 누를 수 있게 둡니다(그 밖의 주소는 글자로만). */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function inline(node: DocNode, key: number): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type !== "text") return children(node);
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "strike") out = <s>{out}</s>;
    else if (mark.type === "underline") out = <u>{out}</u>;
    else if (mark.type === "code") out = <code>{out}</code>;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (href)
        out = (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {out}
          </a>
        );
    }
  }
  return <span key={key}>{out}</span>;
}

function children(node: DocNode): ReactNode {
  return (node.content ?? []).map((child, i) => block(child, i));
}

function block(node: DocNode, key: number): ReactNode {
  switch (node.type) {
    case "text":
    case "hardBreak":
      return inline(node, key);
    case "paragraph":
      return <p key={key}>{children(node)}</p>;
    case "heading": {
      // 창 안 제목은 h3부터 씁니다(창 머리가 h2).
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      const Tag = `h${Math.min(6, level + 2)}` as "h3";
      return <Tag key={key}>{children(node)}</Tag>;
    }
    case "bulletList":
      return <ul key={key}>{children(node)}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(node.attrs?.start) || undefined}>
          {children(node)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children(node)}</li>;
    case "blockquote":
      return <blockquote key={key}>{children(node)}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children(node)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} />;
    case "table":
      return (
        <div key={key} className="doc-read-table">
          <table>
            <tbody>{children(node)}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children(node)}</tr>;
    case "tableHeader":
      return <th key={key}>{children(node)}</th>;
    case "tableCell":
      return <td key={key}>{children(node)}</td>;
    default:
      return <div key={key}>{children(node)}</div>;
  }
}

/** 자료 창의 글 훑어보기(06 §5): 고칠 수 없는 본문입니다. */
export function DocReadOnly({ content }: { content: unknown }) {
  const root =
    content && typeof content === "object" ? (content as DocNode) : {};
  return <div className="doc-read">{children(root)}</div>;
}
