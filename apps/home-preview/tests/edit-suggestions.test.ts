// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor, getTextSerializersFromSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  placeSuggestions,
  textMap,
  toEditorRange,
  toTextOffset,
} from "@/lib/edit-suggestions";

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});
function make(html: string) {
  editor = new Editor({ extensions: [StarterKit], content: html });
  return editor;
}

describe("textMap", () => {
  it("builds the same plain text as editor.getText() (what the server stores)", () => {
    const ed = make(
      "<h1>1. 서론</h1><p>연구 <strong>도구</strong> 사용은 늘고 있다.<br>둘째 줄</p><ul><li><p>항목</p></li></ul>",
    );
    const map = textMap(ed.state.doc, getTextSerializersFromSchema(ed.schema));
    expect(map.text).toBe(ed.getText());
    expect(map.pos).toHaveLength(map.text.length);
  });

  it("maps a quote inside one paragraph to the editor range of the same letters", () => {
    const ed = make(
      "<p>첫 문단.</p><p>연구 <em>도구</em> 사용은 늘고 있다.</p>",
    );
    const map = textMap(ed.state.doc, getTextSerializersFromSchema(ed.schema));
    const start = map.text.indexOf("도구 사용은");
    const range = toEditorRange(map, start, start + "도구 사용은".length)!;
    expect(ed.state.doc.textBetween(range.from, range.to)).toBe("도구 사용은");
    expect(toTextOffset(map, range.from)).toBe(start);
  });

  it("refuses ranges that cross a paragraph or a line break", () => {
    const ed = make("<p>하나</p><p>둘<br>셋</p>");
    const map = textMap(ed.state.doc, getTextSerializersFromSchema(ed.schema));
    expect(
      toEditorRange(map, map.text.indexOf("나"), map.text.indexOf("둘") + 1),
    ).toBeNull();
    expect(
      toEditorRange(map, map.text.indexOf("둘"), map.text.indexOf("셋") + 1),
    ).toBeNull();
    expect(toEditorRange(map, 0, 0)).toBeNull();
  });
});

describe("placeSuggestions", () => {
  it("places each quote nearest to where it was suggested, without overlaps", () => {
    const ed = make("<p>사용은 늘었다. 사용은 늘었다.</p>");
    const map = textMap(ed.state.doc, getTextSerializersFromSchema(ed.schema));
    const second = map.text.lastIndexOf("사용은");
    const placed = placeSuggestions(map, [
      { id: "b", quote: "사용은", hint: second },
      { id: "a", quote: "사용은", hint: second },
    ]);
    expect(placed.map((p) => [p.id, p.start])).toEqual([
      ["a", 0],
      ["b", second],
    ]);
  });

  it("drops a suggestion whose words were edited away", () => {
    const ed = make("<p>연구 도구 사용은 늘었다.</p>");
    const map = textMap(ed.state.doc, getTextSerializersFromSchema(ed.schema));
    expect(
      placeSuggestions(map, [{ id: "x", quote: "늘고 있다", hint: 0 }]),
    ).toEqual([]);
  });
});
