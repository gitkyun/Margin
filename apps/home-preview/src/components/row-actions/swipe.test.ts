import { describe, expect, it } from "vitest";
import { shouldSwipe } from "./swipe";

describe("shouldSwipe", () => {
  it("밀어낸 거리가 행 너비의 30%(최소 88px)를 넘으면 그 방향", () => {
    expect(shouldSwipe(130, 0, 390)).toBe("start");
    expect(shouldSwipe(-130, 0, 390)).toBe("end");
  });
  it("짧게 움직이면 아무것도 하지 않음(스크롤 중 흔들림)", () => {
    expect(shouldSwipe(30, 100, 390)).toBeNull();
    expect(shouldSwipe(-60, -100, 390)).toBeNull();
  });
  it("짧아도 같은 방향으로 빠르게 튕기면 실행", () => {
    expect(shouldSwipe(-50, -800, 390)).toBe("end");
    expect(shouldSwipe(-50, 800, 390)).toBeNull();
  });
});
