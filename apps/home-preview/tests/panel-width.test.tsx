// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DOCS_PANEL_WIDTH_KEY,
  PANEL_WIDTH_KEY,
  usePanelWidth,
} from "../src/components/margin-panel/PanelResizer";

beforeEach(() => localStorage.clear());

describe("usePanelWidth", () => {
  it("remembers the docs panel width apart from the default panel", () => {
    const { result, rerender } = renderHook(({ key }) => usePanelWidth(key), {
      initialProps: { key: PANEL_WIDTH_KEY },
    });
    act(() => result.current[1](400));
    rerender({ key: DOCS_PANEL_WIDTH_KEY });
    expect(result.current[0]).toBeNull();
    act(() => result.current[1](520));
    rerender({ key: PANEL_WIDTH_KEY });
    expect(result.current[0]).toBe(400);
    expect(localStorage.getItem(DOCS_PANEL_WIDTH_KEY)).toBe("520");
  });
});
