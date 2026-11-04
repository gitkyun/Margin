import { describe, expect, it } from "vitest";
import { emptyWorkspace, type AppUser, type WorkspaceData } from "./domain";
import { notificationHref, unreadReviewNotifications } from "./notifications";
const student: AppUser = {
  id: "student",
  email: "student@example.test",
  name: "학생",
};
const professor: AppUser = {
  id: "professor",
  email: "professor@example.test",
  name: "교수",
};
const time = "2026-11-04T10:00:00.000Z";
function fixture(): WorkspaceData {
  const data = emptyWorkspace();
  data.researches.push({
    id: "research",
    ownerId: student.id,
    name: "개인 연구",
    description: "",
    createdAt: time,
    updatedAt: time,
  });
  data.reviews.push({
    id: "request",
    researchId: "research",
    title: "수정 결과",
    professorId: professor.id,
    professorEmail: professor.email,
    status: "shared",
    createdAt: time,
    updatedAt: time,
  });
  data.rounds.push({
    id: "round",
    requestId: "request",
    itemId: "item",
    number: 2,
    title: "비교표",
    description: "보완함",
    feedbackExcerpt: "기준 보완",
    location: "1쪽",
    createdAt: time,
  });
  data.responses.push({
    id: "response",
    roundId: "round",
    userId: professor.id,
    result: "changes_requested",
    comment: "기준을 보완하세요.",
    createdAt: time,
    updatedAt: time,
  });
  data.comments.push(
    {
      id: "p-comment",
      roundId: "round",
      userId: professor.id,
      authorName: "교수",
      body: "추가 설명",
      resolved: false,
      createdAt: time,
    },
    {
      id: "s-comment",
      roundId: "round",
      userId: student.id,
      authorName: "학생",
      body: "보완하겠습니다.",
      parentId: "p-comment",
      resolved: false,
      createdAt: time,
    },
  );
  return data;
}
describe("새 검토 소식과 계정별 읽음", () => {
  it("학생에게 교수 결과·댓글만 표시하고 본인의 답글은 제외한다", () => {
    const events = unreadReviewNotifications(fixture(), student);
    expect(events.map((e) => e.id).sort()).toEqual([
      "comment:p-comment",
      "response:response",
    ]);
    expect(notificationHref(events[0])).toBe(
      "/reviews/request?item=item&round=round",
    );
  });
  it("교수는 공유받은 새 차수·다른 작성자의 답글을 볼 수 있다", () => {
    const data = fixture();
    data.researches = []; // Professor bootstrap deliberately excludes private research.
    const events = unreadReviewNotifications(data, professor);
    expect(events.map((e) => e.id).sort()).toEqual([
      "comment:s-comment",
      "round:round",
    ]);
  });
  it("다른 계정의 읽음으로 읽음 처리하지 않고 본인이 연 항목만 제거한다", () => {
    const data = fixture();
    data.reads.push({
      userId: professor.id,
      roundId: "round",
      lastSeenAt: time,
    });
    expect(unreadReviewNotifications(data, student)).toHaveLength(2);
    data.reads.push({
      userId: student.id,
      roundId: "round",
      lastSeenAt: "2026-11-04T19:00:00+09:00",
    });
    expect(unreadReviewNotifications(data, student)).toEqual([]);
  });
  it("공유 중지·지정 변경·다른 연구의 제목과 건수를 노출하지 않는다", () => {
    const data = fixture();
    data.reviews[0].status = "stopped";
    expect(unreadReviewNotifications(data, professor)).toEqual([]);
    data.reviews[0].status = "shared";
    data.reviews[0].professorId = "different-professor";
    expect(unreadReviewNotifications(data, professor)).toEqual([]);
    expect(
      unreadReviewNotifications(data, { ...student, id: "stranger" }),
    ).toEqual([]);
    expect(
      unreadReviewNotifications(data, student, "another-research"),
    ).toEqual([]);
  });
});
