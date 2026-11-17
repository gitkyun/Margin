import { describe, expect, it } from "vitest";
import {
  selectHomeAction,
  type UnreadChangesRequest,
} from "../src/lib/home-action";
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
  now?: string;
  recordingMeetingId?: string | null;
  unreadChangesRequested?: UnreadChangesRequest[];
}) {
  return selectHomeAction({
    base,
    today: TODAY,
    now: input.now ?? "10:00",
    recordingMeetingId: input.recordingMeetingId,
    next: input.next,
    meetings: input.meetings ?? (input.next ? [input.next] : []),
    feedback: input.feedback ?? [],
    unreadChangesRequested: input.unreadChangesRequested,
  });
}

const changes: UnreadChangesRequest = {
  title: "선행연구 표 수정",
  href: "/reviews/q1?round=1",
  createdAt: "2026-11-09T05:00:00Z",
};
const pastUnrecorded = meeting({ id: "m3", date: "2026-11-06" });
const recordedNoFeedback = meeting({
  id: "m5",
  status: "recorded",
  date: "2026-11-08",
  updatedAt: "2026-11-08T09:00:00Z",
});

describe("selectHomeAction (IA v2 03 §3)", () => {
  it("1. 녹음 중인 기록이 있으면 그 기록으로 돌아가기가 알림 줄에 뜬다", () => {
    const action = pick({
      recordingMeetingId: "m1",
      next: meeting({ date: TODAY }),
      unreadChangesRequested: [changes],
    });
    expect(action).toMatchObject({
      kind: "return_to_recording",
      label: "기록으로 돌아가기",
      notice: "지금 녹음 중이에요.",
      href: "/r/r1/meetings/m1?tab=record#meeting-recording",
    });
    // 다른 연구의 녹음이거나 없는 기록이면 고르지 않습니다.
    expect(pick({ recordingMeetingId: "nope" }).kind).toBe("create_meeting");
  });

  it("2. 오늘이고 시각이 지금 이후이거나 없는 준비 중 미팅은 녹음 시작(카드)", () => {
    for (const time of ["14:00", null]) {
      const action = pick({
        next: meeting({ date: TODAY, time }),
        unreadChangesRequested: [changes],
      });
      expect(action).toMatchObject({
        kind: "record_meeting",
        label: "녹음 시작",
      });
      expect(action.notice).toBeUndefined();
    }
  });

  it("2→4. 시각이 지난 오늘 미팅('방금 마침' 포함)은 지난 미팅 기록 남기기로 간다", () => {
    const action = pick({
      meetings: [meeting({ date: TODAY, time: "09:30" })],
      now: "10:00",
    });
    expect(action).toMatchObject({
      kind: "record_past_meeting",
      notice: "11월 10일 미팅 기록이 아직 없어요.",
    });
  });

  it("3. 안 읽은 '추가 수정 필요' 응답은 가장 최근 것을 알림 줄로", () => {
    const older = {
      ...changes,
      title: "예전",
      createdAt: "2026-11-01T00:00:00Z",
    };
    expect(
      pick({
        next: meeting({}),
        meetings: [pastUnrecorded, meeting({})],
        unreadChangesRequested: [older, changes],
      }),
    ).toMatchObject({
      kind: "open_review_response",
      label: "교수 응답 보기",
      href: "/reviews/q1?round=1",
      notice: "교수님이 ‘선행연구 표 수정’에 추가 수정 필요를 남겼어요.",
    });
  });

  it("4. 최근 14일 안의 기록 없는 지난 미팅, 그보다 오래된 것은 빼고", () => {
    const old = meeting({ id: "m4", date: "2026-10-20" });
    expect(
      pick({
        next: meeting({}),
        meetings: [old, pastUnrecorded, recordedNoFeedback, meeting({})],
      }),
    ).toMatchObject({
      kind: "record_past_meeting",
      label: "지난 미팅 기록 남기기",
      href: "/r/r1/meetings/m3?tab=record",
      notice: "11월 6일 미팅 기록이 아직 없어요.",
    });
    expect(pick({ meetings: [old] }).kind).toBe("create_meeting");
  });

  it("5. 최근 7일 안에 기록했는데 피드백이 없으면 기록 정리하기", () => {
    expect(
      pick({ next: meeting({}), meetings: [recordedNoFeedback, meeting({})] }),
    ).toMatchObject({
      kind: "sort_feedback",
      label: "기록 정리하기",
      href: "/r/r1/meetings/m5?tab=record",
      notice: "지난 미팅에서 나온 할 일을 아직 정리하지 않았어요.",
    });
    // 피드백이 있거나, 7일보다 오래됐으면 고르지 않습니다. 휴지통 피드백은 세지 않습니다.
    expect(
      pick({ meetings: [recordedNoFeedback], feedback: [{ meetingId: "m5" }] })
        .kind,
    ).toBe("create_meeting");
    expect(
      pick({
        meetings: [
          { ...recordedNoFeedback, updatedAt: "2026-11-01T00:00:00Z" },
        ],
      }).kind,
    ).toBe("create_meeting");
    expect(
      pick({
        meetings: [recordedNoFeedback],
        feedback: [{ meetingId: "m5", archivedAt: "2026-11-09T00:00:00Z" }],
      }).kind,
    ).toBe("sort_feedback");
  });

  it("6. 다음 미팅이 있으면 미팅 준비하기, 준비한 내용이 있으면 준비 이어하기", () => {
    expect(pick({ next: meeting({}) })).toMatchObject({
      kind: "prepare_meeting",
      label: "미팅 준비하기",
      href: "/r/r1/meetings/m1?tab=prepare",
    });
    expect(pick({ next: meeting({ taskIds: ["t1"] }) }).label).toBe(
      "준비 이어하기",
    );
    expect(pick({ next: meeting({ date: null }) }).notice).toBeUndefined();
  });

  it("7. 다음 미팅이 없으면 다음 미팅 잡기", () => {
    expect(pick({})).toMatchObject({
      kind: "create_meeting",
      label: "다음 미팅 잡기",
      href: "/r/r1/meetings?new=1",
    });
  });

  it("보관한 미팅은 어느 경우에도 고르지 않는다", () => {
    expect(
      pick({
        meetings: [{ ...pastUnrecorded, archivedAt: "2026-11-07T00:00:00Z" }],
      }).kind,
    ).toBe("create_meeting");
  });
});
