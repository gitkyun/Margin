// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Meeting, SavedAICandidate } from "../src/lib/domain";

const mocks = vi.hoisted(() => ({
  save: vi.fn(async (_kind: string, value: unknown) => value),
  action: vi.fn(async () => ({})),
  runAI: vi.fn(),
  candidates: [] as unknown[],
}));
const meeting = {
  id: "m1",
  researchId: "r1",
  title: "6차",
  date: "2026-11-13",
  time: null,
  status: "recorded",
  goal: "",
  memo: "비교 기준을 보완해 주세요.",
  memoRevision: 3,
  visibility: "private",
  taskIds: [],
  versionIds: [],
  questionIds: [],
  createdAt: "",
  updatedAt: "",
} as unknown as Meeting;
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({
    data: {
      recordings: [{ id: "rec1", meetingId: "m1", createdBy: "u1" }],
      aiCandidates: mocks.candidates,
    },
    user: { id: "u1", preferences: {} },
    mode: "connected",
    save: mocks.save,
    runAI: mocks.runAI,
  }),
}));
vi.mock("@/lib/experience", () => ({
  useExperience: () => ({ save: mocks.save, action: mocks.action }),
}));
vi.mock("@/lib/ai-capabilities", () => ({
  useAICapabilities: () => ({ data: { models: [] } }),
  resolveAISelection: () => ({ model: "m", thinking: "high" }),
}));
vi.mock("@/lib/ai-usage", () => ({ useAIUsage: () => ({ refetch: vi.fn() }) }));
vi.mock("@/lib/ai-availability", () => ({
  AINotConfiguredError: class extends Error {},
  useAINotConfigured: () => false,
}));
vi.mock("@/components/ConfirmDialog", () => ({
  useConfirm: () => [null, async () => true],
}));
import {
  organizeCandidates,
  SuggestionRows,
  SummaryBody,
  useOrganize,
} from "../src/components/meetings/OrganizeParts";

const saved = (
  id: string,
  candidate: SavedAICandidate["candidate"],
  contexts = [{ kind: "meetings", id: "m1", title: "6차" }],
): SavedAICandidate =>
  ({
    id,
    researchId: "r1",
    runId: "run",
    mode: "organize_meeting",
    contexts,
    title: candidate.title,
    candidate,
    status: "pending",
    createdAt: id,
    updatedAt: id,
  }) as SavedAICandidate;

function Both() {
  const organize = useOrganize(meeting, async () => meeting);
  return (
    <>
      <SummaryBody meeting={meeting} organize={organize} canRun />
      <SuggestionRows meeting={meeting} organize={organize} />
    </>
  );
}
afterEach(() => {
  cleanup();
  mocks.save.mockClear();
  mocks.action.mockClear();
});

describe("정리하기(IA v2 04 §5.4)", () => {
  it("이 기록의 제안만 고른다(메모 근거 또는 이 기록의 녹음)", () => {
    const list = [
      saved("a", { title: "x", category: "feedback" }),
      saved("b", { title: "y", category: "task" }, [
        { kind: "recordings", id: "rec1", title: "녹음" },
      ] as never),
      saved("c", { title: "z", category: "task" }, [
        { kind: "meetings", id: "other", title: "다른" },
      ]),
      {
        ...saved("d", { title: "w" }),
        status: "dismissed",
      } as SavedAICandidate,
    ];
    expect(
      organizeCandidates(meeting, list, new Set(["rec1"])).map((c) => c.id),
    ).toEqual(["a", "b"]);
  });

  it("요약 제안을 저장하고 AI 제안 줄을 선택해 메모 인용과 함께 저장한다", async () => {
    mocks.candidates.splice(
      0,
      mocks.candidates.length,
      saved("1", {
        title: "요약",
        category: "summary",
        body: "기준을 다뤘어요.",
      }),
      saved("2", {
        title: "기준 보완",
        category: "feedback",
        body: "비교 기준 보완",
        sourceQuote: "비교 기준",
        sourceKind: "memo",
        sourceStart: 0,
        sourceEnd: 5,
      }),
      saved("3", {
        title: "표 다시",
        category: "task",
        body: "표 다시",
        sourceQuote: "표를 다시",
        sourceKind: "transcript",
        recordingId: "rec1",
      }),
    );
    render(<Both />);
    expect(screen.getByText("기준을 다뤘어요.")).toBeTruthy();
    expect(screen.getByText("AI 제안 2개")).toBeTruthy();
    fireEvent.click(screen.getByText("요약 저장"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    const [kind, value] = mocks.save.mock.calls[0]! as [string, Meeting];
    expect(kind).toBe("meetings");
    expect(value.summary?.text).toBe("기준을 다뤘어요.");
    expect(value.summary?.memoRevision).toBe(3);
    expect((mocks.save.mock.calls[1]![1] as SavedAICandidate).status).toBe(
      "adopted",
    );
    fireEvent.click(screen.getAllByText("선택")[0]!);
    await waitFor(() => expect(mocks.action).toHaveBeenCalledTimes(1));
    const input = (mocks.action.mock.calls[0] as unknown[])[1] as {
      kind: string;
      value: Record<string, unknown>;
    };
    expect(input.kind).toBe("feedback");
    expect(input.value.sourceQuote).toBe("비교 기준");
    expect(input.value.sourceMemoRevision).toBe(3);
    fireEvent.click(screen.getAllByText("선택")[1]!);
    await waitFor(() => expect(mocks.action).toHaveBeenCalledTimes(2));
    const task = (mocks.action.mock.calls[1] as unknown[])[1] as {
      kind: string;
      value: Record<string, unknown>;
    };
    expect(task.kind).toBe("tasks");
    expect(task.value.sourceRecordId).toBe("m1");
    // 전사문에서 나온 제안은 메모 인용을 남기지 않습니다.
    expect(task.value.sourceQuote).toBeUndefined();
  });
});
