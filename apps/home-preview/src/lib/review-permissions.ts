import type { ReviewRequest, ReviewRound, WorkspaceData } from "@/lib/domain";

export interface ReviewPermissions {
  /** 이 요청의 연구를 편집할 수 있는 참여자(소유자 또는 활성 공동연구자, 휴지통 제외)인지 */
  canEditResearch: boolean;
  /** 이 요청의 지정 교수(검토자)인지 */
  isDesignatedReviewer: boolean;
  /** 공동연구자(연구 참여자)이면서 동시에 지정 교수인 복합 권한인지 */
  isDualRole: boolean;
  /** 검토 요청을 열람할 수 있는지 (서버: rms_can_read_request) */
  canRead: boolean;
  /** 댓글 작성·편집·삭제·해결과 PDF 핀 찍기를 할 수 있는지 (서버: rms_comment / rms_resolve_comment) */
  canComment: boolean;
  /** 공유 중이라 최신 차수에 응답할 수 있는 지정 교수인지 */
  canRespondOnLatestRound: boolean;
  /** 지금 연 차수에 교수 응답을 저장·변경할 수 있는지 (서버: rms_respond) */
  canRespond: boolean;
  /** 항목별 다시 확인(재검토) 요청을 보낼 수 있는지 (서버: rms_recheck) */
  canRequestRecheck: boolean;
  /** 공유 설정(교수 이메일 변경·공유 중지·다시 공유)을 관리할 수 있는지 (서버: rms_set_sharing) */
  canManageSharing: boolean;
  /** 링크 복사·메일 알림 같은 공유 도구를 쓸 수 있는지 */
  canShareRequest: boolean;
  /** 연결된 수정 결과 상세로 이동해 고칠 수 있는지 */
  canEditSourceResult: boolean;
}

export function isLatestReviewRound(
  rounds: readonly Pick<ReviewRound, "id" | "itemId" | "number">[],
  round: Pick<ReviewRound, "id" | "itemId" | "number">,
): boolean {
  const latest = rounds
    .filter((entry) => entry.itemId === round.itemId)
    .sort((a, b) => b.number - a.number)[0];
  return latest?.id === round.id;
}

/**
 * 사람에게 역할 하나를 붙이지 않고 행동별 권한을 서버(rms_can_read_request, rms_respond,
 * rms_recheck, rms_set_sharing, rms_comment)와 같은 기준으로 계산합니다.
 */
export function reviewPermissions(
  data: Pick<WorkspaceData, "researches" | "members" | "rounds">,
  request: ReviewRequest | undefined,
  userId: string,
  round?: Pick<ReviewRound, "id" | "itemId" | "number">,
): ReviewPermissions {
  const canEditResearch =
    !!request &&
    data.researches.some(
      (research) =>
        research.id === request.researchId &&
        !research.deletedAt &&
        (research.ownerId === userId ||
          data.members.some(
            (member) =>
              member.researchId === research.id &&
              member.userId === userId &&
              member.status === "active",
          )),
    );
  const isDesignatedReviewer = !!request && request.professorId === userId;
  const isDualRole = canEditResearch && isDesignatedReviewer;
  const isShared = request?.status === "shared";
  const canRead =
    !!request && (canEditResearch || (isDesignatedReviewer && isShared));
  const canComment = canRead && isShared;
  const canRespondOnLatestRound = isDesignatedReviewer && canRead && isShared;
  const canRespond =
    canRespondOnLatestRound &&
    !!round &&
    isLatestReviewRound(data.rounds, round);
  const canRequestRecheck = canEditResearch && isShared;
  const canManageSharing = canEditResearch;
  const canShareRequest = canEditResearch;
  const canEditSourceResult = canEditResearch;

  return {
    canEditResearch,
    isDesignatedReviewer,
    isDualRole,
    canRead,
    canComment,
    canRespondOnLatestRound,
    canRespond,
    canRequestRecheck,
    canManageSharing,
    canShareRequest,
    canEditSourceResult,
  };
}
