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
  it("names the select with its current value and commits a selection", async () => {
    render(<Choose />);
    const select = screen.getByRole("combobox", { name: "미팅, 미팅 3" });
    expect(select.textContent).toContain("미팅 3");
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole("option", { name: "미팅 4" }));
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "미팅, 미팅 4" }).textContent,
      ).toContain("미팅 4"),
    );
  });
  it("lists every option of a long choice", async () => {
    render(<Choose long />);
    fireEvent.click(screen.getByRole("combobox", { name: /^미팅, / }));
    expect(await screen.findAllByRole("option")).toHaveLength(9);
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
  it("moves the selected filter and keyboard focus together", async () => {
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
    // Montage SegmentedControl: radiogroup, 좌우 화살표로 이동하면 바로 선택됩니다.
    const first = screen.getByRole("radio", { name: "전체" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const selected = screen.getByRole("radio", { name: /완료/ });
    // Radix 포커스 이동은 다음 틱에 일어납니다.
    await waitFor(() =>
      expect(selected.getAttribute("aria-checked")).toBe("true"),
    );
    expect(document.activeElement).toBe(selected);
    fireEvent.keyUp(selected, { key: "ArrowRight" });
  });
});
