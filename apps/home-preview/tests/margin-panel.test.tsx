// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  MarginPanel,
  MarginPanelProvider,
  useMarginPanelHost,
} from "../src/components/margin-panel/MarginPanel";

afterEach(cleanup);

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <MarginPanel
      label="수정 방법 제안"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <button type="button">제안받기</button>
    </MarginPanel>
  );
}

function Shell() {
  const panel = useMarginPanelHost();
  return (
    <div>
      {panel.offered && (
        <button
          type="button"
          aria-pressed={!!panel.active}
          onClick={() =>
            panel.active ? panel.active.onClose() : panel.offered?.onOpen?.()
          }
        >
          {panel.offered.label} {panel.active ? "닫기" : "열기"}
        </button>
      )}
      <main>
        <MarginPanelProvider value={panel.context}>
          <Page />
        </MarginPanelProvider>
      </main>
      <aside
        data-testid="slot"
        hidden={!panel.active}
        tabIndex={-1}
        ref={panel.setSlot}
      />
    </div>
  );
}

it("puts page content into the shell slot and opens it from the shell button", () => {
  render(<Shell />);
  const slot = screen.getByTestId("slot");
  // 닫혀 있어도 내용은 살아 있고(진행 중인 작업 유지), 자리만 숨깁니다.
  expect(slot.hidden).toBe(true);
  expect(slot.querySelector("button")?.textContent).toBe("제안받기");
  expect(screen.queryByRole("main")?.querySelector("button")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "수정 방법 제안 열기" }));
  expect(slot.hidden).toBe(false);
  expect(slot.querySelector<HTMLElement>(".margin-panel-section")?.hidden).toBe(
    false,
  );

  fireEvent.click(screen.getByRole("button", { name: "수정 방법 제안 닫기" }));
  expect(slot.hidden).toBe(true);
});

it("stops offering the panel once the page that owns it is gone", () => {
  const { rerender } = render(<Shell />);
  expect(screen.getByRole("button", { name: /열기/ })).toBeTruthy();
  rerender(<div />);
  expect(screen.queryByRole("button", { name: /열기/ })).toBeNull();
});

it("renders in place when there is no shell around it", () => {
  render(
    <MarginPanel label="메모 정리" open onClose={() => {}}>
      <p>패널 내용</p>
    </MarginPanel>,
  );
  expect(screen.getByText("패널 내용")).toBeTruthy();
});
