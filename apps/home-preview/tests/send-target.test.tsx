// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const sends = vi.hoisted(() => ({ review: vi.fn(), invite: vi.fn() }));
vi.mock("@/lib/review-notify", () => ({
  canNotifyAgain: () => true,
  readNotifyRecord: () => null,
  requestReviewNotify: sends.review,
  reviewNotifyAvailable: async () => true,
}));
vi.mock("@/lib/project-invites", () => ({
  listProjectInvites: async () => [],
  sendProjectInvite: sends.invite,
  resendProjectInvite: vi.fn(),
  revokeProjectInvite: vi.fn(),
  roleLabel: () => "공동연구자",
  emailFailureMessage: () => "오류",
}));
import { ReviewNotifyBar } from "../src/pages/reviews/ReviewNotifyBar";
import { ProjectInvites } from "../src/pages/settings/ProjectInvites";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("검토 요청을 바꾸면 이전 예약 발송과 초안을 취소한다", async () => {
  const props = {
    professorEmail: "professor@example.test",
    status: "shared" as const,
    preview: false,
  };
  const view = render(<ReviewNotifyBar {...props} requestId="a" />);
  await act(async () => {});
  fireEvent.click(
    screen.getByRole("button", { name: "교수님께 메일로도 알리기" }),
  );
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "메일 발송 요청하기" }));
  view.rerender(<ReviewNotifyBar {...props} requestId="b" />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(sends.review).not.toHaveBeenCalled();
  expect(screen.queryByText("이메일 초안 미리보기")).toBeNull();
});
it("연구를 바꾸면 이전 초대 예약을 취소한다", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = (researchId: string) => (
    <QueryClientProvider client={client}>
      <ProjectInvites
        researchId={researchId}
        canInviteEditor
        canInviteAdvisor={false}
      />
    </QueryClientProvider>
  );
  const view = render(ui("a"));
  await act(async () => {});
  fireEvent.change(screen.getByRole("textbox", { name: "초대할 이메일" }), {
    target: { value: "person@example.test" },
  });
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "초대 메일 보내기" }));
  view.rerender(ui("b"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(sends.invite).not.toHaveBeenCalled();
  expect(
    (screen.getByRole("textbox", { name: "초대할 이메일" }) as HTMLInputElement)
      .value,
  ).toBe("");
  client.clear();
});
