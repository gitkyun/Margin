// @vitest-environment jsdom
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@montage-ui/core";
import { emptyWorkspace, type WorkspaceData } from "../src/lib/domain";
import { reviewPermissions } from "../src/lib/review-permissions";
import { ReviewDetailPage } from "../src/pages/reviews/ReviewDetailPage";

const workspaceState = vi.hoisted(() => ({
  value: null as unknown,
}));

vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => workspaceState.value,
}));

vi.mock("@/components/settings/SettingsDialog", () => ({
  SettingsDialog: () => null,
  useOpenSettings: () => vi.fn(),
}));

vi.mock("@/components/PdfViewer", () => ({
  PdfViewer: () => null,
}));

vi.mock("@/pages/reviews/ReviewNotifyBar", () => ({
  ReviewNotifyBar: () => null,
}));

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/lib/navigation-guard", () => ({
  useNavigationGuard: () => {},
}));

afterEach(cleanup);

function buildWorkspace({
  includeResearch,
  includeProfessorMember,
}: {
  includeResearch: boolean;
  includeProfessorMember: boolean;
}): WorkspaceData {
  const data = emptyWorkspace();
  const stamp = "2026-11-22T05:00:00Z";
  if (includeResearch) {
    data.researches.push({
      id: "res-1",
      ownerId: "student-1",
      name: "대학원생 연구 도구 사용 경험",
      description: "",
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  if (includeProfessorMember) {
    data.members.push({
      researchId: "res-1",
      userId: "prof-1",
      role: "editor",
      name: "신정훈",
      email: "prof@example.com",
      status: "active",
    });
  }
  data.reviews.push({
    id: "req-1",
    researchId: "res-1",
    title: "2장 수정 내용 검토 요청",
    professorEmail: "prof@example.com",
    professorId: "prof-1",
    status: "shared",
    createdAt: stamp,
    updatedAt: stamp,
  });
  data.reviewItems.push({
    id: "item-1",
    requestId: "req-1",
    resultId: "result-1",
    title: "연구 질문 범위 조정",
  });
  data.rounds.push({
    id: "round-1",
    requestId: "req-1",
    itemId: "item-1",
    number: 1,
    title: "연구 질문 범위 조정",
    description: "연구 질문을 두 개로 좁혔습니다.",
    feedbackExcerpt: "",
    location: "",
    createdAt: stamp,
  });
  return data;
}

function renderReviewPage({
  userId,
  email,
  name,
  data,
  embedded = false,
}: {
  userId: string;
  email: string;
  name: string;
  data: WorkspaceData;
  embedded?: boolean;
}) {
  workspaceState.value = {
    data,
    user: { id: userId, email, name },
    mode: "connected",
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    respond: vi.fn().mockResolvedValue(undefined),
    comment: vi.fn().mockResolvedValue(undefined),
    resolveComment: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
    recheck: vi.fn().mockResolvedValue(undefined),
    setSharing: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/reviews/req-1?item=item-1&round=round-1"]}>
        <Routes>
          <Route
            path="/reviews/:requestId"
            element={<ReviewDetailPage embedded={embedded} />}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("교수 검토 행동별 권한 판정 (U10-01)", () => {
  it("편집자 멤버인 교수도 이 검토의 지정 교수이면 응답 폼(라디오·저장 버튼)이 보인다", () => {
    const data = buildWorkspace({
      includeResearch: true,
      includeProfessorMember: true,
    });
    const perms = reviewPermissions(data.reviews[0], "prof-1", data);
    expect(perms.canManageResearch).toBe(true);
    expect(perms.isAssignedProfessor).toBe(true);
    expect(perms.canRespondLatest).toBe(true);

    renderReviewPage({
      userId: "prof-1",
      email: "prof@example.com",
      name: "신정훈",
      data,
      embedded: true,
    });

    expect(
      screen.getByRole("radio", { name: "수정 내용 확인" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "추가 수정 필요" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "응답 저장" })).toBeTruthy();
  });

  it("멤버가 아닌 지정 교수도 기존처럼 응답 폼이 보인다", () => {
    const data = buildWorkspace({
      includeResearch: false,
      includeProfessorMember: false,
    });
    const perms = reviewPermissions(data.reviews[0], "prof-1", data);
    expect(perms.canManageResearch).toBe(false);
    expect(perms.isAssignedProfessor).toBe(true);
    expect(perms.canRespondLatest).toBe(true);

    renderReviewPage({
      userId: "prof-1",
      email: "prof@example.com",
      name: "신정훈",
      data,
      embedded: false,
    });

    expect(
      screen.getByRole("radio", { name: "수정 내용 확인" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "추가 수정 필요" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "응답 저장" })).toBeTruthy();
  });

  it("학생 소유자는 응답 폼 없이 기존 안내 문구만 보인다", () => {
    const data = buildWorkspace({
      includeResearch: true,
      includeProfessorMember: true,
    });
    const perms = reviewPermissions(data.reviews[0], "student-1", data);
    expect(perms.canManageResearch).toBe(true);
    expect(perms.isAssignedProfessor).toBe(false);
    expect(perms.canRespondLatest).toBe(false);

    renderReviewPage({
      userId: "student-1",
      email: "student@example.com",
      name: "김학생",
      data,
      embedded: true,
    });

    expect(screen.queryByRole("radio", { name: "수정 내용 확인" })).toBeNull();
    expect(screen.getByText("교수님 응답은 여기에 보여요.")).toBeTruthy();
  });
});
