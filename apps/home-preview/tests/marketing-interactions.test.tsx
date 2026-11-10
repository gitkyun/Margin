// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  ComparePreview,
  StartGlow,
} from "../src/components/marketing/MarketingEffects";
import { PublicNavigation } from "../src/components/marketing/PublicNavigation";

beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => true;
  Element.prototype.releasePointerCapture = () => {};
  // jsdom에는 IntersectionObserver가 없습니다. 아무것도 보이지 않는 화면으로 둡니다.
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
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
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(handle.getAttribute("aria-valuenow")).toBe("5");
  fireEvent.keyDown(handle, { key: "PageDown" });
  expect(handle.getAttribute("aria-valuenow")).toBe("15");
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

it("wraps the start button without changing it and runs the glow only once it is seen", () => {
  const { container } = render(
    <StartGlow delay={700}>
      <a href="/signup">시작하기</a>
    </StartGlow>,
  );
  const wrap = container.querySelector(".rms-start-glow") as HTMLElement;
  expect(wrap.classList.contains("rms-start-glow-brand")).toBe(true);
  expect(wrap.style.getPropertyValue("--start-glow-delay")).toBe("700ms");
  // jsdom에서는 화면에 들어온 적이 없으므로 아직 돌지 않습니다.
  expect(wrap.dataset.run).toBeUndefined();
  expect(
    screen.getByRole("link", { name: "시작하기" }).getAttribute("href"),
  ).toBe("/signup");
});
