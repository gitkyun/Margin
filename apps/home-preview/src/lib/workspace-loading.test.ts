import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { emptyWorkspace } from "./domain";
import type { WorkspaceContextValue } from "./workspace-contract";

const state = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    error: null as Error | null,
    isLoading: false,
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => state.query,
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    clear: vi.fn(),
  }),
}));
import { WorkspaceProvider } from "./workspace";

function value() {
  const element = WorkspaceProvider({
    user: { id: "student", name: "학생", email: "student@example.com" },
    mode: "preview",
    children: "작성 중인 폼",
  }) as ReactElement<{ value: WorkspaceContextValue }>;
  return element.props.value;
}

describe("작업 공간 재조회 실패", () => {
  beforeEach(() => {
    state.query = { data: undefined, error: null, isLoading: false };
  });

  it("처음 불러오지 못했을 때만 작업 공간 진입 오류로 표시한다", () => {
    state.query.error = new Error("Network request failed");
    const context = value();
    expect(context.error).toBeTruthy();
    expect(context.refreshError).toBeNull();
  });

  it("편집 중 재조회가 실패해도 기존 데이터와 Routes를 유지한다", () => {
    const loaded = emptyWorkspace();
    state.query.data = loaded;
    state.query.error = new Error("Network request failed");
    const context = value();
    expect(context.data).toBe(loaded);
    expect(context.loading).toBe(false);
    expect(context.error).toBeNull();
    expect(context.refreshError).toBeTruthy();
  });

  it("재연결해 불러온 뒤에는 재시도 안내를 없앤다", () => {
    state.query.data = emptyWorkspace();
    state.query.error = null;
    expect(value().refreshError).toBeNull();
    expect(value().error).toBeNull();
  });
});
