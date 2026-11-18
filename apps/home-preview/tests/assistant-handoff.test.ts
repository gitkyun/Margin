import { describe, expect, it } from "vitest";
import { handoffState, readHandoff } from "../src/lib/assistant-handoff";

describe("사이드 창 → 연구 도우미 화면 넘겨주기", () => {
  it("보낸 질문과 대화를 그대로 돌려받는다", () => {
    expect(readHandoff(handoffState({ ask: " 핵심만 " }))).toEqual({
      ask: "핵심만",
    });
    expect(readHandoff(handoffState({ conversationId: "c1" }))).toEqual({
      conversationId: "c1",
    });
  });

  it("다른 state나 틀린 모양, 빈 질문은 버린다", () => {
    expect(readHandoff(null)).toBeNull();
    expect(readHandoff({ settingsOpened: true })).toBeNull();
    expect(readHandoff({ assistantHandoff: "x" })).toBeNull();
    expect(readHandoff(handoffState({ ask: "   " }))).toBeNull();
    expect(
      readHandoff({ assistantHandoff: { ask: 3, conversationId: {} } }),
    ).toBeNull();
  });

  it("'지금 보는 기록' 칩은 받는 종류만 하나, 필요한 칸만 넘긴다", () => {
    expect(
      readHandoff(
        handoffState({
          ask: "정리해 줘",
          contexts: [
            {
              kind: "meetings",
              id: "m1",
              title: "제6차",
              revision: 3,
              text: "본문은 넘기지 않음",
            },
          ],
        }),
      ),
    ).toEqual({
      ask: "정리해 줘",
      contexts: [{ kind: "meetings", id: "m1", title: "제6차", revision: 3 }],
    });
    expect(
      readHandoff({
        assistantHandoff: {
          contexts: [{ kind: "attachments", id: "a", title: "x" }],
        },
      }),
    ).toBeNull();
    expect(
      readHandoff({
        assistantHandoff: {
          contexts: [{ kind: "documents", id: "d", title: "x", revision: "1" }],
        },
      }),
    ).toBeNull();
  });
});
