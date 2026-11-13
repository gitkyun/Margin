import type { AIInput } from "./domain";
import type { MascotState } from "@/components/brand/Brand";
import { t } from "@/lib/i18n";

// Values sent to the server are unchanged. Only allowed capability values enter the UI.
export const reviewDepthLabels: Record<string, string> = {
  low: t("간단히"),
  minimal: t("간단히"),
  medium: t("보통"),
  high: t("자세히"),
};
export const reviewDepthHints: Record<string, string> = {
  low: t("빠르게 답해요."),
  minimal: t("빠르게 답해요."),
  medium: t("조금 더 생각한 뒤 답해요."),
  high: t("더 오래 생각한 뒤 답해요. 시간이 더 걸릴 수 있어요."),
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
export const workMessages: Record<AIInput["mode"], string> = {
  organize_meeting: t("메모에서 피드백과 결정 사항을 정리하고 있어요."),
  suggest_revisions: t("선택한 피드백의 수정 방법을 살펴보고 있어요."),
  review_writing: t("선택한 문단의 근거와 표현을 살펴보고 있어요."),
  plan_research: t("남은 할 일과 다음 미팅 준비를 살펴보고 있어요."),
  read_material: t("선택한 자료 구간을 읽고 있어요."),
  ask_research: t("선택한 기록을 바탕으로 답변을 준비하고 있어요."),
};
