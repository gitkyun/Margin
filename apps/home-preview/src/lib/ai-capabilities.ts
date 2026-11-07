import { useQuery } from "@tanstack/react-query";
import { useExperience } from "./experience";
import { assertConnected } from "./supabase";
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
        throw new Error(b.error?.message ?? "모델 설정을 불러오지 못했습니다.");
      return b as {
        models: { id: string; label: string; thinking: string[] }[];
      };
    },
  });
}
