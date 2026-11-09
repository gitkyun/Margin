// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { isImeComposing } from "../src/lib/ime";

afterEach(cleanup);

describe("한글 조합 중 Enter", () => {
  it("조합 중이거나 keyCode 229이면 조합 중으로 본다", () => {
    expect(isImeComposing({ nativeEvent: { isComposing: true } })).toBe(true);
    expect(
      isImeComposing({ nativeEvent: { isComposing: false }, keyCode: 229 }),
    ).toBe(true);
    expect(isImeComposing({ nativeEvent: { keyCode: 229 } })).toBe(true);
    expect(
      isImeComposing({ nativeEvent: { isComposing: false }, keyCode: 13 }),
    ).toBe(false);
  });

  it("조합을 끝내는 Enter로는 추가되지 않고, 조합이 끝난 뒤 Enter로만 추가된다", () => {
    const add = vi.fn();
    render(
      <input
        aria-label="질문"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isImeComposing(e)) add();
        }}
      />,
    );
    const input = screen.getByLabelText("질문");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(add).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", keyCode: 13 });
    expect(add).toHaveBeenCalledTimes(1);
  });
});
