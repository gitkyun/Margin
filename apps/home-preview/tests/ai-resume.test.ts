// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  assistantMessage,
  claimRun,
  clearPendingRun,
  loadPendingRun,
  savePendingRun,
  type PendingRun,
} from "@/lib/ai-resume";

const run: PendingRun = {
  runId: "run-1",
  researchId: "r1",
  conversationId: "c1",
  mode: "ask_research",
  startedAt: 1000,
  steps: [{ doing: "읽는 중", done: "읽음" }],
  webSearch: false,
  calendar: false,
  contexts: [],
};

describe("화면을 떠났다 돌아와 답 이어 받기", () => {
  beforeEach(() => localStorage.clear());

  it("보낸 실행을 연구별로 적어 두고 다시 읽는다", () => {
    savePendingRun(run);
    expect(loadPendingRun("r1")).toEqual(run);
    expect(loadPendingRun("r2")).toBeNull();
  });

  it("다른 실행 번호로는 지우지 않는다(그 사이 새 질문을 보낸 경우)", () => {
    savePendingRun(run);
    clearPendingRun("r1", "run-old");
    expect(loadPendingRun("r1")?.runId).toBe("run-1");
    clearPendingRun("r1", "run-1");
    expect(loadPendingRun("r1")).toBeNull();
  });

  it("같은 실행은 한 번만 이어 받는다", () => {
    expect(claimRun("run-claim")).toBe(true);
    expect(claimRun("run-claim")).toBe(false);
  });

  it("이어 받은 답도 바로 받은 답과 같은 모양으로 남긴다", () => {
    const message = assistantMessage(
      {
        candidates: [
          {
            title: "방안",
            method: "기준표 보완",
            suggestedTasks: ["표 고치기"],
          },
        ] as never,
        runId: "run-1",
      },
      {
        createdAt: "2026-11-19T00:00:00Z",
        steps: ["읽음"],
        elapsedMs: 12000,
        webSearch: false,
        calendar: false,
        contexts: [],
        candidateText: (c) => `${c.title}: ${c.method}`,
      },
    );
    expect(message).toMatchObject({
      role: "assistant",
      text: "방안: 기준표 보완",
      runId: "run-1",
      elapsedMs: 12000,
      suggestedTasks: ["표 고치기"],
    });
  });
});
