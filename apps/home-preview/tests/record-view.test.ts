import { describe, expect, it } from "vitest";
import {
  carriedTasks,
  isMeetingRecord,
  recordGroups,
  recordItems,
  recordMode,
} from "../src/lib/record-view";
import type {
  Feedback,
  Meeting,
  MeetingPoll,
  ReviewRequest,
  Task,
} from "../src/lib/domain";

const TODAY = "2026-11-17";

function meeting(id: string, patch: Partial<Meeting> = {}): Meeting {
  return {
    id,
    researchId: "r1",
    title: id,
    date: null,
    time: null,
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
  };
}
const task = (id: string, patch: Partial<Task> = {}) =>
  ({
    id,
    researchId: "r1",
    status: "todo",
    feedbackIds: [],
    ...patch,
  }) as Task;
const fb = (id: string, meetingId: string) =>
  ({ id, researchId: "r1", meetingId }) as Feedback;
const empty = { feedback: [], decisions: [], questions: [], tasks: [] };

describe("기록 계산(IA v2 08 §4)", () => {
  it("§4.0 서면 피드백은 미팅이 아니다", () => {
    expect(isMeetingRecord({})).toBe(true);
    expect(isMeetingRecord({ recordType: "meeting" })).toBe(true);
    expect(isMeetingRecord({ recordType: "written" })).toBe(false);
  });

  it("§4.4 기록의 할 일: 기록에서 바로 만든 것 + 그 기록 피드백에 딸린 것, 남은 수", () => {
    const items = recordItems(meeting("m1"), {
      ...empty,
      feedback: [fb("f1", "m1"), fb("f2", "m2")],
      tasks: [
        task("a", { sourceRecordId: "m1" }),
        task("b", { feedbackIds: ["f1"], status: "done" }),
        task("c", { feedbackIds: ["f2"] }),
        task("d", { sourceRecordId: "m1", archivedAt: "x" }),
      ],
    });
    expect(items.tasks.map((x) => x.id)).toEqual(["a", "b"]);
    expect(items.remaining).toBe(1);
  });

  it("§4.5 넘어온 할 일은 앞선 기록의 남은 할 일 중 아직 가져가지 않은 것", () => {
    const next = meeting("n", { date: "2026-11-20", taskIds: ["b"] });
    const data = {
      ...empty,
      meetings: [
        meeting("old", { date: "2026-11-13", status: "recorded" }),
        meeting("later", { date: "2026-11-25", status: "recorded" }),
        next,
      ],
      tasks: [
        task("a", { sourceRecordId: "old" }),
        task("b", { sourceRecordId: "old" }),
        task("c", { sourceRecordId: "old", status: "done" }),
        task("d", { sourceRecordId: "later" }),
      ],
    };
    expect(carriedTasks(next, data).map((x) => x.id)).toEqual(["a"]);
  });

  it("§4.3 모드", () => {
    const m = (patch: Partial<Meeting>) => meeting("m", patch);
    expect(recordMode(m({}), true)).toBe("recording");
    expect(recordMode(m({ status: "recording" }), false)).toBe("unfinished");
    expect(recordMode(m({ memo: "메모" }), false)).toBe("drafting");
    expect(recordMode(m({}), false)).toBe("prepare");
    expect(recordMode(m({ status: "recorded" }), false)).toBe("recorded");
    expect(recordMode(m({ recordType: "written" }), false)).toBe("recorded");
    expect(recordMode(m({ status: "cancelled" }), false)).toBe("cancelled");
    expect(recordMode(m({ status: "recorded" }), false, "prepare")).toBe(
      "prepare",
    );
    // 끝난 기록에 mode=record가 와도 녹음을 새로 붙이지 않습니다.
    expect(recordMode(m({ status: "recorded" }), false, "record")).toBe(
      "recorded",
    );
    expect(recordMode(m({}), false, "record")).toBe("drafting");
    expect(recordMode(m({ recordType: "written" }), false, "prepare")).toBe(
      "recorded",
    );
  });

  it("§4.2 지금 → 예정(가까운 순) → 지난 기록(월별 최신순), 취소는 켤 때만", () => {
    const review = {
      id: "q",
      researchId: "r1",
      title: "검토",
      createdAt: "2026-11-10T00:00:00Z",
    } as ReviewRequest;
    const poll = {
      id: "p",
      researchId: "r1",
      title: "7차 시간",
      status: "open",
      options: [{ id: "o", start: "2026-11-22T05:00:00Z", end: "" }],
      participants: [],
      updatedAt: "",
    } as unknown as MeetingPoll;
    const groups = recordGroups({
      researchId: "r1",
      today: TODAY,
      reviews: [review],
      polls: [poll],
      ...empty,
      recordingId: "rec",
      meetings: [
        meeting("rec", { date: "2026-11-17" }),
        meeting("n2", { date: "2026-11-25" }),
        meeting("n1", { date: "2026-11-20" }),
        meeting("undated"),
        meeting("past", { date: "2026-11-13", status: "recorded" }),
        meeting("miss", { date: "2026-11-06" }),
        meeting("oct", { date: "2026-10-30", status: "recorded" }),
        meeting("cxl", { date: "2026-11-05", status: "cancelled" }),
        meeting("w", {
          date: "2026-11-12",
          recordType: "written",
          status: "recorded",
        }),
      ],
    });
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ["now", ["rec"]],
      ["upcoming", ["n1", "p", "n2", "undated"]],
      ["2026-11", ["past", "w", "q", "miss"]],
      ["2026-10", ["oct"]],
    ]);
    const missing = groups[2]!.rows.find((r) => r.id === "miss");
    expect(missing?.kind === "meeting" && missing.state).toBe("unrecorded");
    const withCancelled = recordGroups({
      researchId: "r1",
      today: TODAY,
      reviews: [],
      polls: [],
      ...empty,
      meetings: [meeting("cxl", { date: "2026-11-05", status: "cancelled" })],
      showCancelled: true,
    });
    expect(withCancelled[0]!.rows.map((r) => r.id)).toEqual(["cxl"]);
  });

  it("§4.2 보기: 남은 할 일·서면·검토·조율", () => {
    const base = {
      researchId: "r1",
      today: TODAY,
      reviews: [
        {
          id: "q",
          researchId: "r1",
          title: "검토",
          createdAt: "2026-11-10T00:00:00Z",
        } as ReviewRequest,
      ],
      polls: [],
      ...empty,
      tasks: [task("t", { sourceRecordId: "a" })],
      meetings: [
        meeting("a", { date: "2026-11-13", status: "recorded" }),
        meeting("b", { date: "2026-11-12", status: "recorded" }),
        meeting("w", {
          date: "2026-11-11",
          status: "recorded",
          recordType: "written",
        }),
      ],
    };
    const ids = (filter: "open" | "written" | "review") =>
      recordGroups({ ...base, filter }).flatMap((g) => g.rows.map((r) => r.id));
    expect(ids("open")).toEqual(["a"]);
    expect(ids("written")).toEqual(["w"]);
    expect(ids("review")).toEqual(["q"]);
  });
});
