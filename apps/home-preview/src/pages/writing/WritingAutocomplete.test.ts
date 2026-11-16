// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AIAutocompleteGhost,
  aiAutocompleteKey,
  continuationExcerpt,
} from "./WritingAutocomplete";

let editor: Editor;
afterEach(() => editor?.destroy());
function suggest() {
  editor = new Editor({
    extensions: [StarterKit, AIAutocompleteGhost],
    content: "<p>original text</p>",
  });
  editor.commands.setTextSelection(5);
  editor.view.dispatch(
    editor.state.tr.setMeta(aiAutocompleteKey, {
      type: "set",
      text: "suggested words",
      pos: 5,
    }),
  );
}

describe("이어쓰기 제안의 유효 범위", () => {
  it("제안은 보이지만 저장할 원문에는 섞이지 않는다", () => {
    suggest();
    expect(
      editor.view.dom.querySelector(".writing-autocomplete-ghost-inline")
        ?.textContent,
    ).toContain("suggested words");
    expect(editor.getText()).toBe("original text");
    expect(editor.getHTML()).not.toContain("suggested words");
  });
  it("다른 위치로 커서를 옮기면 제안을 지운다", () => {
    suggest();
    editor.commands.setTextSelection(8);
    expect(aiAutocompleteKey.getState(editor.state)?.text).toBe("");
    expect(
      editor.view.dom.querySelector(".writing-autocomplete-ghost-inline"),
    ).toBeNull();
  });
  it("제안이 도착한 뒤 원문을 고치면 제안을 지운다", () => {
    suggest();
    editor.commands.insertContent("new");
    expect(aiAutocompleteKey.getState(editor.state)?.text).toBe("");
    expect(editor.getText()).not.toContain("suggested words");
  });
});

it("문서 중간 이어쓰기에는 커서 뒤 문단을 보내지 않는다", () => {
  editor = new Editor({
    extensions: [StarterKit],
    content: "<p>first paragraph</p><p>last paragraph</p>",
  });
  editor.commands.setTextSelection(6);
  expect(continuationExcerpt(editor)).toBe("first");
});
