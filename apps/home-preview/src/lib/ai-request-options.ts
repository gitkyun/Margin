import { useAICapabilities, resolveAISelection } from "./ai-capabilities";
import { useWorkspace } from "./workspace";
import type { AIInput } from "./domain";

export interface AIRequestOptions {
  model?: string;
  thinking?: AIInput["thinking"];
}

/** 화면에 모델 선택기가 없는 요청도 계정 설정과 서버의 사용 가능 목록을 따릅니다. */
export function useAIRequestOptions(): () => AIRequestOptions {
  const { user } = useWorkspace();
  const models = useAICapabilities().data?.models ?? [];
  return () => resolveAISelection(models, user.preferences ?? {});
}
