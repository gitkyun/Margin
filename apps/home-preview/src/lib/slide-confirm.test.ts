import { describe, expect, it } from "vitest";
import {
  holdProgress,
  isSlideComplete,
  keyProgress,
  SLIDE_HOLD_MS,
  slideProgress,
} from "./slide-confirm";

describe("밀어서 확인 계산", () => {
  it("끈 거리를 움직일 수 있는 길이로 나누고 0~1로 자른다", () => {
    expect(slideProgress(0, 100, 200)).toBe(0.5);
    expect(slideProgress(0.5, -500, 200)).toBe(0);
    expect(slideProgress(0, 900, 200)).toBe(1);
  });

  it("길이를 못 재면 시작값을 그대로 둔다", () => {
    expect(slideProgress(0.3, 50, 0)).toBe(0.3);
  });

  it("끝 가까이까지 밀어야만 완료로 본다", () => {
    expect(isSlideComplete(0.9)).toBe(false);
    expect(isSlideComplete(1)).toBe(true);
  });

  it("→ 네 번이면 끝에 닿고, ←·Home은 되돌린다", () => {
    let progress = 0;
    for (let i = 0; i < 4; i += 1)
      progress = keyProgress(progress, "ArrowRight")!;
    expect(progress).toBe(1);
    expect(keyProgress(1, "ArrowLeft")).toBe(0.75);
    expect(keyProgress(0.5, "Home")).toBe(0);
    expect(keyProgress(0.5, "Tab")).toBeNull();
  });

  it("Enter를 정한 시간만큼 눌러야 끝에 닿는다", () => {
    expect(holdProgress(SLIDE_HOLD_MS / 2)).toBeCloseTo(0.5);
    expect(isSlideComplete(holdProgress(SLIDE_HOLD_MS - 100))).toBe(false);
    expect(isSlideComplete(holdProgress(SLIDE_HOLD_MS))).toBe(true);
  });
});
