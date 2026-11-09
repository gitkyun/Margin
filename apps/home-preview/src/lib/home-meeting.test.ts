import { describe, expect, it } from "vitest";
import type { Meeting } from "./domain";
import { selectNextMeeting } from "./home-meeting";
const m = (id: string, status: Meeting["status"], date: string | null = null) =>
  ({ id, status, date, time: null }) as Meeting;
describe("home meeting target", () => {
  it("excludes overdue preparation even when preferred", () => {
    expect(
      selectNextMeeting(
        [m("past", "preparing", "2026-01-01")],
        "past",
        "2026-11-07",
      ),
    ).toBeUndefined();
  });
  it("does not reopen a completed preferred meeting", () => {
    expect(
      selectNextMeeting([m("old", "recorded"), m("next", "preparing")], "old")
        ?.id,
    ).toBe("next");
    expect(selectNextMeeting([m("old", "recorded")], "old")).toBeUndefined();
  });
  it("resumes an ongoing meeting before the next planned meeting", () => {
    expect(
      selectNextMeeting(
        [m("next", "preparing"), m("live", "recording")],
        "next",
      )?.id,
    ).toBe("live");
  });
  it("skips archived meetings and sorts dated meetings before undated ones", () => {
    expect(
      selectNextMeeting([
        { ...m("archived", "recording"), archivedAt: "2026-11-06" },
        m("undated", "preparing"),
        m("dated", "preparing", "2099-11-07"),
      ])?.id,
    ).toBe("dated");
  });
});
