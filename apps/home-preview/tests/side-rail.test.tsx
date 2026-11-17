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
        <SideRail researchId="a" onTab={() => {}} />
      </MemoryRouter>,
    );
    const list = items();
    // 연구 도우미 · 할 일 · 결정·질문 · 의견 보내기 · 설정
    expect(list).toHaveLength(5);
    expect(list.map((item) => item.tabIndex)).toEqual([0, -1, -1, -1, -1]);

    list[0]!.focus();
    fireEvent.keyDown(list[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(list[1]);
    expect(list.map((item) => item.tabIndex)).toEqual([-1, 0, -1, -1, -1]);

    fireEvent.keyDown(list[1]!, { key: "ArrowUp" });
    fireEvent.keyDown(list[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(list[4]);
    expect(list.map((item) => item.tabIndex)).toEqual([-1, -1, -1, -1, 0]);
  });

  it("실제 탭(할 일·결정·질문)은 눌린 상태를 알리고 같은 탭을 다시 누르면 닫는다", () => {
    const opened: string[] = [];
    render(
      <MemoryRouter initialEntries={["/r/a"]}>
        <SideRail
          researchId="a"
          openTab="log"
          onTab={(tab) => opened.push(tab)}
        />
      </MemoryRouter>,
    );
    const tasks = screen.getByRole("button", { name: "할 일" });
    const log = screen.getByRole("button", { name: "결정·질문" });
    expect(tasks.getAttribute("aria-pressed")).toBe("false");
    expect(log.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tasks);
    fireEvent.click(log);
    expect(opened).toEqual(["tasks", "log"]);
  });

  it("연구 도우미는 화면으로 가는 링크가 아니라 사이드 창 탭이다", () => {
    const opened: string[] = [];
    render(
      <MemoryRouter initialEntries={["/r/a"]}>
        <SideRail
          researchId="a"
          openTab="assistant"
          onTab={(tab) => opened.push(tab)}
        />
      </MemoryRouter>,
    );
    const assistant = screen.getByRole("button", { name: "연구 도우미" });
    expect(assistant.getAttribute("aria-pressed")).toBe("true");
    expect(assistant.getAttribute("aria-controls")).toBe("margin-panel");
    expect(screen.queryByRole("link", { name: "연구 도우미" })).toBeNull();
    fireEvent.click(assistant);
    expect(opened).toEqual(["assistant"]);
  });
});
