import { describe, expect, it } from "vitest";
import {
  onboardingLeadLabel,
  onboardingMeeting,
  startChecklist,
  type ChecklistData,
} from "../src/lib/onboarding";

const TODAY = "2026-11-10";
const empty: ChecklistData = {
  meetings: [],
  recordings: [],
  feedback: [],
  tasks: [],
  documents: [],
  materials: [],
};
const rec = (patch: Record<string, unknown>) =>
  ({ id: "x", researchId: "r1", ...patch }) as never;

describe("onboardingMeeting", () => {
  it("keeps the chosen date and time", () => {
    expect(
      onboardingMeeting(
        { kind: "dated", date: "2026-11-13", time: "14:00" },
        TODAY,
      ),
    ).toEqual({ title: "지도 미팅", date: "2026-11-13", time: "14:00" });
  });
  it("drops the time when no date was chosen and treats it as undated", () => {
    expect(
      onboardingMeeting({ kind: "dated", date: "", time: "14:00" }, TODAY),
    ).toEqual({ title: "지도 미팅", date: null, time: null });
    expect(onboardingMeeting({ kind: "undated" }, TODAY)).toEqual({
      title: "지도 미팅",
      date: null,
      time: null,
    });
  });
  it("uses today and the current time for a meeting that just finished", () => {
    expect(onboardingMeeting({ kind: "just_finished" }, TODAY)).toEqual({
      title: "지도 미팅",
      date: TODAY,
      time: null,
    });
    // 지금 시각으로 남겨 홈에서 '지난 미팅 기록 남기기'가 되게 합니다(IA v2 03 §3).
    expect(
      onboardingMeeting({ kind: "just_finished" }, TODAY, "15:20"),
    ).toEqual({ title: "지도 미팅", date: TODAY, time: "15:20" });
  });
  it("creates nothing when the question is skipped or unanswered", () => {
    expect(onboardingMeeting({ kind: "skip" }, TODAY)).toBeNull();
    expect(onboardingMeeting(null, TODAY)).toBeNull();
  });
});

describe("onboardingLeadLabel", () => {
  it("matches the home lead action for each answer", () => {
    expect(
      onboardingLeadLabel(
        { kind: "dated", date: "2026-11-13", time: "" },
        TODAY,
      ),
    ).toBe("미팅 준비하기");
    expect(
      onboardingLeadLabel({ kind: "dated", date: TODAY, time: "" }, TODAY),
    ).toBe("녹음 시작");
    expect(onboardingLeadLabel({ kind: "just_finished" }, TODAY)).toBe(
      "지난 미팅 기록 남기기",
    );
    expect(onboardingLeadLabel({ kind: "undated" }, TODAY)).toBe(
      "미팅 준비하기",
    );
    expect(onboardingLeadLabel({ kind: "skip" }, TODAY)).toBe("다음 미팅 잡기");
  });
});

describe("startChecklist", () => {
  it("starts with four open items for an empty research", () => {
    const items = startChecklist(empty, "r1");
    expect(items.map((item) => item.key)).toEqual([
      "record",
      "feedback",
      "task",
      "material",
    ]);
    expect(items.every((item) => !item.done)).toBe(true);
    expect(items[0].href).toBe("/r/r1/meetings?new=1&intent=record");
  });

  it("counts a meeting record only when it has a memo or a recording", () => {
    const blank = rec({ id: "m1", memo: "  ", status: "preparing" });
    expect(
      startChecklist({ ...empty, meetings: [blank] }, "r1")[0],
    ).toMatchObject({
      done: false,
      href: "/r/r1/meetings/m1?tab=record#meeting-recording",
    });
    expect(
      startChecklist(
        { ...empty, meetings: [rec({ id: "m1", memo: "비교 기준 보완" })] },
        "r1",
      )[0].done,
    ).toBe(true);
    expect(
      startChecklist(
        { ...empty, meetings: [blank], recordings: [rec({ meetingId: "m1" })] },
        "r1",
      )[0].done,
    ).toBe(true);
  });

  it("derives the other items from existing records and ignores other researches and the trash", () => {
    const items = startChecklist(
      {
        ...empty,
        feedback: [rec({})],
        tasks: [rec({ archivedAt: "2026-11-09T00:00:00Z" })],
        documents: [rec({ researchId: "other" })],
        materials: [rec({})],
      },
      "r1",
    );
    expect(items.map((item) => item.done)).toEqual([false, true, false, true]);
  });
});
