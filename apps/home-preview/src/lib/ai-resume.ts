/**
 * 화면을 떠났다 돌아와도 연구 도우미 답을 이어 받기(응답 속도 작업 문서 6-1, 2026-11-19).
 * 보낼 때 실행 번호를 이 브라우저에 적어 두고, 서버는 연결이 끊겨도 끝까지 만들어 결과를 저장합니다.
 * 다시 열면 저장된 결과(rms_ai_run_result)를 읽어 그 대화에 답을 넣습니다.
 */
import type {
  AICandidate,
  AIContext,
  AIConversationMessage,
  AIInput,
  WebGrounding,
} from "./domain";
import { suggestedTasksOf } from "./assistant-next";
import type { AssistantStep } from "./assistant-steps";

export interface PendingRun {
  runId: string;
  researchId: string;
  conversationId: string;
  mode: AIInput["mode"];
  startedAt: number;
  steps: AssistantStep[];
  webSearch: boolean;
  calendar: boolean;
  contexts: AIContext[];
}

export interface StoredRunResult {
  status: "running" | "complete" | "failed" | "cancelled";
  output?: {
    answer?: string;
    candidates?: AICandidate[];
    webGrounding?: WebGrounding;
  };
  error?: string;
  creditsUsed?: number;
  completedAt?: string;
}

/** 서버가 결과를 기다리는 최대 시간(130초)과 정리 여유를 더한 값. 넘으면 더 기다리지 않습니다. */
export const RESUME_GIVE_UP_MS = 180_000;
export const RESUME_POLL_MS = 2_500;
/** 보낸 직후 떠났다면 서버가 실행 기록을 만들기 전일 수 있어, 이 시간까지는 기록이 없어도 기다립니다. */
export const RESUME_NOT_STARTED_MS = 20_000;

const key = (researchId: string) => `margin-ai-pending:${researchId}`;

export function savePendingRun(run: PendingRun): void {
  try {
    localStorage.setItem(key(run.researchId), JSON.stringify(run));
  } catch {
    /* 저장할 수 없으면 이어 받기만 못 할 뿐 요청은 그대로 갑니다. */
  }
}

export function loadPendingRun(researchId: string): PendingRun | null {
  try {
    const raw = localStorage.getItem(key(researchId));
    if (!raw) return null;
    const run = JSON.parse(raw) as PendingRun;
    return run?.runId && run.conversationId ? run : null;
  } catch {
    return null;
  }
}

/** 같은 실행일 때만 지웁니다(그 사이 새 질문을 보냈으면 새 기록을 지우지 않음). */
export function clearPendingRun(researchId: string, runId?: string): void {
  try {
    if (runId && loadPendingRun(researchId)?.runId !== runId) return;
    localStorage.removeItem(key(researchId));
  } catch {
    /* 무시 */
  }
}

/** 같은 탭에서 두 화면(사이드 창·전체 화면)이 같은 실행을 두 번 넣지 않게 합니다. */
const claimed = new Set<string>();
export function claimRun(runId: string): boolean {
  if (claimed.has(runId)) return false;
  claimed.add(runId);
  return true;
}

/** 받은 결과를 대화의 답 메시지로 바꿉니다. 바로 받은 답과 이어 받은 답이 같은 모양이 되게 씁니다. */
export function assistantMessage(
  result: {
    answer?: string;
    candidates?: AICandidate[];
    webGrounding?: WebGrounding;
    contexts?: AIContext[];
    runId?: string;
  },
  meta: {
    createdAt: string;
    steps: string[];
    elapsedMs: number;
    webSearch: boolean;
    calendar: boolean;
    contexts: AIContext[];
    candidateText: (candidate: AICandidate) => string;
  },
): AIConversationMessage {
  const candidates = result.candidates ?? [];
  const tasks = suggestedTasksOf(candidates);
  return {
    role: "assistant",
    text: result.answer ?? candidates.map(meta.candidateText).join("\n\n"),
    createdAt: meta.createdAt,
    steps: meta.steps,
    elapsedMs: meta.elapsedMs,
    webSearch: meta.webSearch,
    calendar: meta.calendar,
    webGrounding: result.webGrounding,
    contexts: result.contexts ?? meta.contexts,
    ...(result.runId ? { runId: result.runId } : {}),
    // 답 아래 [할 일 추가](06 §2.4): 고르기 전까지는 대화에만 남는 제안입니다.
    ...(tasks.length ? { suggestedTasks: tasks } : {}),
  };
}
