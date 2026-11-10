import { timeParts } from "@/lib/time-format";
import { friendlyError } from "@/lib/supabase";
import { StatusBadge } from "@/components/common";
import { Icon } from "@/components/icons";
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
        ...timeParts(),
      }).format(d);
}
export function errorText(e: unknown) {
  return e instanceof Error
    ? friendlyError(e)
    : "요청을 처리하지 못했어요. 다시 시도해 주세요.";
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
    return "제목과 수정한 내용을 적어 주세요.";
  if (
    result.kind === "document" &&
    (!result.versionId ||
      !data.versions.some(
        (v) => v.id === result.versionId && v.researchId === result.researchId,
      ) ||
      !result.location.trim())
  )
    return "문서 수정에는 파일과 볼 위치가 필요해요. 수정 결과에서 추가해 주세요.";
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
/** 교수 결과. 학생 작업 상태(채운 배지)와 섞이지 않게 테두리 배지 + 고정 아이콘으로 표시합니다. */
export function ResponseStatus({ response }: { response?: ReviewResponse }) {
  return (
    <StatusBadge
      variant="outlined"
      icon={
        <Icon
          name={
            response?.result === "changes_requested"
              ? "edit"
              : response?.result === "confirmed"
                ? "check-circle"
                : "clock"
          }
          size={12}
        />
      }
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

/**
 * 이 연구의 검토 요청에 이미 쓴 교수 이메일. 가장 최근에 쓴 순서로, 겹치지 않게 돌려줍니다.
 * 검토 요청을 만들 때 다시 입력하지 않고 고르는 데 씁니다.
 */
export function knownProfessorEmails(
  reviews: { researchId: string; professorEmail: string; createdAt: string }[],
  researchId: string,
): string[] {
  const recentFirst = reviews
    .filter((r) => r.researchId === researchId && r.professorEmail.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => r.professorEmail.trim().toLowerCase());
  return [...new Set(recentFirst)];
}
