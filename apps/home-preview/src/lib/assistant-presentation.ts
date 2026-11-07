import type { AIInput } from "./domain";
import type { MascotState } from "@/components/brand/Brand";

// Values sent to the server are unchanged. Only allowed capability values enter the UI.
export const reviewDepthLabels: Record<string, string> = {
  minimal: "핵심만",
  medium: "차근차근",
  high: "꼼꼼하게",
};
export const reviewDepthHints: Record<string, string> = {
  minimal: "선택한 기록의 핵심과 다음 행동을 간결하게 살펴봅니다.",
  medium: "근거와 제안 이유를 함께 살펴봅니다.",
  high: "여러 수정 방법과 확인할 가정을 더 자세히 살펴봅니다. 시간이 더 걸릴 수 있습니다.",
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
  organize_meeting: "메모에서 피드백과 결정 사항을 정리하고 있어요.",
  suggest_revisions: "선택한 피드백의 수정 방법을 살펴보고 있어요.",
  review_writing: "선택한 문단의 근거와 표현을 살펴보고 있어요.",
  plan_research: "남은 작업과 다음 미팅 준비를 살펴보고 있어요.",
  read_material: "선택한 자료 구간을 읽고 있어요.",
  ask_research: "선택한 기록을 바탕으로 답변을 준비하고 있어요.",
};
