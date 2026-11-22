// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InlineEditBar } from "../src/components/kokonut/ai-inline-edit";

// jsdom에는 ResizeObserver가 없어 BarBody 측정을 위한 최소 스텁을 둡니다.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  MockResizeObserver as unknown as typeof ResizeObserver;

afterEach(cleanup);

const baseProps = {
  instruction: "",
  onInstruction: () => {},
  onRun: () => {},
  onStop: () => {},
  onAccept: () => {},
  onDiscard: () => {},
  unchanged: false,
  label: "더 간결하게",
  position: { x: 16, y: 80, width: 384 },
};

describe("InlineEditBar 포커스 및 단축키 (U8-01)", () => {
  it("기본값(focusPrompt=true)이면 prompt 단계에서 입력칸에 포커스가 간다", () => {
    render(<InlineEditBar {...baseProps} phase="prompt" />);
    const input = screen.getByPlaceholderText("어떻게 고칠까요?");
    expect(document.activeElement).toBe(input);
    expect(
      screen.getByRole("group", { name: "AI로 고쳐 쓰기" }).getAttribute("aria-keyshortcuts"),
    ).toBeNull();
  });

  it("focusPrompt={false}이면 prompt 단계에서 기존 편집기 포커스를 빼앗지 않는다", () => {
    const editor = document.createElement("div");
    editor.tabIndex = 0;
    document.body.appendChild(editor);
    editor.focus();
    try {
      render(
        <InlineEditBar {...baseProps} phase="prompt" focusPrompt={false} />,
      );
      expect(document.activeElement).toBe(editor);
      const group = screen.getByRole("group", { name: "AI로 고쳐 쓰기" });
      expect(group.getAttribute("aria-keyshortcuts")).toBe("Meta+/ Control+/");
    } finally {
      editor.remove();
    }
  });

  it("focusPrompt={false}일 때 ⌘/ 또는 Ctrl+/로 입력칸에 들어가고 isComposing 중에는 무시한다", () => {
    const editor = document.createElement("div");
    editor.tabIndex = 0;
    document.body.appendChild(editor);
    editor.focus();
    try {
      render(
        <InlineEditBar {...baseProps} phase="prompt" focusPrompt={false} />,
      );
      const input = screen.getByPlaceholderText("어떻게 고칠까요?");

      // 한글 조합 중에는 무시
      const composing = new KeyboardEvent("keydown", {
        key: "/",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(composing, "isComposing", { value: true });
      window.dispatchEvent(composing);
      expect(composing.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(editor);

      // ⌘/ 입력 시 포커스 이동 및 기본 동작 차단
      const metaSlash = new KeyboardEvent("keydown", {
        key: "/",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(metaSlash);
      expect(metaSlash.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);

      // 다시 편집기로 돌린 뒤 Ctrl+/ 입력 확인
      editor.focus();
      const ctrlSlash = new KeyboardEvent("keydown", {
        key: "/",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(ctrlSlash);
      expect(ctrlSlash.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
    } finally {
      editor.remove();
    }
  });

  it("review 단계로 전환되면 focusPrompt={false}여도 반영 버튼에 포커스가 가고 Enter·Esc가 동작한다", () => {
    const onRun = vi.fn();
    const onDiscard = vi.fn();
    const { rerender } = render(
      <InlineEditBar
        {...baseProps}
        phase="prompt"
        focusPrompt={false}
        instruction="더 짧게"
        onRun={onRun}
        onDiscard={onDiscard}
      />,
    );
    const input = screen.getByPlaceholderText("어떻게 고칠까요?");
    input.focus();
    fireEvent.submit(input.closest("form")!);
    expect(onRun).toHaveBeenCalledWith("더 짧게");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onDiscard).toHaveBeenCalledTimes(1);

    rerender(
      <InlineEditBar
        {...baseProps}
        phase="review"
        focusPrompt={false}
        unchanged={false}
      />,
    );
    const acceptBtn = screen.getByRole("button", { name: /반영/ });
    expect(document.activeElement).toBe(acceptBtn);
  });
});
