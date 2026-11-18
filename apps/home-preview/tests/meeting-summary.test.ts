import { describe, expect, it } from "vitest";
import { summaryProposalOf } from "@/lib/meeting-summary";
import type { Meeting, SavedAICandidate } from "@/lib/domain";

const meeting = { id: "m1", title: "제6차" } as Meeting;
const candidate = (
  extra: Partial<SavedAICandidate> & { category?: string },
): SavedAICandidate =>
  ({
    id: extra.id ?? "c1",
    runId: "run-1",
    status: "pending",
    title: "",
    contexts: [{ kind: "meetings", id: "m1", title: "제6차" }],
    ...extra,
    candidate: {
      title: "",
      category: extra.category ?? "summary",
      body: "요약",
    },
  }) as SavedAICandidate;

describe("답 아래 요약 저장 (IA v2 06 §2.4)", () => {
  it("그 실행의 요약 제안과 기록을 찾는다", () => {
    const found = summaryProposalOf(
      "run-1",
      [candidate({ id: "f", category: "feedback" }), candidate({ id: "s" })],
      [meeting],
    );
    expect(found?.proposal.id).toBe("s");
    expect(found?.meeting.id).toBe("m1");
  });

  it("실행 id가 없거나 다른 실행이거나 기록이 없으면 없음", () => {
    expect(summaryProposalOf(undefined, [candidate({})], [meeting])).toBeNull();
    expect(summaryProposalOf("run-2", [candidate({})], [meeting])).toBeNull();
    expect(summaryProposalOf("run-1", [candidate({})], [])).toBeNull();
    expect(
      summaryProposalOf(
        "run-1",
        [candidate({})],
        [{ ...meeting, archivedAt: "2026-11-18" } as Meeting],
      ),
    ).toBeNull();
  });
});
