// @vitest-environment jsdom
import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import {
  render,
  cleanup,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emptyWorkspace } from "../src/lib/domain";
import { NavigationGuardProvider } from "../src/lib/navigation-guard";
const state = vi.hoisted(() => ({ workspace: null as any }));
vi.mock("../src/lib/workspace", () => ({
  useWorkspace: () => state.workspace,
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
    expect(screen.getByText("다음 미팅이 아직 없어요")).toBeTruthy();
  });
  it("writing is usable without existing documents", async () => {
    const { WritingPage } = await import("../src/pages/WritingPage");
    await page(WritingPage, "/r/r1/writing");
    expect(screen.getByText("아직 문서가 없어요")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "계획서 만들기" }).length,
    ).toBeGreaterThan(0);
  });
  it("assistant exposes three actual work views", async () => {
    const { ResearchAssistant } =
      await import("../src/pages/ResearchAssistant");
    await page(ResearchAssistant, "/r/r1/assistant");
    expect(screen.getByRole("tab", { name: "대화" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /AI 제안/ }));
    await waitFor(() =>
      expect(screen.getByText("아직 실행 기록이 없어요.")).toBeTruthy(),
    );
  });
  it("calendar and planning initialize without premium plugins", async () => {
    const { PlanningPage } = await import("../src/pages/PlanningPage");
    await page(PlanningPage, "/r/r1/planning");
    expect(screen.getByRole("heading", { name: "계획·일정" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "캘린더" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "오늘" })).toBeTruthy(),
    );
  });
});

describe("writing selections keep the AI scope explicit", () => {
  const doc = {
    id: "d-selection",
    researchId: "r1",
    title: "계획서",
    text: "선택한 문장. 다른 문장.",
    content: { type: "doc", content: [] },
    type: "plan",
    revision: 2,
    createdAt: "2026-11-05T00:00:00Z",
    updatedAt: "2026-11-05T00:00:00Z",
  };
  it("passes only the saved selected paragraph to the assistant", async () => {
    state.workspace.data.documents = [doc];
    sessionStorage.setItem(
      "rms-ai-selection:u1:d-selection",
      JSON.stringify({ revision: 2, text: "선택한 문장." }),
    );
    try {
      const { ResearchAssistant } =
        await import("../src/pages/ResearchAssistant");
      await page(
        ResearchAssistant,
        "/r/r1/assistant?document=d-selection&selection=1",
      );
      await waitFor(() =>
        expect(screen.getByText("계획서 · 선택 문단")).toBeTruthy(),
      );
    } finally {
      state.workspace.data.documents = [];
      sessionStorage.clear();
    }
  });
  it("does not substitute a full document when a selected paragraph is stale", async () => {
    state.workspace.data.documents = [doc];
    sessionStorage.setItem(
      "rms-ai-selection:u1:d-selection",
      JSON.stringify({ revision: 1, text: "선택한 문장." }),
    );
    try {
      const { ResearchAssistant } =
        await import("../src/pages/ResearchAssistant");
      await page(
        ResearchAssistant,
        "/r/r1/assistant?document=d-selection&selection=1",
      );
      await waitFor(() =>
        expect(
          screen.getByText(
            "선택한 문단을 불러오지 못했어요. 문서가 바뀌었을 수 있으니 글쓰기에서 문단을 다시 선택해 주세요.",
          ),
        ).toBeTruthy(),
      );
      expect(screen.queryByText("계획서 · 선택 문단")).toBeNull();
    } finally {
      state.workspace.data.documents = [];
      sessionStorage.clear();
    }
  });
});
