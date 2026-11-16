import { t } from "@/lib/i18n";
import { useSyncExternalStore } from "react";

/**
 * 연구 도우미(AI) 서버가 아직 연결되지 않은 상태를 화면 전체가 같이 알도록 합니다.
 *
 * 서버(ai-assist)는 Gemini 키가 없으면 실행 요청에 `NOT_CONFIGURED`(503)를
 * 돌려줘요. 이 응답은 다시 시도해도 바뀌지 않으므로 재시도를 권하지 않고,
 * 연결되지 않은 모델 설정도 보여 주지 않습니다(AGENTS.md: 연결 전 가짜
 * 모델·결과를 만들지 않음). 상태는 이 탭(sessionStorage)에서만 기억해서,
 * 서버가 연결된 뒤 새 탭에서는 다시 확인합니다.
 */
export const AI_NOT_CONFIGURED_CODE = "NOT_CONFIGURED";
export const AI_NOT_CONFIGURED_MESSAGE = t(
  "연구 도우미가 아직 연결되지 않았어요. 연결되면 여기서 바로 쓸 수 있어요. 질문과 붙인 파일은 그대로 있어요.",
);

const STORAGE_KEY = "margin-ai-not-configured";

export class AINotConfiguredError extends Error {
  constructor() {
    super(AI_NOT_CONFIGURED_MESSAGE);
    this.name = "AINotConfiguredError";
  }
}

function read() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let notConfigured = typeof window === "undefined" ? false : read();
const listeners = new Set<() => void>();

export function markAINotConfigured() {
  notConfigured = true;
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* 저장소를 쓸 수 없으면 이 화면에서만 기억합니다. */
  }
  listeners.forEach((listener) => listener());
}

export function isAINotConfigured() {
  return notConfigured;
}

export function useAINotConfigured() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notConfigured,
    () => false,
  );
}
