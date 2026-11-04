import { describe, expect, it } from "vitest";
import type { AIInput } from "@/lib/domain";
import { isAISourceStale } from "./ai-source";

const meetingInput: AIInput = {
  mode: "organize_meeting",
  researchId: "research",
  meetingId: "meeting",
  sourceText: "교수님: 비교 기준을 보완해 주세요.",
  sourceRevision: 3,
};

describe("AI 실행 뒤 원문 변경 감지", () => {
  it("AI를 실행한 원문 차수와 내용이 그대로면 후보를 저장할 수 있다", () => {
    expect(
      isAISourceStale(meetingInput, {
        text: meetingInput.sourceText,
        revision: 3,
      }),
    ).toBe(false);
  });

  it("AI 실행 뒤 메모가 자동 저장돼 차수가 오르면 후보가 원문과 맞지 않는다", () => {
    expect(
      isAISourceStale(meetingInput, {
        text: `${meetingInput.sourceText}\n추가 메모`,
        revision: 4,
      }),
    ).toBe(true);
  });

  it("차수가 없는 피드백 원문은 내용이 바뀌었을 때만 변경으로 본다", () => {
    const feedbackInput: AIInput = {
      mode: "suggest_revisions",
      researchId: "research",
      feedbackId: "feedback",
      sourceText: "표본 수 근거를 보완",
    };
    expect(
      isAISourceStale(feedbackInput, { text: "표본 수 근거를 보완" }),
    ).toBe(false);
    expect(
      isAISourceStale(feedbackInput, { text: "표본 수 근거와 한계를 보완" }),
    ).toBe(true);
  });
});
