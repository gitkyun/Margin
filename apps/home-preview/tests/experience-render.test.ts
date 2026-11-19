// @vitest-environment jsdom
import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import {
  render,
  cleanup,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emptyWorkspace } from "../src/lib/domain";
import { NavigationGuardProvider } from "../src/lib/navigation-guard";
const state = vi.hoisted(() => ({ workspace: null as any }));
vi.mock("../src/lib/workspace", () => ({
  useWorkspace: () => state.workspace,
  useOptionalWorkspace: () => state.workspace,
}));
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLCanvasElement.prototype.getContext = (() => null) as any;
  Element.prototype.scrollIntoView = () => {};
  state.workspace = {
    data: {
      ...emptyWorkspace(),
      researches: [
        {
          id: "r1",
          name: "테스트 연구",
          ownerId: "u1",
          description: "흐름 검증",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    user: { id: "u1", name: "연구자", email: "u@example.test" },
    mode: "preview",
    loading: false,
    save: vi.fn(),
    refresh: vi.fn(),
    saveResearch: vi.fn(),
    upload: vi.fn(),
    runAI: vi.fn(),
  };
});
afterEach(cleanup);
async function page(
  Component: React.ComponentType,
  path = "/r/r1",
  route = "/r/:researchId/*",
) {
  const router = createMemoryRouter(
    [
      {
        path: route,
        element: React.createElement(
          NavigationGuardProvider,
          null,
          React.createElement(Component),
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(
    React.createElement(
      QueryClientProvider,
      {
        client: new QueryClient({
          defaultOptions: { queries: { retry: false } },
        }),
      },
      React.createElement(RouterProvider, { router }),
    ),
  );
}
describe("experience pages render with an empty research", () => {
  it("home shows actual empty states without invented totals", async () => {
    const { HomePage } = await import("../src/pages/HomePage");
    await page(HomePage);
    expect(screen.getByRole("heading", { name: "테스트 연구" })).toBeTruthy();
    // 기록이 하나도 없는 연구(IA v2 03 §9)
    expect(screen.getByText("아직 기록이 없어요.")).toBeTruthy();
    // 빈 연구에는 시작 체크리스트가 0/4로 보이고 주 행동은 다음 미팅 잡기 하나입니다(IA v2 03 §3의 7번).
    expect(screen.getByRole("heading", { name: /시작하기/ })).toBeTruthy();
    expect(screen.getByText("0 / 4")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: /다음 미팅 잡기/ })
        .some((link) => link.getAttribute("data-action") === "create_meeting"),
    ).toBe(true);
  });
  it("writing is usable without existing documents", async () => {
    const { WritingPage } = await import("../src/pages/WritingPage");
    await page(WritingPage, "/r/r1/writing");
    expect(screen.getByText("아직 문서가 없어요")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "계획서 만들기" }).length,
    ).toBeGreaterThan(0);
  });
  it("assistant panel keeps suggestions and run history in its own views", async () => {
    const { ResearchAssistant } =
      await import("../src/pages/ResearchAssistant");
    // 연구 도우미는 사이드 창 하나뿐입니다(예전 전체 화면은 5단계에 지움).
    await page(ResearchAssistant, "/r/r1");
    const views = screen.getByRole("tablist", { name: "연구 도우미 보기" });
    expect(
      Array.from(views.querySelectorAll("[role=tab]")).map(
        (tab) => tab.textContent,
      ),
    ).toEqual(["대화", "제안", "실행 내역"]);
    expect(screen.queryByRole("tab", { name: "사용량" })).toBeNull();
    // 연구 기록을 항상 전부 읽으므로 기록을 고르는 근거 탭은 없어요.
    expect(screen.queryByRole("tab", { name: /근거/ })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /제안/ }));
    await waitFor(() =>
      expect(
        screen.getByText("AI 제안이 나오면 여기에 표시돼요."),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("tab", { name: "실행 내역" }));
    await waitFor(() =>
      expect(screen.getByText("아직 실행 내역이 없어요.")).toBeTruthy(),
    );
  });
  it("assistant panel opens the view it is asked for", async () => {
    const { ResearchAssistant } =
      await import("../src/pages/ResearchAssistant");
    await page(
      () =>
        React.createElement(ResearchAssistant, {
          openView: { view: "suggestions", at: 1 },
        }),
      "/r/r1",
    );
    expect(screen.getByText("AI 제안이 나오면 여기에 표시돼요.")).toBeTruthy();
  });
  it("calendar and planning initialize without premium plugins", async () => {
    const { PlanningPage } = await import("../src/pages/PlanningPage");
    await page(PlanningPage, "/r/r1/flow");
    expect(screen.getByRole("heading", { name: "연구 흐름" })).toBeTruthy();
    // 시간 조율 탭은 미팅 목록으로 옮겼습니다(07 §4).
    expect(screen.queryByRole("tab", { name: /시간 조율/ })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "달력" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "오늘" })).toBeTruthy(),
    );
  });
});
