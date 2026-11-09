// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormDialog } from "./shared";
vi.mock("@/lib/navigation-guard", () => ({
  useNavigationGuard: () => ({ clear: () => {} }),
}));
afterEach(cleanup);
function setup(busy = false) {
  const change = vi.fn();
  render(
    createElement(FormDialog, {
      open: true,
      onOpenChange: change,
      title: "수정 결과 작성",
      busy,
      children: createElement("input", {
        "aria-label": "수정 설명",
        defaultValue: "",
      }),
    }),
  );
  return change;
}
describe("저장 중 입력 보존", () => {
  it("저장 중에는 닫기와 Escape로 입력을 잃지 않는다", () => {
    const change = setup(true);
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "수정 설명" })).toBeTruthy();
  });
  it("변경이 없는 창은 정상적으로 닫힌다", () => {
    const change = setup();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(change).toHaveBeenCalledWith(false);
  });
  it("변경한 창은 확인하고, 계속 작성하면 입력을 보존한다", () => {
    const change = setup();
    const input = screen.getByRole("textbox", {
      name: "수정 설명",
    }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: "비교 기준 세 가지 추가" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(change).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "저장하지 않고 닫을까요?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "계속 작성" }));
    expect(input.value).toBe("비교 기준 세 가지 추가");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "버리고 닫기" }));
    expect(change).toHaveBeenCalledWith(false);
  });
});
