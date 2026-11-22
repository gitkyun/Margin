// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@montage-ui/core";
import {
  SUGGESTION_PREVIEW_LIMIT,
  SuggestionRows,
  type Organize,
} from "../src/components/meetings/OrganizeParts";
import type { Meeting, SavedAICandidate } from "../src/lib/domain";

vi.mock("@/lib/experience", () => ({
  useExperience: () => ({
    action: vi.fn(),
    save: vi.fn(),
  }),
}));

afterEach(cleanup);

function makeMeeting(id: string): Meeting {
  return {
    id,
    researchId: "r-1",
    title: "주간 지도 미팅",
    date: "2026-11-22",
    time: "14:00",
    status: "recorded",
    goal: "",
    memo: "원문 메모 내용",
    memoRevision: 1,
    visibility: "private",
    taskIds: [],
    versionIds: [],
    questionIds: [],
    createdAt: "2026-11-22T05:00:00Z",
    updatedAt: "2026-11-22T05:00:00Z",
  };
}

function makeSuggestions(count: number): SavedAICandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cand-${i + 1}`,
    researchId: "r-1",
    mode: "organize_meeting",
    status: "pending",
    candidate: {
      category: "feedback",
      title: `제안 항목 ${i + 1}`,
      body: `제안 본문 ${i + 1}`,
    },
    createdAt: `2026-11-22T05:${String(i).padStart(2, "0")}:00Z`,
    updatedAt: `2026-11-22T05:${String(i).padStart(2, "0")}:00Z`,
  }));
}

function makeOrganize(suggestions: SavedAICandidate[]): Organize {
  return {
    run: vi.fn(),
    stop: vi.fn(),
    running: false,
    startedAt: 0,
    error: null,
    dropped: 0,
    blocked: null,
    summary: undefined,
    suggestions,
    hasMyRecording: false,
  };
}

function renderRows(meeting: Meeting, count: number) {
  return render(
    <ThemeProvider>
      <SuggestionRows
        meeting={meeting}
        organize={makeOrganize(makeSuggestions(count))}
      />
    </ThemeProvider>,
  );
}

describe("SuggestionRows 접기·펼치기 (U5-03)", () => {
  it("제안이 5개 이하이면 모두 보여 주고 더 보기 버튼을 렌더하지 않는다", () => {
    const { container } = renderRows(
      makeMeeting("m-1"),
      SUGGESTION_PREVIEW_LIMIT,
    );
    expect(container.querySelectorAll(".organize-suggestion")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /더 보기/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "접기" })).toBeNull();
  });

  it("제안이 5개를 넘으면 처음 5개만 보이고 더 보기·접기로 토글할 수 있다", () => {
    const { container } = renderRows(makeMeeting("m-1"), 8);
    expect(container.querySelectorAll(".organize-suggestion")).toHaveLength(5);

    const moreBtn = screen.getByRole("button", { name: "더 보기 (3개 더)" });
    expect(moreBtn.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(moreBtn);
    expect(container.querySelectorAll(".organize-suggestion")).toHaveLength(8);
    const collapseBtn = screen.getByRole("button", { name: "접기" });
    expect(collapseBtn.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(collapseBtn);
    expect(container.querySelectorAll(".organize-suggestion")).toHaveLength(5);
    expect(
      screen
        .getByRole("button", { name: "더 보기 (3개 더)" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("다른 미팅으로 전환하면 펼침 상태가 기본(5개)으로 돌아간다", () => {
    const { container, rerender } = renderRows(makeMeeting("m-1"), 7);
    fireEvent.click(screen.getByRole("button", { name: "더 보기 (2개 더)" }));
    expect(container.querySelectorAll(".organize-suggestion")).toHaveLength(7);

    rerender(
      <ThemeProvider>
        <SuggestionRows
          meeting={makeMeeting("m-2")}
          organize={makeOrganize(makeSuggestions(7))}
        />
      </ThemeProvider>,
    );
    expect(container.querySelectorAll(".organize-suggestion")).toHaveLength(5);
    expect(
      screen
        .getByRole("button", { name: "더 보기 (2개 더)" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
