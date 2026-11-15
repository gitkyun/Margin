import { describe, expect, it } from "vitest";
import { emptyWorkspace, type WorkspaceData } from "./domain";
import { bodyEntries, buildCommands, rankSections } from "./command-items";
import { bodyExcerpt } from "./hangul-search";

const R = "r1";

function fixture(): WorkspaceData {
  const base = {
    researchId: R,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
  };
  const data = emptyWorkspace();
  return {
    ...data,
    researches: [
      {
        id: R,
        ownerId: "u1",
        name: "연구",
        description: "",
        createdAt: "x",
        updatedAt: "x",
      },
    ],
    meetings: [
      {
        ...base,
        id: "m1",
        title: "3차 미팅",
        memo: "선행연구 비교표를\n다시 만들기로 했어요.",
      },
      {
        ...base,
        id: "m2",
        title: "보관한 미팅",
        memo: "비교표",
        archivedAt: "2026-11-02",
      },
      {
        ...base,
        id: "m3",
        researchId: "r2",
        title: "다른 연구",
        memo: "비교표",
      },
    ] as unknown as WorkspaceData["meetings"],
    feedback: [
      {
        ...base,
        id: "f1",
        title: "연구 질문",
        body: "연구 질문을 비교표와 맞춰 주세요.",
        updatedAt: "2026-11-05",
      },
    ] as unknown as WorkspaceData["feedback"],
    reviews: [
      {
        ...base,
        id: "q1",
        title: "2장 검토",
        professorEmail: "p@x.kr",
        status: "shared",
      },
    ] as unknown as WorkspaceData["reviews"],
    rounds: [
      {
        id: "rd1",
        requestId: "q1",
        itemId: "i1",
        number: 1,
        title: "",
        description: "",
        feedbackExcerpt: "",
        location: "",
        createdAt: "x",
      },
    ] as unknown as WorkspaceData["rounds"],
    comments: [
      {
        id: "c1",
        roundId: "rd1",
        userId: "p",
        authorName: "김교수",
        body: "비교표 p.4를 보세요",
        resolved: false,
        createdAt: "2026-11-06",
      },
      {
        id: "c2",
        roundId: "rd1",
        userId: "p",
        authorName: "김교수",
        body: "비교표 삭제됨",
        resolved: false,
        createdAt: "2026-11-07",
        deletedAt: "2026-11-08",
      },
    ],
  };
}

describe("bodyExcerpt", () => {
  it("returns a short excerpt around a plain match, ignoring case and line breaks", () => {
    const excerpt = bodyExcerpt(
      "A long Memo\nabout the Comparison table",
      "comparison",
    );
    expect(excerpt).toMatchObject({
      before: "A long Memo about the ",
      match: "Comparison",
      after: " table",
      clippedStart: false,
      clippedEnd: false,
    });
  });

  it("clips long text and ignores one-letter or missing queries", () => {
    const long = `${"가".repeat(60)}비교표${"나".repeat(200)}`;
    const excerpt = bodyExcerpt(long, "비교표")!;
    expect(excerpt.clippedStart).toBe(true);
    expect(excerpt.clippedEnd).toBe(true);
    expect(excerpt.before).toHaveLength(24);
    expect(bodyExcerpt(long, "비")).toBeNull();
    expect(bodyExcerpt(long, "없는 말")).toBeNull();
  });
});

describe("bodyEntries", () => {
  it("finds meeting memos, feedback and comments of this research only", () => {
    const entries = bodyEntries(fixture(), R, "비교표");
    expect(entries.map((e) => e.id)).toEqual([
      "body:comments:c1",
      "body:feedback:f1",
      "body:meetings:m1",
    ]);
    const [comment, feedback, meeting] = entries;
    expect(comment.action.to).toBe("/reviews/q1?round=rd1&item=i1");
    expect(comment.hint).toContain("김교수");
    expect(feedback.action.to).toBe(`/r/${R}/feedback/f1`);
    expect(meeting.action.to).toBe(`/r/${R}/meetings/m1?tab=record`);
    expect(meeting.excerpt?.match).toBe("비교표");
  });

  it("adds a body section only while searching inside a research", () => {
    const searching = buildCommands({
      data: fixture(),
      researchId: R,
      searching: true,
      query: "비교표",
    });
    expect(searching.some((s) => s.id === "bodies")).toBe(true);
    const ranked = rankSections(searching, "비교표");
    expect(ranked.find((s) => s.id === "bodies")?.entries).toHaveLength(3);
    const idle = buildCommands({
      data: fixture(),
      researchId: R,
      searching: false,
      query: "",
    });
    expect(idle.some((s) => s.id === "bodies")).toBe(false);
    const outside = buildCommands({
      data: fixture(),
      searching: true,
      query: "비교표",
    });
    expect(outside.some((s) => s.id === "bodies")).toBe(false);
  });
});
