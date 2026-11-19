import type { AIInput } from "@/lib/domain";
import { t } from "@/lib/i18n";

export type AIExecutionKind =
  | "ask_research"
  | "web_search"
  | "calendar"
  | "organize_meeting"
  | "suggest_revisions"
  | "review_writing"
  | "plan_research"
  | "read_material"
  | "suggest_edits"
  | "continue_writing"
  | "inline_edit";

export interface AIExecutionScope {
  /** 이 연구에서 요청자가 열람 가능한 기록 전체를 서버가 함께 조회하는지 */
  researchRecords: boolean;
  /** 사용자가 첨부하거나 지정한 근거를 함께 보내는지 */
  attachedContexts: boolean;
  /** 이전 대화 이력을 함께 보내는지 */
  conversationHistory: boolean;
  /** 연구 이름·목적·연구 질문(배경)을 함께 보내는지 */
  researchBackground: boolean;
  /** 계정 설정의 개인 지침을 함께 보내는지 */
  personalGuide: boolean;
  /** 해당 미팅의 메모와 요청자 본인 전사문만 읽는지 */
  meetingMemoAndOwnTranscript: boolean;
  /** 이 연구의 일정 기록(미팅·할 일·목표·단계)만 읽는지 */
  calendarRecordsOnly: boolean;
  /** 질문 텍스트만 전송하는지(연구 기록·이전 대화·개인 지침 제외) */
  questionOnly: boolean;
}

export interface AIExecutionPolicy {
  kind: AIExecutionKind;
  sends: AIExecutionScope;
  cost: {
    tokenBased: true;
    webSearchQueryCredits: number;
  };
  /** 질문을 보내기 전에 입력창 아래에 표시할 입력 범위 안내 */
  preSendNotice: () => string;
  /** 추가 과금(예: 웹 검색어당 14크레딧) 안내 */
  extraCostNotice?: () => string;
  /** 실행 중 대기 화면에 표시할 문구 */
  workingMessage: () => string;
}

const NO_EXTRA_SEARCH_COST = {
  tokenBased: true as const,
  webSearchQueryCredits: 0,
};

/**
 * 실행 방식별 실제 입력 범위와 비용을 한곳에서 정의합니다.
 * 서버 `supabase/functions/ai-assist/index.ts`의 실제 전송 경로와 일치해야 합니다.
 */
