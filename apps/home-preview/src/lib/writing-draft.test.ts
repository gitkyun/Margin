import { describe, expect, it } from "vitest";
import { restoreWritingDraft } from "./writing-draft";

const saved = { type: "doc", content: [{ type: "paragraph" }] };
const edited = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "저장하지 않은 문장" }],
    },
  ],
};

describe("restoreWritingDraft", () => {
  it("keeps a title-only edit after reopening the document", () => {
    expect(
      restoreWritingDraft(
        JSON.stringify({ title: "고친 제목", content: saved }),
        saved,
        "이전 제목",
      )?.title,
    ).toBe("고친 제목");
    expect(
      restoreWritingDraft(
        JSON.stringify({ title: "이전 제목", content: saved }),
        saved,
        "이전 제목",
      ),
    ).toBeNull();
  });
  it("returns the draft when its content differs from the saved document", () => {
    const raw = JSON.stringify({
      title: "고친 제목",
      content: edited,
      baseUpdatedAt: "2026-11-04T10:00:00Z",
    });

    expect(restoreWritingDraft(raw, saved)).toEqual({
      title: "고친 제목",
      content: edited,
      baseUpdatedAt: "2026-11-04T10:00:00Z",
    });
  });

  it("ignores a draft that matches what is already saved", () => {
    const raw = JSON.stringify({ title: "제목", content: saved });
    expect(restoreWritingDraft(raw, saved)).toBeNull();
  });

  it("returns null for a missing, broken or shapeless draft", () => {
    expect(restoreWritingDraft(null, saved)).toBeNull();
    expect(restoreWritingDraft("{not json", saved)).toBeNull();
    expect(
      restoreWritingDraft(JSON.stringify({ title: "x" }), saved),
    ).toBeNull();
    expect(
      restoreWritingDraft(JSON.stringify({ content: "text" }), saved),
    ).toBeNull();
  });

  it("keeps an empty title out so the saved title stays in place", () => {
    const raw = JSON.stringify({ title: "", content: edited });
    expect(restoreWritingDraft(raw, saved)?.title).toBeNull();
  });
});
