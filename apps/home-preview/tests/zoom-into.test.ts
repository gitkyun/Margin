import { describe, expect, it } from "vitest";
import { restTransform, zoomTransform } from "../src/lib/use-zoom-into";

describe("전체 모습의 자리", () => {
  it("그림이 틀에 들어가면 줄이지 않는다", () => {
    const rest = restTransform({
      frame: { width: 760, height: 475 },
      canvas: { left: 8, top: 8, width: 744, height: 459 },
    });
    expect(rest).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("그림이 띠보다 길면 전체가 보이게 줄여 가운데에 둔다", () => {
    const rest = restTransform({
      frame: { width: 720, height: 267 },
      canvas: { left: 8, top: 8, width: 704, height: 502 },
    });
    expect(rest.scale).toBeCloseTo(0.5, 2);
    // 줄인 그림이 틀 안에 들어가요.
    expect(8 + rest.y + rest.scale * 502).toBeLessThanOrEqual(267);
    expect(8 + rest.x).toBeGreaterThanOrEqual(0);
  });
});

describe("컴포넌트로 확대", () => {
  const frame = { width: 760, height: 475 };
  const canvas = { left: 8, top: 8 };

  it("작은 컴포넌트는 크게 키우되 2.6배를 넘지 않는다", () => {
    const zoom = zoomTransform({
      frame,
      canvas,
      target: { left: 100, top: 120, width: 120, height: 20 },
    });
    expect(zoom.scale).toBe(2.6);
  });

  it("컴포넌트를 틀 한가운데에 놓고 틀 밖으로 넘기지 않는다", () => {
    const target = { left: 96, top: 140, width: 310, height: 70 };
    const zoom = zoomTransform({ frame, canvas, target });
    const left = canvas.left + zoom.x + zoom.scale * target.left;
    const top = canvas.top + zoom.y + zoom.scale * target.top;
    const width = zoom.scale * target.width;
    const height = zoom.scale * target.height;
    expect(left + width / 2).toBeCloseTo(frame.width / 2, 5);
    expect(top + height / 2).toBeCloseTo(frame.height / 2, 5);
    expect(width).toBeLessThanOrEqual(frame.width * 0.78 + 0.01);
    expect(height).toBeLessThanOrEqual(frame.height * 0.6 + 0.01);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it("이미 틀을 채우는 컴포넌트는 전체 모습보다 줄이지 않는다", () => {
    const zoom = zoomTransform({
      frame: { width: 350, height: 183 },
      canvas,
      target: { left: 0, top: 40, width: 330, height: 80 },
      minScale: 1,
    });
    expect(zoom.scale).toBe(1);
  });
});
