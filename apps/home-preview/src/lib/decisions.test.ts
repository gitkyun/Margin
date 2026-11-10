import { describe, expect, it } from "vitest";
import type { Decision } from "./domain";
import { decisionLog, replaceableDecisions } from "./decisions";

const decision = (id: string, over: Partial<Decision> = {}): Decision => ({
  id,
  researchId: "r1",
  meetingId: "m1",
  text: `결정 ${id}`,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...over,
});
const meetings = [
  { id: "m1", title: "제5차", date: "2026-10-01" },
  { id: "m2", title: "제6차", date: "2026-11-01" },
];

describe("decisionLog", () => {
  it("orders decisions by meeting date, newest first", () => {
    const log = decisionLog(
      [decision("a"), decision("b", { meetingId: "m2" })],
      meetings,
      "r1",
    );
    expect(log.map((entry) => entry.decision.id)).toEqual(["b", "a"]);
    expect(log[0].meeting?.title).toBe("제6차");
  });

  it("links a decision to the one it replaces, in both directions", () => {
    const log = decisionLog(
      [decision("a"), decision("b", { meetingId: "m2", replacesId: "a" })],
      meetings,
      "r1",
    );
    const [newer, older] = log;
    expect(newer.replaces?.id).toBe("a");
    expect(older.replacedBy?.id).toBe("b");
    expect(newer.replacedBy).toBeUndefined();
  });

  it("leaves out other researches and archived decisions, and drops links to them", () => {
    const log = decisionLog(
      [
        decision("a", { archivedAt: "2026-10-02T00:00:00Z" }),
        decision("b", { meetingId: "m2", replacesId: "a" }),
        decision("c", { researchId: "r2" }),
      ],
      meetings,
      "r1",
    );
    expect(log.map((entry) => entry.decision.id)).toEqual(["b"]);
    expect(log[0].replaces).toBeUndefined();
  });

  it("falls back to the created date when the meeting is unknown", () => {
    const log = decisionLog(
      [
        decision("a", { meetingId: "gone", createdAt: "2026-11-05T00:00:00Z" }),
        decision("b", { meetingId: "m2" }),
      ],
      meetings,
      "r1",
    );
    expect(log.map((entry) => entry.decision.id)).toEqual(["a", "b"]);
  });
});

describe("replaceableDecisions", () => {
  const log = decisionLog(
    [
      decision("a"),
      decision("b", { meetingId: "m2", replacesId: "a" }),
      decision("c", { meetingId: "m2" }),
    ],
    meetings,
    "r1",
  );

  it("offers only decisions that have not been replaced yet", () => {
    expect(replaceableDecisions(log).map((d) => d.id)).toEqual(["b", "c"]);
  });

  it("when editing, hides itself and keeps the decision it already replaces", () => {
    expect(
      replaceableDecisions(log, { id: "b", replacesId: "a" }).map((d) => d.id),
    ).toEqual(["c", "a"]);
  });
});
