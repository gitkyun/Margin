import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_EXECUTION_POLICIES,
  AI_PLAN_FEATURE_LABEL,
  AI_SETTINGS_SCOPE_NOTE,
  AI_USAGE_SCOPE_SUMMARY,
  getAIExecutionPolicy,
  resolveAIExecutionKind,
} from "@/lib/ai-execution-policy";
import { workMessages } from "@/lib/assistant-presentation";

describe("AI 실행 방식별 입력 범위·비용 단일 정의", () => {
  it("일반 연구 질문은 연구 기록과 이전 대화·배경을 참고하며 웹 검색 추가 과금이 없다", () => {
    const policy = getAIExecutionPolicy({ mode: "ask_research" });
    expect(policy.kind).toBe("ask_research");
    expect(policy.sends.researchRecords).toBe(true);
    expect(policy.sends.questionOnly).toBe(false);
    expect(policy.cost.webSearchQueryCredits).toBe(0);
    expect(policy.preSendNotice()).toContain("이 연구의 기록을 참고해요");
    expect(policy.extraCostNotice).toBeUndefined();
    expect(workMessages.ask_research).toContain("이 연구의 기록을 바탕으로");
  });

  it("웹 검색은 질문만 전송하고 검색어당 14크레딧 추가 비용을 안내한다", () => {
    const policy = getAIExecutionPolicy({
      mode: "ask_research",
      webSearch: true,
    });
    expect(policy.kind).toBe("web_search");
    expect(policy.sends.questionOnly).toBe(true);
    expect(policy.sends.researchRecords).toBe(false);
    expect(policy.sends.conversationHistory).toBe(false);
    expect(policy.sends.personalGuide).toBe(false);
    expect(policy.cost.webSearchQueryCredits).toBe(14);
    expect(policy.preSendNotice()).toContain("웹 검색에는 질문만 보내요");
    expect(policy.extraCostNotice?.()).toContain("14크레딧");
  });

  it("일정 확인은 이 연구의 일정 기록만 읽고 파일·이전 대화는 제외한다", () => {
    const policy = getAIExecutionPolicy({
      mode: "ask_research",
      calendar: true,
    });
    expect(policy.kind).toBe("calendar");
    expect(policy.sends.calendarRecordsOnly).toBe(true);
    expect(policy.sends.researchRecords).toBe(false);
    expect(policy.sends.attachedContexts).toBe(false);
    expect(policy.preSendNotice()).toContain("이 연구의 일정만 사용해요");
  });

  it("미팅 정리는 메모와 본인 전사문만 읽고 타인의 전사문 제외를 명시한다", () => {
    const policy = getAIExecutionPolicy({ mode: "organize_meeting" });
    expect(policy.kind).toBe("organize_meeting");
    expect(policy.sends.meetingMemoAndOwnTranscript).toBe(true);
    expect(policy.preSendNotice()).toContain("메모와 내 전사문");
    expect(policy.preSendNotice()).toContain("다른 사람의 전사문은 읽지 않아요");
  });

  it("webSearch가 true이면 calendar나 다른 mode보다 웹 검색 경로가 우선한다", () => {
    expect(
      resolveAIExecutionKind({
        mode: "organize_meeting",
        webSearch: true,
        calendar: true,
      }),
    ).toBe("web_search");
    expect(
      resolveAIExecutionKind({
        mode: "organize_meeting",
        calendar: true,
      }),
    ).toBe("calendar");
  });

  it("설정·플랜·서비스 안내에서 실제 동작과 어긋난 '선택한 기록만' 문구가 제거되었다", () => {
    expect(AI_USAGE_SCOPE_SUMMARY()).toContain("이 연구에서 볼 수 있는 기록");
    expect(AI_USAGE_SCOPE_SUMMARY()).toContain("웹 검색은 질문만");
    expect(AI_SETTINGS_SCOPE_NOTE()).toContain("웹 검색에는 질문만 보내요");
    expect(AI_PLAN_FEATURE_LABEL()).not.toContain("선택한 기록");

    const root = resolve(import.meta.dirname, "..");
    for (const rel of [
      "src/pages/SettingsPage.tsx",
      "src/components/SubscriptionPlans.tsx",
      "src/lib/assistant-presentation.ts",
      "src/pages/PublicPages.tsx",
    ]) {
      const source = readFileSync(resolve(root, rel), "utf8");
      expect(source).not.toContain("선택한 기록과 질문만");
      expect(source).not.toContain("선택한 기록으로 AI 실행");
      expect(source).not.toContain("선택한 기록을 바탕으로 답변을 준비하고 있어요.");
    }
    expect(Object.keys(AI_EXECUTION_POLICIES)).toContain("ask_research");
  });
});
