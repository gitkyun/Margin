// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { initialPanelTab, rememberPanel } from "../src/lib/side-panel";

afterEach(() => localStorage.clear());

describe("사이드 창 기억(IA v2 02 §4.5)", () => {
  it("처음: 1440 이상이면 할 일 탭으로 열리고, 그보다 좁으면 닫힘", () => {
    expect(initialPanelTab(1440)).toBe("tasks");
    expect(initialPanelTab(1280)).toBeNull();
    expect(initialPanelTab(1024)).toBeNull();
  });

  it("1200 이상에서 고른 열림·탭을 기억한다", () => {
    rememberPanel(1280, "log");
    expect(initialPanelTab(1280)).toBe("log");
    rememberPanel(1280, "assistant");
    expect(initialPanelTab(1280)).toBe("assistant");
    rememberPanel(1440, null);
    expect(initialPanelTab(1440)).toBeNull();
  });

  it("겹쳐 뜨는 폭에서는 열림을 쓰지도 읽지도 않는다(D15)", () => {
    rememberPanel(1024, "log");
    expect(initialPanelTab(1024)).toBeNull();
    expect(localStorage.getItem("margin-panel-open")).toBeNull();
    expect(initialPanelTab(1440)).toBe("log");
  });
});
