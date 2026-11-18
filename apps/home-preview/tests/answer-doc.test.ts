// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  answerBlocks,
  answerDocument,
  draftTitle,
  inline,
} from "@/lib/answer-doc";

const answer = [
  "## 다음 미팅 준비",
  "지난 미팅에서 나온 할 일은 **세 가지**예요 [근거 1].",
  "",
  "- 비교표 기준 보완 [근거 2, 3]",
  "- 인터뷰 질문지 고치기",
  "1. 먼저 표",
  "2. 그다음 질문지",
  "",
  "마지막 문단.",
].join("\n");

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("answer → 글 (IA v2 06 §2.4)", () => {
  it("제목·문단·글머리·번호 목록으로 나누고 근거 표시는 뺀다", () => {
    const blocks = answerBlocks(answer);
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "orderedList",
      "paragraph",
    ]);
    const { text } = answerDocument(answer);
    expect(text).not.toContain("[근거");
    expect(text).toContain("세 가지예요.");
  });

  it("**굵게**만 굵은 글자로 바꾼다", () => {
    expect(inline("a **b** c")).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: " c" },
    ]);
  });

  it("편집기에 그대로 넣을 수 있는 문서이고, 평문도 편집기 평문과 같다", () => {
    const { content, text } = answerDocument(answer);
    editor = new Editor({ extensions: [StarterKit], content });
    expect(editor.getText()).toBe(text);
    editor.commands.setContent({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    editor.chain().focus("end").insertContent(answerBlocks(answer)).run();
    expect(editor.getText()).toContain("인터뷰 질문지 고치기");
  });

  it("제목 후보는 첫 제목 줄, 없으면 질문, 그것도 없으면 기본 이름", () => {
    expect(draftTitle(answer, "질문")).toBe("다음 미팅 준비");
    expect(draftTitle("그냥 문단", "이번 주 할 일 정리해 줘")).toBe(
      "이번 주 할 일 정리해 줘",
    );
    expect(draftTitle("문단")).toBe("연구 도우미 답");
    expect(answerBlocks("")).toEqual([{ type: "paragraph" }]);
  });
});
