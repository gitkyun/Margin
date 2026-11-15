// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SectionBoundary } from "@/components/SectionBoundary";

afterEach(cleanup);

function Fragile({ fail }: { fail: { current: boolean } }) {
  if (fail.current) throw new Error("synthetic render failure");
  return <p>정상 화면</p>;
}

it("keeps the rest of the screen and shows a retry when one part throws", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const fail = { current: true };
  render(
    <div>
      <p>다른 부분</p>
      <SectionBoundary>
        <Fragile fail={fail} />
      </SectionBoundary>
    </div>,
  );
  expect(screen.getByText("다른 부분")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain(
    "이 부분을 표시하지 못했어요",
  );
  fail.current = false;
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  expect(screen.getByText("정상 화면")).toBeTruthy();
  const logged = spy.mock.calls.map((c) => String(c[0]));
  expect(logged.some((m) => m.includes("[margin] section crashed"))).toBe(true);
  spy.mockRestore();
});
