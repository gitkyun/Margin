import { friendlyError } from "@/lib/supabase";
import { StatusBadge } from "@/components/common";
import {
  responseLabels,
  type MaterialVersion,
  type ReviewRequest,
  type ReviewResponse,
  type ReviewRound,
  type RevisionResult,
  type WorkspaceData,
} from "@/lib/domain";
export const sharingLabels = {
  draft: "준비 중",
  shared: "공유 중",
  stopped: "공유 중지",
} as const;
export const sharingTone = {
  draft: "neutral",
  shared: "blue",
  stopped: "amber",
} as const;
export function timeText(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.valueOf())
    ? ""
    : new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
}
export function errorText(e: unknown) {
  return e instanceof Error
    ? friendlyError(e)
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}
export function latestRound(data: WorkspaceData, itemId: string) {
  return data.rounds
    .filter((r) => r.itemId === itemId)
    .sort((a, b) => b.number - a.number)[0];
}
// The server accepts professor responses only on an item's newest round.
export function isLatestRound(
  data: WorkspaceData,
  round: ReviewRound,
): boolean {
  return latestRound(data, round.itemId)?.id === round.id;
}
export function latestResponse(data: WorkspaceData, roundId?: string) {
  return data.responses
    .filter((r) => r.roundId === roundId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
export function evidenceIssue(result: RevisionResult, data: WorkspaceData) {
  if (!result.title.trim() || !result.description.trim())
    return "제목과 실제 수정 설명이 필요합니다.";
  if (
    result.kind === "document" &&
    (!result.versionId ||
      !data.versions.some(
        (v) => v.id === result.versionId && v.researchId === result.researchId,
      ) ||
      !result.location.trim())
  )
    return "문서 검토에는 보존 파일과 확인 위치가 필요합니다.";
  return "";
}
export function sourceExcerpt(result: RevisionResult, data: WorkspaceData) {
  return data.feedback
    .filter(
      (f) =>
        f.researchId === result.researchId && result.feedbackIds.includes(f.id),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((f) => `${f.title}\n${f.body}`)
    .join("\n\n");
}
export function versionForRound(
  round: ReviewRound,
  request: ReviewRequest,
  data: WorkspaceData,
): MaterialVersion | undefined {
  if (!round.versionId) return undefined;
  const own = data.versions.find((v) => v.id === round.versionId);
  if (own) return own;
  if (!round.storagePath || !round.fileName) return undefined;
  return {
    id: round.versionId,
    researchId: request.researchId,
    materialId: "",
    number: 0,
    fileName: round.fileName,
    storagePath: round.storagePath,
    size: 0,
    mimeType: "application/pdf",
    createdAt: round.createdAt,
    updatedAt: round.createdAt,
  };
}
export function ResponseStatus({ response }: { response?: ReviewResponse }) {
  return (
    <StatusBadge
      tone={
        response?.result === "changes_requested"
          ? "amber"
          : response?.result === "confirmed"
            ? "green"
            : "neutral"
      }
    >
      {response ? responseLabels[response.result] : "응답 전"}
    </StatusBadge>
  );
}
