import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { FormDialog } from "./shared";

type DialogProps = {
  onOpenChange(open: boolean): void;
  children: ReactElement<{
    showCloseButton: boolean;
    onEscapeKeyDown(event: { preventDefault(): void }): void;
    onPointerDownOutside(event: { preventDefault(): void }): void;
  }>;
};

function dialog(busy: boolean) {
  const change = vi.fn();
  const element = FormDialog({
    open: true,
    onOpenChange: change,
    title: "수정 결과 작성",
    busy,
    children: "작성 중인 입력",
  }) as ReactElement<DialogProps>;
  return { change, element, content: element.props.children };
}

describe("저장 중 입력 보존", () => {
  it("저장 중에는 X, Escape, 바깥 클릭으로 폼을 닫지 않는다", () => {
    const { change, element, content } = dialog(true);
    element.props.onOpenChange(false);
    expect(change).not.toHaveBeenCalled();
    expect(content.props.showCloseButton).toBe(false);
    const escape = { preventDefault: vi.fn() };
    const outside = { preventDefault: vi.fn() };
    content.props.onEscapeKeyDown(escape);
    content.props.onPointerDownOutside(outside);
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(outside.preventDefault).toHaveBeenCalledOnce();
  });

  it("실패해 저장 중 상태가 풀리면 입력이 남은 폼을 취소할 수 있다", () => {
    const { change, element, content } = dialog(false);
    const event = { preventDefault: vi.fn() };
    content.props.onEscapeKeyDown(event);
    content.props.onPointerDownOutside(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(content.props.showCloseButton).toBe(true);
    element.props.onOpenChange(false);
    expect(change).toHaveBeenCalledWith(false);
  });
});
