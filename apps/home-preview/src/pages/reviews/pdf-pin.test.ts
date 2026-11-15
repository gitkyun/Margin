import { describe, expect, it } from "vitest";
import { numberPins, parsePin } from "./pdf-pin";

describe("pdf-pin", () => {
  it("위치 표시를 읽고 글만 남겨요", () => {
    expect(parsePin("[p.3 @ 42%,18%] 표를 고쳐 주세요")).toEqual({
      page: 3,
      x: 42,
      y: 18,
      text: "표를 고쳐 주세요",
    });
    expect(parsePin("그냥 댓글")).toBeNull();
  });

  it("쪽이 달라도 번호가 이어지고 지운 댓글은 건너뛰어요", () => {
    const numbers = numberPins([
      { id: "a", body: "[p.1 @ 1%,1%] 하나" },
      { id: "b", body: "일반 댓글" },
      { id: "c", body: "[p.1 @ 2%,2%] 지움", deletedAt: "2026-01-01" },
      { id: "d", body: "[p.4 @ 3%,3%] 둘" },
    ]);
    expect(Object.fromEntries(numbers)).toEqual({ a: 1, d: 2 });
  });
});
