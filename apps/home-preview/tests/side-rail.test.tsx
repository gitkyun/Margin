// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SideRail } from "../src/components/shell/SideRail";

afterEach(cleanup);

function items() {
  return Array.from(
    screen
      .getByRole("toolbar", { name: "옆 창 열기" })
      .querySelectorAll<HTMLElement>(".ia-rail-item"),
  );
}

describe("아이콘 줄 키보드(02 §4.1)", () => {
  it("버튼 하나만 Tab 순서에 들어가고 화살표로 옮긴 버튼이 그 자리를 받는다", () => {
    render(
      <MemoryRouter initialEntries={["/r/a"]}>
        <SideRail researchId="a" />
      </MemoryRouter>,
    );
    const list = items();
    expect(list).toHaveLength(3);
    expect(list.map((item) => item.tabIndex)).toEqual([0, -1, -1]);

    list[0]!.focus();
    fireEvent.keyDown(list[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(list[1]);
    expect(list.map((item) => item.tabIndex)).toEqual([-1, 0, -1]);

    fireEvent.keyDown(list[1]!, { key: "ArrowUp" });
    fireEvent.keyDown(list[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(list[2]);
    expect(list.map((item) => item.tabIndex)).toEqual([-1, -1, 0]);
  });
});
