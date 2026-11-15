import { describe, expect, it } from "vitest";
import { shouldToggleOnSwipe } from "./swipe-toggle";

describe("할 일 행 밀어서 완료(767px 이하)", () => {
  it("행 너비의 30% 이상, 최소 88px을 밀어야 바꾼다", () => {
    expect(shouldToggleOnSwipe(100, 0, 360)).toBe(false);
    expect(shouldToggleOnSwipe(110, 0, 360)).toBe(true);
    expect(shouldToggleOnSwipe(88, 0, 200)).toBe(true);
  });

  it("짧아도 빠르게 튕기면 바꾸고, 왼쪽이나 아주 짧은 움직임은 무시한다", () => {
    expect(shouldToggleOnSwipe(45, 800, 360)).toBe(true);
    expect(shouldToggleOnSwipe(20, 2000, 360)).toBe(false);
    expect(shouldToggleOnSwipe(-200, 900, 360)).toBe(false);
  });
});
