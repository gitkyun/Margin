import { describe, expect, it } from "vitest";
import {
  QUESTION_MAX,
  draftQuestion,
  draftRequestMax,
  lastAsked,
  nextSteps,
} from "@/lib/assistant-next";
import type { AIConversationMessage } from "@/lib/domain";

const msg = (
  role: "user" | "assistant",
  extra: Partial<AIConversationMessage> = {},
): AIConversationMessage => ({
  role,
  text: role,
  createdAt: "2026-11-18T00:00:00.000Z",
  ...extra,
});

describe("초안 쓰기 (IA v2 06 §2.3)", () => {
  it("정해 둔 지시문 뒤에 사용자의 요청을 붙인다", () => {
    const q = draftQuestion("서론 초안");
    expect(q).toContain("글 초안을 써 줘");
    expect(q.endsWith("요청: 서론 초안")).toBe(true);
  });

  it("지시문을 붙여도 서버 질문 한도(2,000자)를 넘지 않는 요청 길이", () => {
    const max = draftRequestMax();
    expect(max).toBeGreaterThan(1500);
    expect(draftQuestion("가".repeat(max)).length).toBe(QUESTION_MAX);
  });
});

describe("이어서 (IA v2 06 §2.4)", () => {
  const ids = (
    asked: Parameters<typeof nextSteps>[0],
    canSuggestEdits = false,
  ) => nextSteps(asked, { canSuggestEdits }).map((s) => s.id);

  it("요청 종류별로 정해 둔 목록", () => {
    expect(ids({ mode: "organize_meeting" })).toEqual(["revisions", "draft"]);
    expect(ids({ mode: "suggest_revisions" })).toEqual(["draft"]);
    expect(ids({ mode: "ask_research", draft: true })).toEqual([
      "save",
      "shorter",
      "longer",
    ]);
    expect(ids({ mode: "ask_research" })).toEqual([]);
    expect(ids({ mode: "plan_research" })).toEqual([]);
    expect(ids(undefined)).toEqual([]);
  });

  it("원고 검토 뒤 수정 제안 받기는 그 글이 열려 있을 때만", () => {
    expect(ids({ mode: "review_writing" })).toEqual([]);
    expect(ids({ mode: "review_writing" }, true)).toEqual(["suggest_edits"]);
  });

  it("웹 검색·일정 확인 답에는 이어서가 없다", () => {
    expect(ids({ mode: "ask_research", draft: true, webSearch: true })).toEqual(
      [],
    );
    expect(ids({ mode: "organize_meeting", calendar: true })).toEqual([]);
  });

  it("채우는 칩은 요청 종류와 질문을 함께 준다", () => {
    const [revisions, draft] = nextSteps(
      { mode: "organize_meeting" },
      { canSuggestEdits: false },
    );
    expect(revisions).toMatchObject({
      kind: "fill",
      mode: "suggest_revisions",
    });
    expect(draft).toMatchObject({ kind: "fill", draft: true });
  });

  it("답을 낳은 요청은 그 답 앞의 가장 가까운 사용자 메시지", () => {
    const messages = [
      msg("user", { mode: "organize_meeting" }),
      msg("assistant"),
      msg("user", { mode: "ask_research", draft: true }),
      msg("assistant"),
    ];
    expect(lastAsked(messages, 1)?.mode).toBe("organize_meeting");
    expect(lastAsked(messages, 3)?.draft).toBe(true);
    expect(lastAsked(messages)?.draft).toBe(true);
    expect(lastAsked([])).toBeUndefined();
  });
});
