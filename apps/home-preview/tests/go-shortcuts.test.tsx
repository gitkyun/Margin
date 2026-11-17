// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useGoShortcuts } from "../src/lib/use-go-shortcuts";
import { goShortcutLabel } from "../src/lib/go-shortcuts";

afterEach(cleanup);

function Harness({ researchId }: { researchId?: string }) {
  useGoShortcuts(researchId);
  const location = useLocation();
  return (
    <>
      <output>{location.pathname}</output>
      <input aria-label="메모" />
    </>
  );
}

function press(key: string, target: EventTarget = document.body) {
  const code = `Key${key.toUpperCase()}`;
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, code, bubbles: true }),
    );
    target.dispatchEvent(
      new KeyboardEvent("keyup", { key, code, bubbles: true }),
    );
  });
}

function setup(researchId?: string) {
  render(
    <MemoryRouter initialEntries={["/r/r1"]}>
      <Harness researchId={researchId} />
    </MemoryRouter>,
  );
  return () => screen.getByRole("status").textContent;
}

describe("useGoShortcuts", () => {
  it("moves to a research screen with G then a letter", () => {
    const path = setup("r1");
    press("g");
    press("p");
    expect(path()).toBe("/r/r1/flow");
    press("g");
    press("h");
    expect(path()).toBe("/r/r1");
  });

  it("works with the Korean keyboard layout (physical keys)", () => {
    const path = setup("r1");
    act(() => {
      for (const [key, code] of [
        ["ㅎ", "KeyG"],
        ["ㅡ", "KeyM"],
      ]) {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key, code, bubbles: true }),
        );
        document.body.dispatchEvent(
          new KeyboardEvent("keyup", { key, code, bubbles: true }),
        );
      }
    });
    expect(path()).toBe("/r/r1/meetings");
  });

  it("ignores keys typed into a field and outside a research", () => {
    const path = setup("r1");
    const input = screen.getByRole("textbox", { name: "메모" });
    press("g", input);
    press("p", input);
    expect(path()).toBe("/r/r1");
    cleanup();
    const outside = setup(undefined);
    press("g");
    press("p");
    expect(outside()).toBe("/r/r1");
  });

  it("labels shortcuts for display", () => {
    expect(goShortcutLabel("")).toBe("G H");
    expect(goShortcutLabel("docs")).toBe("G D");
    expect(goShortcutLabel("docs?kind=writing")).toBe("G W");
    expect(goShortcutLabel("results")).toBeUndefined();
  });
});
