import { t } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useExperience } from "./experience";
import { assertConnected } from "./supabase";
import { localizeServerMessage } from "@/lib/server-messages";
import type { AIInput } from "./domain";

export interface AIModelCapability {
  id: string;
  label: string;
  thinking: string[];
  description?: string;
  provider?: string;
  recommended?: boolean;
  inputPrice?: number;
  outputPrice?: number;
  disabled?: boolean;
  availability?: string | boolean;
}

export function isAIModelAvailable(model: AIModelCapability) {
  return (
    !model.disabled &&
    (model.availability === undefined ||
      model.availability === true ||
      model.availability === "available")
  );
}

/**
 * 사용자가 답변 깊이를 정하지 않았을 때 쓰는 값. 예전 기본값 high(자세히)는 연구 대화 한 번에
 * 평균 1분 가까이 걸려(2026-11-19 측정, low는 10~15초) 응답 속도 작업 문서 2-2의 출발점대로
 * 간단히(low)로 낮췄어요. 사용자가 고른 값은 그대로 따라요.
 */
export const DEFAULT_THINKING = "low";

/** The server is the only source of model IDs and supported thinking levels. */
export function resolveAISelection(
  models: AIModelCapability[] = [],
  prefs: { model?: unknown; thinking?: unknown } = {},
): { model: string | undefined; thinking: AIInput["thinking"] } {
  const available = models.filter(isAIModelAvailable);
  const selected =
    available.find((model) => model.id === prefs.model) ??
    available.find((model) => model.recommended) ??
    available.find((model) =>
      /(?:flash\s*3[. -]?8|3[. -]?8\s*flash)/i.test(
        `${model.id.replace(/-/g, " ")} ${model.label}`,
      ),
    ) ??
    available[0];
  const preferred = String(prefs.thinking ?? DEFAULT_THINKING);
  const thinking = selected?.thinking.includes(preferred)
    ? preferred
    : selected?.thinking[0];
  return { model: selected?.id, thinking: thinking as AIInput["thinking"] };
}

export function useAICapabilities() {
  const { mode } = useExperience();
  return useQuery({
    queryKey: ["ai-capabilities"],
    enabled: mode === "connected",
    staleTime: 300000,
    retry: false,
    queryFn: async () => {
      const { data } = await assertConnected().auth.getSession();
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assist`,
        {
          headers: {
            Authorization: `Bearer ${data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      const b = await r.json();
      if (!r.ok)
        throw new Error(
          localizeServerMessage(
            b.error?.message ?? t("AI 모델 정보를 불러오지 못했어요."),
          ),
        );
      return b as {
        models: AIModelCapability[];
      };
    },
  });
}
