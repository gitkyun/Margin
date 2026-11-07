// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Choice, Segments } from "../src/components/experience";
import { SearchField } from "../src/components/SearchField";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

function Choose({ long = false }: { long?: boolean }) {
  const [value, setValue] = useState("3");
  return (
    <Choice
      label="미팅"
      value={value}
      onChange={setValue}
      options={Array.from({ length: long ? 9 : 5 }, (_, i) => ({
        value: String(i),
        label: `미팅 ${i}`,
      }))}
    />
  );
}
describe("search and selection controls", () => {
  it("opens at the saved choice and commits a keyboard selection", async () => {
    render(<Choose />);
    fireEvent.click(screen.getByRole("button", { name: "미팅" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("option", { name: "미팅 3" }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("option", { name: "미팅 4" }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByRole("button", { name: "미팅" }).textContent).toContain(
      "미팅 4",
    );
  });
  it("filters long choices, then clears without closing and keeps input focus", async () => {
    render(<Choose long />);
    fireEvent.click(screen.getByRole("button", { name: "미팅" }));
    const input = await screen.findByRole("combobox", { name: "미팅 검색" });
    fireEvent.change(input, { target: { value: "8" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(screen.getAllByRole("option")).toHaveLength(9);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "없음" } });
    expect(screen.getByText("검색 결과가 없습니다.")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getAllByRole("option")).toHaveLength(9);
    expect(document.activeElement).toBe(input);
  });
  it("does not select an unrelated item when a search has no matches", async () => {
    render(<Choose long />);
    fireEvent.click(screen.getByRole("button", { name: "미팅" }));
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "없음" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "미팅" }).textContent).toContain(
      "미팅 3",
    );
  });
  it("clears search and returns typing focus", () => {
    function Search() {
      const [value, setValue] = useState("원고");
      return (
        <SearchField
          aria-label="자료 찾기"
          value={value}
          onValueChange={setValue}
        />
      );
    }
    render(<Search />);
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    const input = screen.getByRole("searchbox", {
      name: "자료 찾기",
    }) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("button", { name: "검색어 지우기" })).toBeNull();
  });
  it("moves the selected filter and keyboard focus together", () => {
    function Filters() {
      const [value, setValue] = useState("all");
      return (
        <Segments
          label="미팅 상태"
          value={value}
          onChange={setValue}
          options={[
            { value: "all", label: "전체" },
            { value: "done", label: "완료", count: 2 },
          ]}
        />
      );
    }
    render(<Filters />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "전체" }), {
      key: "End",
    });
    const selected = screen.getByRole("tab", { name: /완료/ });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(selected);
  });
});
