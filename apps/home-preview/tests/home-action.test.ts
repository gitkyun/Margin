import { describe, expect, it } from "vitest";
import { selectHomeAction } from "../src/lib/home-action";
import type { Feedback, Meeting } from "../src/lib/domain";

const TODAY = "2026-11-10";
const base = "/r/r1";

function meeting(patch: Partial<Meeting>): Meeting {
  return {
    id: "m1",
    researchId: "r1",
    title: "제6차 논문 지도",
    date: "2026-11-13",
    time: "14:00",
    status: "preparing",
    goal: "",
    memo: "",
    memoRevision: 0,
    taskIds: [],
    versionIds: [],
    questionIds: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...patch,
  } as Meeting;
}

function pick(input: {
  next?: Meeting;
  meetings?: Meeting[];
  feedback?: Pick<Feedback, "meetingId" | "archivedAt">[];
  updateHref?: string;
}) {
  return selectHomeAction({
    base,
    today: TODAY,
    next: input.next,
    meetings: input.meetings ?? (input.next ? [input.next] : []),
    feedback: input.feedback ?? [],
    updateHref: input.updateHref,
  });
}

describe("selectHomeAction", () => {
  it("puts an unread professor response ahead of everything else", () => {
    const action = pick({
      next: meeting({ date: TODAY }),
      updateHref: "/r/r1/reviews/v1",
    });
    expect(action).toMatchObject({
      kind: "check_responses",
      label: "응답 확인하기",
      href: "/r/r1/reviews/v1",
    });
  });

  it("starts recording when the next meeting is today or already recording", () => {
    expect(pick({ next: meeting({ date: TODAY }) })).toMatchObject({
      kind: "record_meeting",
      label: "기록 시작",
      href: "/r/r1/meetings/m1?tab=record#meeting-recording",
    });
    expect(
      pick({ next: meeting({ status: "recording", date: "2026-11-09" }) }).kind,
    ).toBe("record_meeting");
  });

  it("prepares the meeting when it is days away or has no date yet", () => {
    expect(pick({ next: meeting({}) })).toMatchObject({
      kind: "prepare_meeting",
      label: "미팅 준비하기",
      href: "/r/r1/meetings/m1?tab=prepare",
    });
    expect(pick({ next: meeting({ date: null }) }).kind).toBe(
      "prepare_meeting",
    );
  });

  it("asks to sort feedback from the latest recorded meeting that has none", () => {
    const older = meeting({ id: "m0", status: "recorded", date: "2026-10-20" });
    const latest = meeting({
      id: "m2",
      status: "recorded",
      date: "2026-11-06",
    });
    expect(pick({ meetings: [older, latest] })).toMatchObject({
      kind: "sort_feedback",
      label: "피드백 정리하기",
      href: "/r/r1/meetings/m2?tab=record",
    });
    // 이미 피드백을 정리한 미팅은 다시 권하지 않습니다.
    expect(
      pick({
        meetings: [older, latest],
        feedback: [{ meetingId: "m2" }, { meetingId: "m0" }],
      }).kind,
    ).toBe("create_meeting");
    // 휴지통에 있는 피드백은 정리한 것으로 치지 않습니다.
    expect(
      pick({
        meetings: [latest],
        feedback: [{ meetingId: "m2", archivedAt: "2026-11-07T00:00:00Z" }],
      }).kind,
    ).toBe("sort_feedback");
  });

  it("offers a new meeting when nothing is scheduled", () => {
    expect(pick({})).toMatchObject({
      kind: "create_meeting",
      label: "미팅 만들기",
      href: "/r/r1/meetings?new=1",
    });
  });
});
