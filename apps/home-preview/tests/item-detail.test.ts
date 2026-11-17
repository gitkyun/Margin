// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { detailDepth, parseDetail, withDetail } from "../src/lib/item-detail";

describe("항목 상세 주소(?detail=)", () => {
  it("다섯 종류만 읽고 틀린 값은 무시한다", () => {
    expect(parseDetail("task:t1")).toEqual({ kind: "task", id: "t1" });
    for (const kind of ["feedback", "decision", "question", "result"])
      expect(parseDetail(`${kind}:a-1`)?.kind).toBe(kind);
    for (const bad of [
      null,
      "",
      "task",
      "task:",
      ":t1",
      "plan:t1",
      "task:../x",
      "task:a b",
    ])
      expect(parseDetail(bad)).toBeNull();
  });

  it("다른 검색어는 그대로 두고 detail만 넣고 뺀다", () => {
    expect(withDetail("?tab=prepare", { kind: "task", id: "t1" })).toBe(
      "?tab=prepare&detail=task%3At1",
    );
    expect(withDetail("?tab=prepare&detail=task%3At1", null)).toBe(
      "?tab=prepare",
    );
    expect(withDetail("?detail=task%3At1", null)).toBe("");
  });

  it("앱 안에서 연 깊이만 센다", () => {
    expect(detailDepth({ layer: "detail", depth: 3 })).toBe(3);
    expect(detailDepth({ layer: "settings", depth: 3 })).toBe(0);
    expect(detailDepth({ layer: "detail", depth: -1 })).toBe(0);
    expect(detailDepth(null)).toBe(0);
  });

  it("주소로 들어온 상세에서 이어 연 것은 닫을 때 주소에서 지운다", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const React = await import("react");
    const { MemoryRouter, useLocation } = await import("react-router-dom");
    const { useOpenDetail, useCloseDetail } =
      await import("../src/lib/item-detail");
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/r/a?detail=feedback:f1"] },
        children,
      );
    const { result } = renderHook(
      () => ({
        open: useOpenDetail(),
        close: useCloseDetail(),
        location: useLocation(),
      }),
      { wrapper },
    );
    act(() => result.current.open({ kind: "task", id: "t1" }));
    expect(result.current.location.search).toBe("?detail=task%3At1");
    act(() => result.current.close());
    expect(result.current.location.search).toBe("");
  });

  it("앱 안에서 이어 연 상세는 닫으면 처음 화면으로 한 번에 돌아간다", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const React = await import("react");
    const { MemoryRouter, useLocation } = await import("react-router-dom");
    const { useOpenDetail, useCloseDetail } =
      await import("../src/lib/item-detail");
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/r/a?tab=todo"] },
        children,
      );
    const { result } = renderHook(
      () => ({
        open: useOpenDetail(),
        close: useCloseDetail(),
        location: useLocation(),
      }),
      { wrapper },
    );
    act(() => result.current.open({ kind: "feedback", id: "f1" }));
    act(() => result.current.open({ kind: "task", id: "t1" }));
    act(() => result.current.open({ kind: "result", id: "r1" }));
    expect(result.current.location.search).toBe("?tab=todo&detail=result%3Ar1");
    act(() => result.current.close());
    expect(result.current.location.search).toBe("?tab=todo");
  });
});
