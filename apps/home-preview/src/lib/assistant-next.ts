import { t } from "@/lib/i18n";
import type {
  AICandidate,
  AIContext,
  AIConversationMessage,
  AIInput,
  Task,
} from "@/lib/domain";

/**
 * 초안 쓰기(IA v2 06 §2.3): 서버의 묻고 답하기(`ask_research`)에 정해 둔 지시문을 붙여 보냅니다.
 * 대화에는 사용자가 쓴 요청만 남고, 지시문은 보낼 때만 붙습니다.
 */
export function draftQuestion(request: string): string {
  return `${t(
    "아래 요청대로 이 연구의 기록을 근거로 글 초안을 써 줘. 인사나 설명 없이 글에 바로 옮길 수 있는 문단으로 쓰고, 기록에 없는 사실·수치·인용은 만들지 말고 확인이 필요한 곳에는 '[확인 필요]'라고 적어 줘.",
  )}\n\n${t("요청: {request}", { request })}`;
}

/** 서버가 받는 질문 길이(2,000자)에서 지시문 몫을 뺀 요청 길이 */
export const QUESTION_MAX = 2000;
export function draftRequestMax(): number {
  return QUESTION_MAX - draftQuestion("").length;
}

/** 방금 한 요청: 대화의 사용자 메시지에 남긴 요청 종류와 초안 쓰기 여부 */
export type AskedRequest = Pick<
  AIConversationMessage,
  "mode" | "draft" | "webSearch" | "calendar"
>;

/** `end` 앞에서 가장 가까운 사용자 메시지(그 답을 낳은 요청) */
export function lastAsked(
  messages: AIConversationMessage[],
  end = messages.length,
): AIConversationMessage | undefined {
  for (let i = Math.min(end, messages.length) - 1; i >= 0; i--)
    if (messages[i].role === "user") return messages[i];
  return undefined;
}

export type NextStep =
  | {
      id: string;
      label: string;
      kind: "fill";
      mode: AIInput["mode"];
      draft?: boolean;
      prompt: string;
    }
  | { id: string; label: string; kind: "save" }
  | { id: string; label: string; kind: "tasks" }
  | { id: string; label: string; kind: "suggest_edits" };

/**
 * 답 아래 '이어서'(IA v2 06 §2.4): AI가 지어내지 않고 요청 종류별로 정해 둔 목록입니다.
 * 채우는 칩은 요청 종류와 입력창만 채우고, 보내기는 사용자가 합니다.
 * '수정 제안 받기'는 그 글의 편집기가 열려 있을 때만 둡니다(본문 안 제안은 글 화면에서만 받음).
 */
export function nextSteps(
  asked: AskedRequest | undefined,
  options: { canSuggestEdits: boolean; hasTasks?: boolean },
): NextStep[] {
  if (!asked || asked.webSearch || asked.calendar) return [];
  const draft = (prompt: string, id = "draft", label = t("초안 쓰기")) => ({
    id,
    label,
    kind: "fill" as const,
    mode: "ask_research" as const,
    draft: true,
    prompt,
  });
  if (asked.draft)
    return [
      { id: "save", label: t("글로 저장"), kind: "save" },
      draft(
        t("방금 초안을 핵심만 남겨 절반 길이로 줄여 줘"),
        "shorter",
        t("더 짧게"),
      ),
      draft(
        t("방금 초안을 기록의 근거를 더해 더 자세히 써 줘"),
        "longer",
        t("더 자세히"),
      ),
    ];
  switch (asked.mode) {
    case "organize_meeting":
      return [
        {
          id: "revisions",
          label: t("수정 방법 제안받기"),
          kind: "fill",
          mode: "suggest_revisions",
          prompt: t("이 기록의 남은 피드백을 어떻게 고치면 좋을지 제안해 줘"),
        },
        draft(t("이 미팅 정리를 바탕으로 고칠 부분의 초안을 써 줘")),
      ];
    case "suggest_revisions":
      return [
        // 답의 할 일 제안을 펼칩니다(답 아래 [할 일 추가]와 같음). 제안이 없으면 두지 않습니다.
        ...(options.hasTasks
          ? [{ id: "tasks", label: t("할 일 추가"), kind: "tasks" as const }]
          : []),
        draft(t("방금 제안한 수정 방법대로 고친 문단의 초안을 써 줘")),
      ];
    case "review_writing":
      return options.canSuggestEdits
        ? [
            {
              id: "suggest_edits",
              label: t("수정 제안 받기"),
              kind: "suggest_edits",
            },
          ]
        : [];
    default:
      return [];
  }
}

/** 한 답에서 보여 줄 할 일 제안의 최대 수 */
export const TASK_SUGGESTIONS_MAX = 10;

/**
 * 답 아래 [할 일 추가](06 §2.4): 실행 결과의 제안마다 딸린 '할 일 제안'(suggestedTasks)을 모읍니다.
 * 미팅 정리의 할 일 후보(category task)는 제안 탭에서 고르므로 넣지 않습니다(같은 것을 두 곳에서 고르지 않게).
 */
export function suggestedTasksOf(candidates: AICandidate[]): string[] {
  const out: string[] = [];
  for (const candidate of candidates)
    for (const raw of candidate.suggestedTasks ?? []) {
      const title = raw.replace(/\s+/g, " ").trim().slice(0, 200);
      if (title && !out.includes(title)) out.push(title);
    }
  return out.slice(0, TASK_SUGGESTIONS_MAX);
}

/** 요청에 놓인 칩의 기록을 할 일에 잇습니다: 피드백은 feedbackIds, 미팅은 나온 기록, 글은 고칠 글. */
export function taskLink(
  contexts: AIContext[],
): Pick<Task, "feedbackIds" | "sourceRecordId" | "documentId"> {
  const meeting = contexts.find((c) => c.kind === "meetings");
  const document = contexts.find((c) => c.kind === "documents");
  return {
    feedbackIds: contexts.filter((c) => c.kind === "feedback").map((c) => c.id),
    ...(meeting ? { sourceRecordId: meeting.id } : {}),
    ...(document ? { documentId: document.id } : {}),
  };
}