export const AI_EXECUTION_POLICIES: Record<AIExecutionKind, AIExecutionPolicy> =
  {
    ask_research: {
      kind: "ask_research",
      sends: {
        researchRecords: true,
        attachedContexts: true,
        conversationHistory: true,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t(
          "이 연구의 기록을 참고해요. 비공개 AI 대화와 녹음 전사문은 보내지 않아요.",
        ),
      workingMessage: () =>
        t("이 연구의 기록을 바탕으로 답변을 준비하고 있어요."),
    },
    web_search: {
      kind: "web_search",
      sends: {
        researchRecords: false,
        attachedContexts: false,
        conversationHistory: false,
        researchBackground: false,
        personalGuide: false,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: true,
      },
      cost: {
        tokenBased: true,
        webSearchQueryCredits: 14,
      },
      preSendNotice: () =>
        t("웹 검색에는 질문만 보내요. 연구 기록과 이전 대화는 보내지 않아요."),
      extraCostNotice: () =>
        t("웹 검색은 실제 검색어마다 14크레딧이 추가돼요."),
      workingMessage: () => t("Google에서 웹 근거를 확인하고 있어요."),
    },
    calendar: {
      kind: "calendar",
      sends: {
        researchRecords: false,
        attachedContexts: false,
        conversationHistory: false,
        researchBackground: false,
        personalGuide: false,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: true,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t("일정 확인에는 이 연구의 일정만 사용해요. 선택한 파일은 보내지 않아요."),
      workingMessage: () => t("이 연구의 미팅과 마감 일정을 확인하고 있어요."),
    },
    organize_meeting: {
      kind: "organize_meeting",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: true,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: true,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t(
          "이 미팅의 메모와 내 전사문을 정리해요. 다른 사람의 전사문은 읽지 않아요.",
        ),
      workingMessage: () => t("메모에서 피드백과 결정 사항을 정리하고 있어요."),
    },
    suggest_revisions: {
      kind: "suggest_revisions",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: true,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t("이 연구의 피드백과 관련 기록을 참고해 수정 방법을 제안해요."),
      workingMessage: () => t("선택한 피드백의 수정 방법을 살펴보고 있어요."),
    },
    review_writing: {
      kind: "review_writing",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: true,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t("이 연구의 원고와 연구 배경을 참고해 근거와 표현을 검토해요."),
      workingMessage: () => t("선택한 문단의 근거와 표현을 살펴보고 있어요."),
    },
    plan_research: {
      kind: "plan_research",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: true,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t("이 연구의 할 일과 단계·목표 기록을 참고해 정리해요."),
      workingMessage: () => t("남은 할 일과 다음 미팅 준비를 살펴보고 있어요."),
    },
    read_material: {
      kind: "read_material",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: true,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t("첨부한 파일(없으면 최근 파일)과 질문을 참고해 요약해요."),
      workingMessage: () => t("선택한 자료 구간을 읽고 있어요."),
    },
    suggest_edits: {
      kind: "suggest_edits",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: false,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t("저장한 글의 고른 범위와 선택한 근거를 참고해 수정 제안을 만들어요."),
      workingMessage: () =>
        t("글에서 고칠 곳을 찾아 수정 제안을 준비하고 있어요."),
    },
    continue_writing: {
      kind: "continue_writing",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: false,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () =>
        t("지금 작성 중인 문맥과 연구 배경을 참고해 다음 문장을 제안해요."),
      workingMessage: () =>
        t("선택한 문맥을 바탕으로 다음 문장을 준비하고 있어요."),
    },
    inline_edit: {
      kind: "inline_edit",
      sends: {
        researchRecords: false,
        attachedContexts: true,
        conversationHistory: false,
        researchBackground: true,
        personalGuide: true,
        meetingMemoAndOwnTranscript: false,
        calendarRecordsOnly: false,
        questionOnly: false,
      },
      cost: NO_EXTRA_SEARCH_COST,
      preSendNotice: () => t("고른 문장과 요청을 참고해 다듬어요."),
      workingMessage: () => t("선택한 문장을 요청에 맞게 다듬고 있어요."),
    },
  };

export function resolveAIExecutionKind(input: {
  mode: AIInput["mode"];
  webSearch?: boolean;
  calendar?: boolean;
}): AIExecutionKind {
  if (input.webSearch) return "web_search";
  if (input.calendar) return "calendar";
  return input.mode;
}

export function getAIExecutionPolicy(input: {
  mode: AIInput["mode"];
  webSearch?: boolean;
  calendar?: boolean;
}): AIExecutionPolicy {
  return AI_EXECUTION_POLICIES[resolveAIExecutionKind(input)];
}

/** 설정 › 사용량에서 보여 주는 요약 입력 범위 */
export const AI_USAGE_SCOPE_SUMMARY = () =>
  t("이 연구에서 볼 수 있는 기록 (웹 검색은 질문만)");

/** 설정 › AI 기본 설정에서 보여 주는 동작 범위 설명 */
export const AI_SETTINGS_SCOPE_NOTE = () =>
  t(
    "연구 질문은 이 연구에서 볼 수 있는 기록을 참고하고, 웹 검색에는 질문만 보내요. 기본값을 바꿔도 AI가 자동으로 실행되지 않아요.",
  );

/** 플랜 카드에서 보여 주는 AI 기능 요약 */
export const AI_PLAN_FEATURE_LABEL = () =>
  t("내 연구 기록으로 연구 도우미 실행");
