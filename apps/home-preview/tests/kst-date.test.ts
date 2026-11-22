import { describe, expect, it } from "vitest";
import { kstDateKey, kstToday, type Decision, type Meeting, type Task } from "../src/lib/domain";
import { doneToday } from "../src/lib/task-groups";
import { selectHomeAction } from "../src/lib/home-action";
import { decisionLog } from "../src/lib/decisions";

describe("kstDateKey / kstToday (U7-02, U6-02, U5-10)", () => {
  it("UTC 자정 경계 시각을 한국 시간(Asia/Seoul) 날짜 키로 정확히 변환한다", () => {
    expect(kstDateKey("2026-11-21T16:30:00Z")).toBe("2026-11-22");
    expect(kstDateKey("2026-11-22T14:59:00Z")).toBe("2026-11-22");
    expect(kstDateKey("2026-11-22T15:00:00Z")).toBe("2026-11-23");
    expect(kstDateKey("2026-11-22")).toBe("2026-11-22");
  });

  it("잘못되거나 빈 입력은 빈 문자열을 돌려준다", () => {
    expect(kstDateKey("")).toBe("");
    expect(kstDateKey(null)).toBe("");
    expect(kstDateKey(undefined)).toBe("");
    expect(kstDateKey("not-a-date")).toBe("");
  });

  it("kstToday는 지정된 시각의 KST YYYY-MM-DD를 돌려준다", () => {
    expect(kstToday(new Date("2026-11-21T16:30:00Z"))).toBe("2026-11-22");
    expect(kstToday(new Date("2026-11-22T15:00:00Z"))).toBe("2026-11-23");
  });

  it("doneToday는 새벽(KST 00:00~09:00, UTC 전날) 완료한 할 일을 오늘 완료로 포함한다", () => {
    const baseTask: Task = {
      id: "t-1",
      researchId: "r-1",
      title: "새벽 완료 할 일",
      description: "",
      status: "done",
      dueDate: null,
      priority: "normal",
      feedbackIds: [],
      createdAt: "2026-11-20T00:00:00Z",
      updatedAt: "2026-11-21T16:30:00Z", // KST 2026-11-22 01:30
    };
    const yesterdayTask: Task = {
      ...baseTask,
      id: "t-2",
      updatedAt: "2026-11-21T14:59:00Z", // KST 2026-11-21 23:59
    };
    const result = doneToday([baseTask, yesterdayTask], "2026-11-22");
    expect(result.map((item) => item.id)).toEqual(["t-1"]);
  });

  it("selectHomeAction의 최근 7일 미정리 기록 판정이 KST 날짜 기준을 따른다", () => {
    const meeting: Meeting = {
      id: "m-1",
      researchId: "r-1",
      title: "7일 전 새벽 기록",
      date: "2026-11-15",
      time: "10:00",
      status: "recorded",
      goal: "",
      memo: "메모",
      memoRevision: 1,
      taskIds: [],
      versionIds: [],
      questionIds: [],
      createdAt: "2026-11-14T16:00:00Z",
      updatedAt: "2026-11-14T16:00:00Z", // KST 2026-11-15 01:00 (today 2026-11-22 기준 7일 이내)
    };
    const action = selectHomeAction({
      base: "/r/r-1",
      today: "2026-11-22",
      now: "10:00",
      meetings: [meeting],
      feedback: [],
    });
    expect(action.kind).toBe("sort_feedback");
  });

  it("decisionLog는 미팅 연결이 없는 결정도 KST 생성일 기준으로 정렬한다", () => {
    const dEarly: Decision = {
      id: "d-1",
      researchId: "r-1",
      meetingId: "missing-1",
      text: "이전 결정",
      createdAt: "2026-11-21T14:00:00Z", // KST 2026-11-21 23:00
      updatedAt: "2026-11-21T14:00:00Z",
    };
    const dNextMorning: Decision = {
      id: "d-2",
      researchId: "r-1",
      meetingId: "missing-2",
      text: "다음날 새벽 결정",
      createdAt: "2026-11-21T16:30:00Z", // KST 2026-11-22 01:30
      updatedAt: "2026-11-21T16:30:00Z",
    };
    const entries = decisionLog([dEarly, dNextMorning], [], "r-1");
    expect(entries.map((entry) => entry.decision.id)).toEqual(["d-2", "d-1"]);
  });
});
