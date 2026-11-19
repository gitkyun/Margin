import type { AIInput } from "./domain";
import type { MascotState } from "@/components/brand/Brand";
import { t } from "@/lib/i18n";

// Values sent to the server are unchanged. Only allowed capability values enter the UI.
export const reviewDepthLabels: Record<string, string> = {
  low: t("간단히"),
  minimal: t("간단히"),
  medium: t("보통"),
  high: t("자세히"),
  max: t("최대한 자세히"),
  xhigh: t("최대한 자세히"),
};
export const reviewDepthHints: Record<string, string> = {
  low: t("빠르게 답해요."),
  minimal: t("빠르게 답해요."),
  medium: t("조금 더 생각한 뒤 답해요."),
  high: t("더 오래 생각한 뒤 답해요. 시간이 더 걸릴 수 있어요."),
  max: t("더 깊이 검토해요. 시간과 크레딧이 더 들 수 있어요."),
  xhigh: t("더 깊이 검토해요. 시간과 크레딧이 더 들 수 있어요."),
};
export function resolveReviewDepth(allowed: string[], preferred: string) {
  return allowed.includes(preferred) ? preferred : (allowed[0] ?? "");
}
export function reviewDepthOptions(allowed: string[]) {
  return allowed.map((value) => ({
    value,
    label: reviewDepthLabels[value] ?? value,
  }));
}
export function researchModelLabel(model: { id: string; label: string }) {
  if (model.label !== model.id) return model.label;
  return model.id
    .replace(/^gemini-/, "Gemini ")
    .replace(/\bflash\b/g, "Flash")
    .replace(/\blite\b/g, "Lite")
    .replace(/\bpro\b/g, "Pro")
    .replace(/-/g, " ");
}
export function workingMascot(mode: AIInput["mode"] | string): MascotState {
  switch (mode) {
    case "organize_meeting":
      return "processing";
    case "suggest_revisions":
      return "thinking";
    case "continue_writing":
    case "inline_edit":
    case "review_writing":
      return "writing";
    case "plan_research":
      return "analyzing";
    case "read_material":
      return "searching";
    default:
      return "chatting";
  }
}
import { AI_EXECUTION_POLICIES } from "./ai-execution-policy";

export const workMessages: Record<AIInput["mode"], string> = {
  organize_meeting: AI_EXECUTION_POLICIES.organize_meeting.workingMessage(),
  suggest_revisions: AI_EXECUTION_POLICIES.suggest_revisions.workingMessage(),
  continue_writing: AI_EXECUTION_POLICIES.continue_writing.workingMessage(),
  inline_edit: AI_EXECUTION_POLICIES.inline_edit.workingMessage(),
  review_writing: AI_EXECUTION_POLICIES.review_writing.workingMessage(),
  suggest_edits: AI_EXECUTION_POLICIES.suggest_edits.workingMessage(),
  plan_research: AI_EXECUTION_POLICIES.plan_research.workingMessage(),
  read_material: AI_EXECUTION_POLICIES.read_material.workingMessage(),
  ask_research: AI_EXECUTION_POLICIES.ask_research.workingMessage(),
};
