// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ComparePreview } from "../src/components/marketing/MarketingEffects";
import { PublicNavigation } from "../src/components/marketing/PublicNavigation";

beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => true;
  Element.prototype.releasePointerCapture = () => {};
});
afterEach(cleanup);

it("reveals either complete manuscript by dragging the center handle beyond both edges", () => {
  const { container } = render(<ComparePreview />);
  const stage = container.querySelector(".rms-compare-stage")!;
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
    left: 100,
    width: 400,
  } as DOMRect);
  const handle = screen.getByRole("slider");
  fireEvent.pointerDown(handle, { clientX: 292, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 50, pointerId: 1 });
  expect(handle.getAttribute("aria-valuenow")).toBe("0");
  fireEvent.pointerMove(handle, { clientX: 550, pointerId: 1 });
  expect(handle.getAttribute("aria-valuenow")).toBe("100");
  fireEvent.pointerUp(handle, { clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 });
  expect(handle.getAttribute("aria-valuenow")).toBe("100");
});

it("allows keyboard comparison at both endpoints and in steps", () => {
  render(<ComparePreview />);
  const handle = screen.getByRole("slider");
  fireEvent.keyDown(handle, { key: "Home" });
  expect(handle.getAttribute("aria-valuenow")).toBe("0");
  fireEvent.keyDown(handle, { key: "ArrowLeft" });
  expect(handle.getAttribute("aria-valuenow")).toBe("0");
  fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
  expect(handle.getAttribute("aria-valuenow")).toBe("10");
  fireEvent.keyDown(handle, { key: "End" });
  expect(handle.getAttribute("aria-valuenow")).toBe("100");
});

it("opens a feature destination and closes mobile navigation after selection", async () => {
  const onNavigate = vi.fn();
  function CurrentLocation() {
    const location = useLocation();
    return <output>{location.pathname + location.search}</output>;
  }
  render(
    <MemoryRouter>
      <PublicNavigation open onNavigate={onNavigate} />
      <CurrentLocation />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "주요 기능" }));
  fireEvent.click(
    await screen.findByRole("link", { name: /작성과 버전 비교/ }),
  );
  expect(screen.getByRole("status").textContent).toBe("/features?view=writing");
  expect(onNavigate).toHaveBeenCalledOnce();
});

it("mobile entry links respect the existing signed-in session", () => {
  const close = vi.fn();
  render(
    <MemoryRouter>
      <PublicNavigation open signedIn onNavigate={close} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
  const entry = screen.getByRole("link", { name: "내 연구 열기" });
  expect(entry.getAttribute("href")).toBe("/r");
  fireEvent.click(entry);
  expect(close).toHaveBeenCalledOnce();
});
