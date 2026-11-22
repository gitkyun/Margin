import type { ReviewRequest, WorkspaceData } from "./domain";

export interface ReviewPermissions {
  /** 연구 소유자 또는 활성 편집자 멤버로서 공유 설정·재확인 요청 등 연구 측 관리를 할 수 있는지 */
  canManageResearch: boolean;
  /** 이 검토 요청의 지정된 지도교수인지 (연구 편집자 멤버 여부와 무관) */
  isAssignedProfessor: boolean;
  /** 검토 요청을 열람할 수 있는지 */
  canRead: boolean;
  /** 공유 중인 검토에서 댓글·응답 등 쓰기 동작을 할 수 있는지 */
  canWrite: boolean;
  /** 최신 차수일 때 교수 검토 응답 폼을 표시하고 제출할 수 있는지 */
  canRespondLatest: boolean;
}

/**
 * 검토 요청 화면의 행동별 권한을 서버 RPC(rms_can_read_request·rms_respond·rms_set_sharing·rms_recheck)와
 * 같은 기준으로 계산합니다. 교수가 연구의 편집자 멤버로 초대되어 있어도 이 검토의 지정 교수(professorId)라면
 * 응답 권한(canRespondLatest)을 유지합니다(U10-01).
 */
export function reviewPermissions(
  request: ReviewRequest | undefined,
  userId: string,
  data: Pick<WorkspaceData, "researches" | "members">,
): ReviewPermissions {
  if (!request) {
    return {
      canManageResearch: false,
      isAssignedProfessor: false,
      canRead: false,
      canWrite: false,
      canRespondLatest: false,
    };
  }
  const research = data.researches.find((r) => r.id === request.researchId);
  const canManageResearch =
    !!research &&
    (research.ownerId === userId ||
      data.members.some(
        (m) =>
          m.researchId === research.id &&
          m.userId === userId &&
          m.status === "active",
      ));
  const isAssignedProfessor = request.professorId === userId;
  const canRead =
    canManageResearch || (isAssignedProfessor && request.status === "shared");
  const canWrite = canRead && request.status === "shared";
  const canRespondLatest = isAssignedProfessor && canWrite;
  return {
    canManageResearch,
    isAssignedProfessor,
    canRead,
    canWrite,
    canRespondLatest,
  };
}
