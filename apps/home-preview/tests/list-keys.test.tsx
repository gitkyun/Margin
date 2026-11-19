// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { handleListKeys, stepIndex } from "../src/lib/list-keys";

afterEach(cleanup);

describe("목록 J/K 줄 이동(03 §5, 04 §11)", () => {
  it("처음에는 J가 첫 줄, K가 마지막 줄로 간다", () => {
    expect(stepIndex(-1, 3, 1)).toBe(0);
    expect(stepIndex(-1, 3, -1)).toBe(2);
  });
  it("끝에서는 더 가지 않는다", () => {
    expect(stepIndex(2, 3, 1)).toBe(2);
    expect(stepIndex(0, 3, -1)).toBe(0);
    expect(stepIndex(1, 3, 1)).toBe(2);
  });
  it("줄이 없으면 움직이지 않는다", () => {
    expect(stepIndex(-1, 0, 1)).toBe(-1);
  });
});

describe("목록 키보드(handleListKeys)", () => {
  function List({ onCheck }: { onCheck(): void }) {
    return (
      <div onKeyDown={handleListKeys}>
        <div className="task-line">
          <button role="checkbox" aria-checked="false" onClick={onCheck}>
            완료
          </button>
          <a className="task-line-text" href="#a">
            첫 할 일
          </a>
        </div>
        <div className="task-line">
          <a className="task-line-text" href="#b">
            둘째 할 일
          </a>
        </div>
        <input aria-label="찾기" />
      </div>
    );
  }

  it("J/K로 줄을 옮기고 X로 그 줄을 체크한다", () => {
    const onCheck = vi.fn();
    render(<List onCheck={onCheck} />);
    const first = screen.getByRole("link", { name: "첫 할 일" });
    first.focus();
    fireEvent.keyDown(first, { key: "ㅓ", code: "KeyJ" });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "둘째 할 일" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "k", code: "KeyK" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "x", code: "KeyX" });
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it("입력 칸에서는 글자를 그대로 둔다", () => {
    const onCheck = vi.fn();
    render(<List onCheck={onCheck} />);
    const input = screen.getByRole("textbox", { name: "찾기" });
    input.focus();
    fireEvent.keyDown(input, { key: "j", code: "KeyJ" });
    expect(document.activeElement).toBe(input);
  });
});
