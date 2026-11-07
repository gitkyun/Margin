import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "./workspace";
import { assertConnected, friendlyError } from "./supabase";
export interface AIUsage {
  total: number;
  complete: number;
  failed: number;
  running: number;
  cancelled: number;
  limit: number;
  windowHours: number;
}
export function useAIUsage() {
  const { user, mode } = useWorkspace();
  return useQuery({
    queryKey: ["ai-usage", user.id],
    enabled: mode === "connected",
    staleTime: 30000,
    refetchInterval: 60000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await assertConnected().rpc("rms_ai_usage");
      if (error) throw new Error(friendlyError(error));
      return data as AIUsage;
    },
  });
}
