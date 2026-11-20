// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SelectionToolbar } from "@/components/recording/SelectionPopover";

afterEach(cleanup);

it("shows the actions near the picked text and closes after one is chosen", async () => {
  const onSelect = vi.fn();
  const onDismiss = vi.fn();
  render(
    <div style={{ position: "relative" }}>
      <SelectionToolbar
        anchor={{ x: 40, y: 60 }}
        actions={[{ key: "feedback", label: "+ 피드백", onSelect }]}
        onDismiss={onDismiss}
      />
    </div>,
  );
  const toolbar = await screen.findByRole("toolbar");
  fireEvent.click(screen.getByRole("button", { name: "+ 피드백" }));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(toolbar, { key: "Escape" });
  expect(onDismiss).toHaveBeenCalledTimes(2);
});

it("renders nothing without a picked text or actions", () => {
  const { container, rerender } = render(
    <SelectionToolbar anchor={null} actions={[]} onDismiss={() => undefined} />,
  );
  expect(container.querySelector("[role=toolbar]")).toBeNull();
  rerender(
    <SelectionToolbar
      anchor={{ x: 1, y: 1 }}
      actions={[]}
      onDismiss={() => undefined}
    />,
  );
  expect(container.querySelector("[role=toolbar]")).toBeNull();
});

it("shows a shortcut hint without changing the button name", async () => {
  render(
    <div style={{ position: "relative" }}>
      <SelectionToolbar
        anchor={{ x: 40, y: 60 }}
        actions={[
          { key: "mark", label: "형광펜", shortcut: "H", onSelect: vi.fn() },
        ]}
        onDismiss={() => undefined}
      />
    </div>,
  );
  const button = await screen.findByRole("button", { name: "형광펜" });
  expect(button.getAttribute("aria-keyshortcuts")).toBe("H");
  expect(button.querySelector("kbd")?.textContent).toBe("H");
});

it("selects text by character offsets across highlighted pieces", async () => {
  const { selectOffsets } =
    await import("@/components/recording/SelectionPopover");
  const box = document.createElement("div");
  box.innerHTML = "첫 문장. <mark>둘째 문장.</mark> 셋째.";
  document.body.append(box);
  const range = selectOffsets(box, 6, 15);
  expect(range?.toString()).toBe("둘째 문장. 셋째");
  expect(window.getSelection()?.toString()).toBe("둘째 문장. 셋째");
  expect(selectOffsets(box, 0, 99)).toBeNull();
  box.remove();
});

it("expands an action's options in place and goes back with Escape (형광펜 종류)", async () => {
  const paint = vi.fn();
  const onDismiss = vi.fn();
  render(
    <div style={{ position: "relative" }}>
      <SelectionToolbar
        anchor={{ x: 40, y: 60 }}
        actions={[
          {
            key: "mark",
            label: "형광펜",
            onSelect: vi.fn(),
            optionsLabel: "형광펜 종류 고르기",
            options: [
              {
                key: "key",
                label: "중요",
                swatch: "key",
                pressed: true,
                onSelect: vi.fn(),
              },
              {
                key: "check",
                label: "다시 확인",
                swatch: "check",
                onSelect: paint,
              },
            ],
          },
          { key: "feedback", label: "피드백", onSelect: vi.fn() },
        ]}
        onDismiss={onDismiss}
      />
    </div>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "형광펜 종류 고르기" }),
  );
  expect(screen.queryByRole("button", { name: "피드백" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "중요" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.keyDown(screen.getByRole("toolbar"), { key: "Escape" });
  expect(onDismiss).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "피드백" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "형광펜 종류 고르기" }));
  fireEvent.click(screen.getByRole("button", { name: "다시 확인" }));
  expect(paint).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
