import { formatDateTime } from "@/lib/domain";
import { dateLocale } from "@/lib/i18n";
import { timeParts } from "@/lib/time-format";

export interface OutlineEntry {
  /** 본문의 제목(h1~h3) 가운데 몇 번째인지. 화면에서 같은 순서의 제목 요소를 찾을 때 씁니다. */
  index: number;
  level: 1 | 2 | 3;
  text: string;
}

/**
 * 글 편집 화면 목차(IA v2 05 §3.1). 본문 JSON의 제목을 문서 순서대로 모두 뽑습니다.
 * 빈 제목도 자리를 지켜야 화면의 제목 요소와 번호가 어긋나지 않습니다.
 */
export function editorOutline(content: unknown): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: string;
      attrs?: { level?: number };
      content?: unknown[];
    };
    if (n.type === "heading") {
      const level = n.attrs?.level;
      out.push({
        index: out.length,
        level: level === 2 || level === 3 ? level : 1,
        text: (n.content ?? [])
          .map((c) => (c as { text?: string }).text ?? "")
          .join("")
          .trim(),
      });
      return;
    }
    for (const child of n.content ?? []) walk(child);
  };
  walk(content);
  return out;
}

/** 마지막 저장 시각: 오늘이면 시각만(14:02), 아니면 날짜와 시각. */
export function savedTime(value?: string | null, now = new Date()): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "";
  const today =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return today
    ? new Intl.DateTimeFormat(dateLocale(), timeParts()).format(d)
    : formatDateTime(value);
}
