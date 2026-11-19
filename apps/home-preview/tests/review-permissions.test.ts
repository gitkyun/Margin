import { describe, expect, it } from "vitest";
import {
  emptyWorkspace,
  type AppUser,
  type ReviewRequest,
  type ReviewRound,
  type WorkspaceData,
} from "@/lib/domain";
import { reviewPermissions } from "@/lib/review-permissions";
import { unreadReviewNotifications } from "@/lib/notifications";

const STUDENT: AppUser = {
  id: "student-1",
  email: "student@example.test",
  name: "김학생",
};
const PROFESSOR: AppUser = {
  id: "professor-1",
  email: "professor@example.test",
  name: "이교수",
};
const STRANGER: AppUser = {
  id: "stranger-1",
  email: "stranger@example.test",
  name: "외부인",
};
const STAMP = "2026-11-18T10:00:00.000Z";

function makeFixture(options?: {
  professorIsCoauthor?: boolean;
  memberStatus?: "active" | "pending";
  status?: ReviewRequest["status"];
  researchDeleted?: boolean;
}): {
  data: WorkspaceData;
  request: ReviewRequest;
  round1: ReviewRound;
  round2: ReviewRound;
} {
  const data = emptyWorkspace();
  data.researches.push({
    id: "research-1",
    ownerId: STUDENT.id,
    name: "공동 연구",
    description: "",
    createdAt: STAMP,
    updatedAt: STAMP,
    deletedAt: options?.researchDeleted ? STAMP : undefined,
  });
  if (options?.professorIsCoauthor) {
    data.members.push({
      researchId: "research-1",
      userId: PROFESSOR.id,
      role: "editor",
      name: PROFESSOR.name,
      email: PROFESSOR.email,
      status: options.memberStatus ?? "active",
    });
  }
  const request: ReviewRequest = {
    id: "req-1",
    researchId: "research-1",
    title: "2장 선행연구 수정 검토",
    professorId: PROFESSOR.id,
    professorEmail: PROFESSOR.email,
    status: options?.status ?? "shared",
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  const round1: ReviewRound = {
    id: "round-1",
    requestId: request.id,
    itemId: "item-1",
    number: 1,
    title: "비교표",
    description: "1차 수정",
    feedbackExcerpt: "기준 보완",
    location: "1쪽",
    createdBy: STUDENT.id,
    createdByName: STUDENT.name,
    createdAt: "2026-11-17T10:00:00.000Z",
  };
  const round2: ReviewRound = {
    ...round1,
    id: "round-2",
    number: 2,
    description: "2차 수정",
    createdAt: STAMP,
  };
  data.reviews.push(request);
  data.reviewItems.push({
    id: "item-1",
    requestId: request.id,
    resultId: "result-1",
    title: "비교표",
  });
  data.rounds.push(round1, round2);
  return { data, request, round1, round2 };
}

describe("reviewPermissions (행동별 권한 판정)", () => {
  it("지정 교수만인 경우: 공유 중 최신 차수에서 읽기·댓글·응답만 허용하고 연구 관리 권한은 막는다", () => {
    const { data, request, round1, round2 } = makeFixture();
    // 교수 bootstrap에는 연구가 포함되지 않는다.
    const profData = { ...data, researches: [] };
    const latest = reviewPermissions(profData, request, PROFESSOR.id, round2);
    expect(latest).toEqual({
      canEditResearch: false,
      isDesignatedReviewer: true,
      isDualRole: false,
      canRead: true,
      canComment: true,
      canRespondOnLatestRound: true,
      canRespond: true,
      canRequestRecheck: false,
      canManageSharing: false,
      canShareRequest: false,
      canEditSourceResult: false,
    });

    const earlier = reviewPermissions(profData, request, PROFESSOR.id, round1);
    expect(earlier.canRead).toBe(true);
    expect(earlier.canComment).toBe(true);
    expect(earlier.canRespondOnLatestRound).toBe(true);
    expect(earlier.canRespond).toBe(false);
  });

  it("공동연구자이면서 지정 교수인 경우: 응답 권한과 기존 연구 관리 권한을 모두 유지한다", () => {
    const { data, request, round1, round2 } = makeFixture({
      professorIsCoauthor: true,
    });
    const latest = reviewPermissions(data, request, PROFESSOR.id, round2);
    expect(latest).toEqual({
      canEditResearch: true,
      isDesignatedReviewer: true,
      isDualRole: true,
      canRead: true,
      canComment: true,
      canRespondOnLatestRound: true,
      canRespond: true,
      canRequestRecheck: true,
      canManageSharing: true,
      canShareRequest: true,
      canEditSourceResult: true,
    });

    // 이전 차수에서는 응답만 막히고 읽기·댓글·연구 관리는 유지된다.
    const earlier = reviewPermissions(data, request, PROFESSOR.id, round1);
    expect(earlier.isDualRole).toBe(true);
    expect(earlier.canRespondOnLatestRound).toBe(true);
    expect(earlier.canRespond).toBe(false);
    expect(earlier.canRequestRecheck).toBe(true);
    expect(earlier.canManageSharing).toBe(true);
  });

  it("보낸 학생(연구 소유자)은 읽기·댓글·재검토·공유 관리는 가능하지만 교수 응답은 할 수 없다", () => {
    const { data, request, round2 } = makeFixture();
    const studentPerm = reviewPermissions(data, request, STUDENT.id, round2);
    expect(studentPerm).toEqual({
      canEditResearch: true,
      isDesignatedReviewer: false,
      isDualRole: false,
      canRead: true,
      canComment: true,
      canRespondOnLatestRound: false,
      canRespond: false,
      canRequestRecheck: true,
      canManageSharing: true,
      canShareRequest: true,
      canEditSourceResult: true,
    });
  });

  it("공유 중단 시: 지정 교수만이면 열람 불가, 공동연구자 겸 지정 교수는 읽기·공유 관리만 가능하고 응답·댓글·재검토는 불가", () => {
    const { data, request, round2 } = makeFixture({
      professorIsCoauthor: true,
      status: "stopped",
    });
    const profOnly = reviewPermissions(
      { ...data, researches: [], members: [] },
      request,
      PROFESSOR.id,
      round2,
    );
    expect(profOnly.canRead).toBe(false);
    expect(profOnly.canRespond).toBe(false);
    expect(profOnly.canComment).toBe(false);

    const dual = reviewPermissions(data, request, PROFESSOR.id, round2);
    expect(dual.canRead).toBe(true);
    expect(dual.canManageSharing).toBe(true);
    expect(dual.canShareRequest).toBe(true);
    expect(dual.canRespond).toBe(false);
    expect(dual.canRespondOnLatestRound).toBe(false);
    expect(dual.canComment).toBe(false);
    expect(dual.canRequestRecheck).toBe(false);
  });

  it("수락 대기 중인 초대 멤버나 휴지통에 간 연구, 외부인은 연구 편집/열람 권한을 얻지 못한다", () => {
    const pending = makeFixture({
      professorIsCoauthor: true,
      memberStatus: "pending",
    });
    const pendingPerm = reviewPermissions(
      pending.data,
      pending.request,
      PROFESSOR.id,
      pending.round2,
    );
    expect(pendingPerm.canEditResearch).toBe(false);
    expect(pendingPerm.isDualRole).toBe(false);
    expect(pendingPerm.canRespond).toBe(true);

    const trashed = makeFixture({
      professorIsCoauthor: true,
      researchDeleted: true,
    });
    expect(
      reviewPermissions(trashed.data, trashed.request, STUDENT.id, trashed.round2)
        .canRead,
    ).toBe(false);

    expect(
      reviewPermissions(pending.data, pending.request, STRANGER.id, pending.round2)
        .canRead,
    ).toBe(false);
  });

  it("공동연구자 겸 지정 교수도 학생이 보낸 새 검토 차수 알림을 받는다", () => {
    const { data } = makeFixture({ professorIsCoauthor: true });
    const events = unreadReviewNotifications(data, PROFESSOR);
    expect(events.map((e) => e.id).sort()).toEqual([
      "round:round-1",
      "round:round-2",
    ]);
  });
});
