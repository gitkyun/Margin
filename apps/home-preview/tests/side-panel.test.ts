// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  initialPanelTab,
  isLayerSegment,
  lastLayerSegment,
  panelRequest,
  rememberLayerSegment,
  rememberPanel,
  withoutPanelRequest,
} from "../src/lib/side-panel";

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

describe("주소로 여는 사이드 창(01 §3.3)", () => {
  it("panel 값이 탭이면 그 탭을, 연구 도우미는 보기까지 읽음", () => {
    expect(panelRequest("?panel=assistant")).toEqual({ tab: "assistant" });
    expect(panelRequest("?panel=assistant&panelView=suggestions")).toEqual({
      tab: "assistant",
      view: "suggestions",
    });
    expect(panelRequest("?panel=tasks&panelView=runs")).toEqual({
      tab: "tasks",
    });
    expect(panelRequest("?panel=assistant&panelView=other")).toEqual({
      tab: "assistant",
    });
    expect(panelRequest("?panel=materials")).toEqual({ tab: "materials" });
  });

  it("모르는 값이나 panel이 없으면 열지 않음", () => {
    expect(panelRequest("")).toBeNull();
    expect(panelRequest("?panel=items")).toBeNull();
    expect(panelRequest("?view=feedback")).toBeNull();
  });

  it("연 뒤에는 panel·panelView만 지우고 다른 값은 남김", () => {
    expect(withoutPanelRequest("?panel=assistant&panelView=runs")).toBe("");
    expect(withoutPanelRequest("?view=feedback&panel=assistant")).toBe(
      "?view=feedback",
    );
    expect(withoutPanelRequest("?detail=task%3At1&panel=tasks")).toBe(
      "?detail=task%3At1",
    );
  });
});

describe("휴대폰 층의 세그먼트(02 §6, D16)", () => {
  it("처음엔 연구 도우미, 그 뒤엔 마지막에 본 세그먼트", () => {
    expect(lastLayerSegment()).toBe("assistant");
    rememberLayerSegment("materials");
    expect(lastLayerSegment()).toBe("materials");
  });

  it("할 일은 세그먼트가 아니고, 모르는 값은 연구 도우미로", () => {
    expect(isLayerSegment("tasks")).toBe(false);
    expect(isLayerSegment(null)).toBe(false);
    expect(isLayerSegment("log")).toBe(true);
    localStorage.setItem("margin-phone-layer", "tasks");
    expect(lastLayerSegment()).toBe("assistant");
  });
});
