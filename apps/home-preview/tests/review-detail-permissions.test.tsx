// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@montage-ui/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyWorkspace,
  type AppUser,
  type ReviewRequest,
  type ReviewResponse,
  type WorkspaceData,
} from "../src/lib/domain";
import type { WorkspaceContextValue } from "../src/lib/workspace-contract";

const workspaceState = vi.hoisted(() => ({
  current: null as WorkspaceContextValue | null,
}));

vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => {
    if (!workspaceState.current)
      throw new Error("workspace mock not initialized");
    return workspaceState.current;
  },
}));

vi.mock("@/components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer-stub">PDF</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { ReviewDetailPage } from "../src/pages/reviews/ReviewDetailPage";

const STUDENT: AppUser = {
  id: "student-1",
  email: "student@example.test",
  name: "김학생",
};
const PROFESSOR: AppUser = {
  id: "professor-1",
  email: "professor@example.test",
  name: "이교수",
};
const STAMP = "2026-11-18T10:00:00.000Z";

function createData(options?: {
  includeResearch?: boolean;
  professorIsCoauthor?: boolean;
  status?: ReviewRequest["status"];
  responses?: ReviewResponse[];
}): WorkspaceData {
  const data = emptyWorkspace();
  if (options?.includeResearch ?? true) {
    data.researches.push({
      id: "research-1",
      ownerId: STUDENT.id,
      name: "공동 연구",
      description: "",
      createdAt: STAMP,
      updatedAt: STAMP,
    });
  }
  if (options?.professorIsCoauthor) {
    data.members.push({
      researchId: "research-1",
      userId: PROFESSOR.id,
      role: "editor",
      name: PROFESSOR.name,
      email: PROFESSOR.email,
      status: "active",
    });
  }
  data.results.push({
    id: "result-1",
    researchId: "research-1",
    title: "비교표 수정",
    description: "비교 기준 열 추가",
    feedbackIds: [],
    taskIds: [],
    kind: "other",
    location: "",
    createdAt: STAMP,
    updatedAt: STAMP,
  });
  data.reviews.push({
    id: "req-1",
    researchId: "research-1",
    title: "2장 선행연구 수정 검토",
    professorId: PROFESSOR.id,
    professorEmail: PROFESSOR.email,
    status: options?.status ?? "shared",
    createdAt: STAMP,
    updatedAt: STAMP,
  });
  data.reviewItems.push({
    id: "item-1",
    requestId: "req-1",
    resultId: "result-1",
    title: "비교표 수정",
  });
  data.rounds.push(
    {
      id: "round-1",
      requestId: "req-1",
      itemId: "item-1",
      number: 1,
      title: "비교표 수정",
      description: "1차 설명",
      feedbackExcerpt: "",
      location: "",
      createdBy: STUDENT.id,
      createdByName: STUDENT.name,
      createdAt: "2026-11-17T10:00:00.000Z",
    },
    {
      id: "round-2",
      requestId: "req-1",
      itemId: "item-1",
      number: 2,
      title: "비교표 수정",
      description: "2차 설명",
      feedbackExcerpt: "",
      location: "",
      createdBy: STUDENT.id,
      createdByName: STUDENT.name,
      createdAt: STAMP,
    },
  );
  if (options?.responses) data.responses.push(...options.responses);
  return data;
}

function makeContext(
  user: AppUser,
  data: WorkspaceData,
  overrides?: Partial<WorkspaceContextValue>,
): WorkspaceContextValue {
  return {
    data,
    user,
    mode: "connected",
    loading: false,
    error: null,
    refreshError: null,
    refresh: vi.fn(async () => {}),
    save: vi.fn(),
    saveResearch: vi.fn(),
    savePreparation: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
    openFile: vi.fn(),
    runAI: vi.fn(),
    createReview: vi.fn(),
    recheck: vi.fn(async () => {}),
    respond: vi.fn(async () => {}),
    comment: vi.fn(async () => {}),
    resolveComment: vi.fn(async () => {}),
    updateComment: vi.fn(async () => {}),
    deleteComment: vi.fn(async () => {}),
    setSharing: vi.fn(async () => {}),
    markRead: vi.fn(async () => {}),
    seedDemo: vi.fn(),
    signOut: vi.fn(async () => {}),
    ...overrides,
  } as unknown as WorkspaceContextValue;
}

import { NavigationGuardProvider } from "../src/lib/navigation-guard";

function renderReview(url = "/reviews/req-1", embedded = true) {
  const router = createMemoryRouter(
    [
      {
        path: "/reviews/:requestId",
        element: (
          <NavigationGuardProvider>
            <ReviewDetailPage embedded={embedded} />
          </NavigationGuardProvider>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  workspaceState.current = null;
});

afterEach(() => {
  cleanup();
});

describe("ReviewDetailPage 행동별 권한 화면 검증", () => {
  it("공동연구자 겸 지정 교수: 최신 차수에서 응답을 저장하고 다시 열 수 있으며, 연구 관리 동작은 보조 메뉴에 둔다", async () => {
    const data = createData({ professorIsCoauthor: true });
    const respond = vi.fn(async (input) => {
      data.responses.push({
        id: "resp-1",
        roundId: input.roundId,
        userId: PROFESSOR.id,
        result: input.result,
        comment: input.comment,
        createdAt: STAMP,
        updatedAt: STAMP,
      });
    });
    workspaceState.current = makeContext(PROFESSOR, data, { respond });

    const view = renderReview("/reviews/req-1?item=item-1&round=round-2", true);

    // 주 화면에는 연구 관리 버튼들이 직접 노출되지 않고 보조 메뉴로 모인다.
    expect(screen.getByRole("button", { name: "연구 관리 메뉴" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "다시 확인 요청" })).toBeNull();
    expect(screen.queryByRole("button", { name: "링크 복사" })).toBeNull();

    // 지정 교수로서 응답을 선택하고 저장할 수 있다.
    fireEvent.click(screen.getByLabelText("수정 내용 확인"));
    fireEvent.change(screen.getByLabelText("응답 댓글"), {
      target: { value: "표 1 기준을 확인했어요." },
    });
    fireEvent.click(screen.getByRole("button", { name: "응답 저장" }));

    await waitFor(() => {
      expect(respond).toHaveBeenCalledWith({
        roundId: "round-2",
        result: "confirmed",
        comment: "표 1 기준을 확인했어요.",
      });
    });

    // 저장된 응답을 다시 열어도 그대로 표시된다.
    view.unmount();
    workspaceState.current = makeContext(PROFESSOR, data, { respond });
    renderReview("/reviews/req-1?item=item-1&round=round-2", true);
    expect(screen.getAllByText("표 1 기준을 확인했어요.").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.getByRole("button", { name: "변경 내용 저장" })).toBeTruthy();
  });

  it("공동연구자 겸 지정 교수: 이전 검토 차수에서는 응답 폼 대신 최신 차수 안내를 보여 준다", () => {
    const data = createData({ professorIsCoauthor: true });
    workspaceState.current = makeContext(PROFESSOR, data);

    renderReview("/reviews/req-1?item=item-1&round=round-1", true);

    expect(screen.queryByRole("button", { name: "응답 저장" })).toBeNull();
    expect(
      screen.getByText(
        "이 항목은 2차 검토가 있어 1차에는 응답할 수 없어요. 최신 검토에서 결과를 남겨 주세요.",
      ),
    ).toBeTruthy();
  });

  it("공동연구자 겸 지정 교수: 공유 중단 시 열람과 연구 관리 보조 메뉴는 유지하되 응답은 막는다", () => {
    const data = createData({ professorIsCoauthor: true, status: "stopped" });
    workspaceState.current = makeContext(PROFESSOR, data);

    renderReview("/reviews/req-1?item=item-1&round=round-2", true);

    expect(
      screen.getByText(
        "공유를 중지한 검토예요. 교수님은 열 수 없고, 지금까지의 검토 기록은 그대로 남아요.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("공유 중일 때 응답할 수 있어요.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "응답 저장" })).toBeNull();
    expect(screen.getByRole("button", { name: "연구 관리 메뉴" })).toBeTruthy();
  });

  it("지정 교수만인 경우: 공유 중에는 응답 가능하고 연구 관리 메뉴가 없으며, 공유 중단 시 열 수 없다", () => {
    const sharedData = createData({
      includeResearch: false,
      professorIsCoauthor: false,
      status: "shared",
    });
    workspaceState.current = makeContext(PROFESSOR, sharedData);

    const view = renderReview("/reviews/req-1?item=item-1&round=round-2", false);
    expect(screen.getByRole("button", { name: "응답 저장" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "연구 관리 메뉴" })).toBeNull();

    view.unmount();
    const stoppedData = createData({
      includeResearch: false,
      professorIsCoauthor: false,
      status: "stopped",
    });
    workspaceState.current = makeContext(PROFESSOR, stoppedData);
    renderReview("/reviews/req-1?item=item-1&round=round-2", false);
    expect(screen.getByText("이 검토를 열 수 없어요")).toBeTruthy();
  });

  it("보낸 학생(연구 소유자): 응답 폼은 보이지 않고 공유 설정·링크 복사·다시 확인 요청을 바로 사용한다", () => {
    const data = createData({ professorIsCoauthor: false, status: "shared" });
    workspaceState.current = makeContext(STUDENT, data);

    renderReview("/reviews/req-1?item=item-1&round=round-2", true);

    expect(screen.getByText("교수님 응답은 여기에 보여요.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "응답 저장" })).toBeNull();
    expect(screen.getByRole("button", { name: "공유 설정" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "링크 복사" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 확인 요청" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "연구 관리 메뉴" })).toBeNull();
  });
});
