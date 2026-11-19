// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { takeAlongMeeting, withVersion } from "../src/lib/materials-panel";
import { DocReadOnly, safeHref } from "../src/components/materials/DocReadOnly";
import type { Meeting } from "../src/lib/domain";

afterEach(cleanup);

function meeting(patch: Partial<Meeting> = {}): Meeting {
  return {
    id: "m1",
    researchId: "r1",
    title: "제6차 논문 지도",
    date: "2026-11-20",
    time: "14:00",
    status: "preparing",
    goal: "",
    memo: "",
    memoRevision: 0,
    taskIds: [],
    versionIds: [],
    questionIds: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...patch,
  } as Meeting;
}

describe("자료 창의 [이 미팅에 가져가기](06 §5)", () => {
  it("본문에 연 준비 중인 미팅만 고른다", () => {
    const list = [meeting()];
    expect(takeAlongMeeting("/r/r1/meetings/m1", list, "r1")?.id).toBe("m1");
    expect(takeAlongMeeting("/r/r1/meetings/m1/", list, "r1")?.id).toBe("m1");
    expect(takeAlongMeeting("/r/r1/meetings", list, "r1")).toBeNull();
    expect(takeAlongMeeting("/r/r1/docs", list, "r1")).toBeNull();
    expect(takeAlongMeeting("/r/r2/meetings/m1", list, "r2")).toBeNull();
  });

  it("기록한 미팅·서면 피드백·보관한 미팅에는 두지 않는다", () => {
    for (const patch of [
      { status: "recorded" as const },
      { recordType: "written" as const },
      { archivedAt: "2026-11-02T00:00:00Z" },
    ])
      expect(
        takeAlongMeeting("/r/r1/meetings/m1", [meeting(patch)], "r1"),
      ).toBeNull();
  });

  it("자료 판을 보여 줄 자료에 더하고, 이미 있으면 null", () => {
    const next = withVersion(meeting({ versionIds: ["v0"] }), { id: "v1" });
    expect(next?.versionIds).toEqual(["v0", "v1"]);
    expect(withVersion(meeting({ versionIds: ["v1"] }), { id: "v1" })).toBe(
      null,
    );
  });
});

describe("글 훑어보기의 읽기 전용 본문", () => {
  const content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "서론" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "굵게", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          {
            type: "text",
            text: "안전한 링크",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
          {
            type: "text",
            text: "나쁜 링크",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "항목" }] },
            ],
          },
        ],
      },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "칸" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it("제목은 창 머리 아래 단계(h3)부터, 목록·표·굵게를 그린다", () => {
    const { container } = render(<DocReadOnly content={content} />);
    expect(container.querySelector("h3")?.textContent).toBe("서론");
    expect(container.querySelector("strong")?.textContent).toBe("굵게");
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.querySelector("ul li")?.textContent).toBe("항목");
    expect(container.querySelector("table th")?.textContent).toBe("칸");
  });

  it("http(s)·mailto 링크만 누를 수 있다", () => {
    const { container } = render(<DocReadOnly content={content} />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.com/",
    ]);
    expect(container.textContent).toContain("나쁜 링크");
    expect(safeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref(42)).toBeNull();
  });

  it("빈 내용이나 이상한 값에도 오류 없이 빈 본문", () => {
    const { container } = render(<DocReadOnly content={null} />);
    expect(container.querySelector(".doc-read")?.textContent).toBe("");
  });
});
