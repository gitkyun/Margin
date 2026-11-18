import type { Meeting, SavedAICandidate } from "@/lib/domain";
import type { useWorkspace } from "@/lib/workspace";

type Save = ReturnType<typeof useWorkspace>["save"];

/**
 * 미팅 정리의 요약 제안을 그 기록의 요약으로 저장하고 제안을 고른 것으로 남깁니다.
 * 기록 화면의 [요약 저장](IA v2 04 §5.4 ①)과 연구 도우미 답 아래 [요약 저장](06 §2.4)이 같이 씁니다.
 * 공유 기록이면 저장 전 확인은 부르는 쪽이 합니다.
 */
export async function keepSummary(
  save: Save,
  meeting: Meeting,
  proposal: SavedAICandidate,
): Promise<void> {
  await save("meetings", {
    ...meeting,
    summary: {
      text: proposal.candidate.body ?? "",
      createdAt: new Date().toISOString(),
      memoRevision: meeting.memoRevision,
      runId: proposal.runId,
    },
  });
  await save("aiCandidates", { ...proposal, status: "adopted" });
}

/** 한 실행에서 나온 요약 제안과 그 기록(연구 도우미 답 아래 [요약 저장]) */
export function summaryProposalOf(
  runId: string | undefined,
  candidates: SavedAICandidate[],
  meetings: Meeting[],
): { proposal: SavedAICandidate; meeting: Meeting } | null {
  if (!runId) return null;
  const proposal = candidates.find(
    (c) => c.runId === runId && c.candidate.category === "summary",
  );
  const meetingId = proposal?.contexts?.find((c) => c.kind === "meetings")?.id;
  const meeting = meetings.find((m) => m.id === meetingId && !m.archivedAt);
  return proposal && meeting ? { proposal, meeting } : null;
}
