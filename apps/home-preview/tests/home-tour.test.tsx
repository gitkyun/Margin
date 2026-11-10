// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HomeTour } from "../src/components/home/HomeTour";
import {
  isTourSeen,
  markTourSeen,
  placeCard,
  shouldShowTour,
  type TourStep,
} from "../src/lib/tour";

const STEPS: TourStep[] = [
  { key: "a", selector: "#a", title: "첫 자리", text: "첫 설명" },
  { key: "hidden", selector: "#hidden", title: "숨은 자리", text: "안 보임" },
  { key: "missing", selector: "#missing", title: "없는 자리", text: "없음" },
  { key: "b", selector: "#b", title: "둘째 자리", text: "둘째 설명" },
];

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML =
    '<button id="a">a</button><button id="hidden">h</button><button id="b">b</button>';
  // jsdom은 배치를 계산하지 않아 자리 값을 직접 줍니다. #hidden은 접힌 메뉴처럼 크기가 없습니다.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.id === "a") return new DOMRect(10, 10, 100, 40);
      if (this.id === "b") return new DOMRect(300, 200, 100, 40);
      return new DOMRect(0, 0, 0, 0);
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("화면 안내를 보여 줄지", () => {
  it("아직 보지 않았을 때 보여 주고, ?tour=1이면 다시 보여 준다", () => {
    expect(shouldShowTour({ seen: false, forced: false })).toBe(true);
    expect(shouldShowTour({ seen: true, forced: false })).toBe(false);
    expect(shouldShowTour({ seen: true, forced: true })).toBe(true);
  });

  it("봤다는 기록을 이 브라우저에 남긴다", () => {
    expect(isTourSeen()).toBe(false);
    markTourSeen();
    expect(isTourSeen()).toBe(true);
  });
});

describe("설명 카드 자리", () => {
  const card = { width: 320, height: 200 };
  const viewport = { width: 1440, height: 900 };

  it("좁은 대상은 오른쪽에 둔다", () => {
    const at = placeCard(
      { top: 120, left: 12, width: 220, height: 50 },
      card,
      viewport,
    );
    expect(at).toEqual({ top: 120, left: 244 });
  });

  it("오른쪽에 자리가 없으면 아래에 두고 화면 안으로 당긴다", () => {
    const at = placeCard(
      { top: 200, left: 1250, width: 160, height: 60 },
      card,
      viewport,
    );
    expect(at).toEqual({ top: 272, left: 1440 - 320 - 16 });
  });

  it("아래에도 자리가 없으면 위에 둔다", () => {
    const at = placeCard(
      { top: 800, left: 1250, width: 160, height: 60 },
      card,
      viewport,
    );
    expect(at.top).toBe(800 - 12 - 200);
  });

  it("좁은 화면에서도 좌우 16px 안에 둔다", () => {
    const at = placeCard(
      { top: 300, left: 10, width: 340, height: 60 },
      { width: 328, height: 200 },
      { width: 360, height: 740 },
    );
    expect(at.left).toBe(16);
    expect(at.top).toBe(372);
  });
});

describe("화면 안내", () => {
  it("화면에 보이는 자리만 차례로 짚고 마지막에 끝낸다", () => {
    const done = vi.fn();
    render(<HomeTour onDone={done} steps={STEPS} />);
    expect(screen.getByText("화면 안내 1 / 2")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "첫 자리" })).toBeTruthy();
    const ring = document.querySelector<HTMLElement>(".tour-ring");
    expect(ring?.style.left).toBe("4px");
    expect(ring?.style.width).toBe("112px");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("dialog", { name: "둘째 자리" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".tour-ring")?.style.left).toBe(
      "294px",
    );
    expect(screen.queryByRole("button", { name: "안내 끝내기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByRole("dialog", { name: "첫 자리" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "안내 마치기" }));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("열리면 초점이 카드로 가고 Esc로 닫는다", () => {
    const done = vi.fn();
    render(<HomeTour onDone={done} steps={STEPS} />);
    const card = screen.getByRole("dialog");
    expect(document.activeElement).toBe(card);
    fireEvent.keyDown(card, { key: "Escape" });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("짚을 자리가 하나도 없으면 봤다고 하지 않고 닫는다", () => {
    const done = vi.fn();
    const unavailable = vi.fn();
    render(
      <HomeTour
        onDone={done}
        onUnavailable={unavailable}
        steps={[STEPS[1], STEPS[2]]}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(unavailable).toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
});
