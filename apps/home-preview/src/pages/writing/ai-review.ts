import { Extension } from "@tiptap/react";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** 문서 안의 위치 범위(ProseMirror 위치) */
export interface DocRange {
  from: number;
  to: number;
}

/**
 * AI 문장 점검의 기준 범위. 점검을 시작할 때의 범위·글자를 기억하고, 편집을 따라 위치를 옮겨요.
 * `expected`는 이 범위에 있어야 할 글자예요. 사용자가 범위 안을 직접 고치면 지금 글자와 달라져
 * ‘원문이 바뀜’(stale)으로 보고 반영을 막아요. 이 화면이 반영한 변경은 expected도 함께 바꿔요.
 */
export interface ReviewRangeState {
  range: DocRange | null;
  expected: string;
  /** 지금 확인 중인 제안의 원문 위치(인라인 강조) */
  focus: DocRange | null;
}

type ReviewMeta =
  | { type: "start"; range: DocRange }
  | { type: "focus"; focus: DocRange | null }
  | { type: "applied" }
  | { type: "clear" };

export const aiReviewKey = new PluginKey<ReviewRangeState>("margin-ai-review");

/** 블록 사이 구분(서버 문서 text·연구 도우미 선택 문단과 같은 규칙) */
export const BLOCK_SEPARATOR = "\n\n";

export function rangeText(doc: ProseNode, range: DocRange): string {
  return doc.textBetween(range.from, range.to, BLOCK_SEPARATOR);
}

const EMPTY: ReviewRangeState = { range: null, expected: "", focus: null };

/** 범위 표시와 원문 강조. 문서 JSON에는 아무것도 남기지 않아요(꾸밈만). */
export const AIReviewHighlight = Extension.create({
  name: "marginAIReview",
  addProseMirrorPlugins() {
    return [
      new Plugin<ReviewRangeState>({
        key: aiReviewKey,
        state: {
          init: () => EMPTY,
          apply(tr, value, _old, next) {
            const meta = tr.getMeta(aiReviewKey) as ReviewMeta | undefined;
            if (meta?.type === "clear") return EMPTY;
            if (meta?.type === "start")
              return {
                range: meta.range,
                expected: rangeText(next.doc, meta.range),
                focus: null,
              };
            if (meta?.type === "focus") return { ...value, focus: meta.focus };
            if (!value.range || !tr.docChanged) return value;
            const from = tr.mapping.map(value.range.from, 1);
            const to = Math.max(from, tr.mapping.map(value.range.to, -1));
            const range = { from, to };
            return {
              range,
              // 이 화면이 반영한 변경은 기준 글자도 함께 바꿔요.
              expected:
                meta?.type === "applied"
                  ? rangeText(next.doc, range)
                  : value.expected,
              focus: null,
            };
          },
        },
        props: {
          decorations(state) {
            const value = aiReviewKey.getState(state);
            if (!value?.range || value.range.from >= value.range.to)
              return null;
            const marks = [
              Decoration.inline(value.range.from, value.range.to, {
                class: "writing-ai-range",
              }),
            ];
            if (value.focus && value.focus.from < value.focus.to)
              marks.push(
                Decoration.inline(value.focus.from, value.focus.to, {
                  class: "writing-ai-quote",
                }),
              );
            return DecorationSet.create(state.doc, marks);
          },
        },
      }),
    ];
  },
});

export const reviewMeta = (meta: ReviewMeta) => meta;

/** 사용자가 점검 범위 안을 직접 고쳤거나 범위가 사라졌으면 true */
export function isReviewStale(state: EditorState): boolean {
  const value = aiReviewKey.getState(state);
  if (!value?.range) return false;
  if (value.range.from >= value.range.to) return true;
  return rangeText(state.doc, value.range) !== value.expected;
}

/**
 * 범위 안에서 발췌(quote)의 정확한 위치를 찾아요. 한 문단 안에 있는 연속된 글자만 찾고,
 * 여러 문단에 걸치거나 없으면 null이에요(그때는 사용자가 직접 고쳐요).
 */
export function findQuoteRange(
  doc: ProseNode,
  quote: string,
  within: DocRange,
): DocRange | null {
  const needle = quote.trim();
  if (!needle) return null;
  let found: DocRange | null = null;
  doc.nodesBetween(within.from, within.to, (node, pos) => {
    if (found) return false;
    if (!node.isTextblock) return true;
    // 글자마다 문서 위치를 적어 두면 줄바꿈 같은 글자 아닌 노드가 있어도 위치가 맞아요.
    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++)
          positions.push(pos + 1 + offset + i);
        text += child.text;
      } else {
        positions.push(pos + 1 + offset);
        text += "￼";
      }
    });
    let index = text.indexOf(needle);
    while (index !== -1) {
      const from = positions[index];
      const to = positions[index + needle.length - 1] + 1;
      if (from >= within.from && to <= within.to) {
        found = { from, to };
        break;
      }
      index = text.indexOf(needle, index + 1);
    }
    return false;
  });
  return found;
}

const QUOTED = /[“"「『‘]([^“”"「」『』‘’\n]{2,})[”"」』’]/g;

/**
 * AI가 ‘어떻게 고칠지’에 적은 고친 문장 예시를 꺼내요(따옴표 안 문장).
 * 원문 발췌와 같은 문장과 너무 짧은 용어는 빼고 마지막 예시를 써요.
 * 찾지 못하면 원문을 그대로 돌려줘 사용자가 직접 고치게 해요.
 */
export function suggestedSentence(
  method: string,
  quote: string,
): { text: string; fromAI: boolean } {
  const original = quote.trim();
  const minLength = Math.max(4, Math.floor(original.length / 2));
  const candidates = [...method.matchAll(QUOTED)]
    .map((match) => match[1].trim())
    .filter((text) => text !== original && text.length >= minLength);
  const picked = candidates.at(-1);
  return picked
    ? { text: picked, fromAI: true }
    : { text: original, fromAI: false };
}
