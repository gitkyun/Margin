import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "./workspace";
import { assertConnected, friendlyError } from "./supabase";
export const MONTHLY_AI_CREDITS = 20000;
export interface AICreditEntry {
  id: string;
  createdAt: string;
  amount: number;
  kind: string;
  model?: string;
  runId?: string;
}
export interface AICredits {
  balance: number;
  allowance: number;
  reserved: number;
  used: number;
  resetsAt: string;
  ledger: AICreditEntry[];
}
export function formatCredits(value: number) {
  return Math.round(value).toLocaleString();
}
/** Reservations are provisional; only settled debits count as actual usage. */
export function runCreditUsage(credits: AICredits | undefined, runId: string) {
  const entries = credits?.ledger.filter(
    (entry) =>
      entry.runId === runId &&
      ["usage", "charge", "debit", "settle", "settlement", "refund"].includes(
        entry.kind,
      ),
  );
  return entries?.length
    ? Math.abs(entries.reduce((sum, entry) => sum + entry.amount, 0))
    : undefined;
}
export interface AIUsage {
  credits?: AICredits;
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
