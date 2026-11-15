// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Disclosure } from "../src/components/ui/disclosure";

afterEach(cleanup);

function pressKey(element: HTMLElement, key: "Enter" | " ") {
  const allowed = fireEvent.keyDown(element, { key });
  if (allowed) {
    if (key === "Enter") {
      fireEvent.click(element);
    } else {
      fireEvent.keyUp(element, { key });
      fireEvent.click(element);
    }
  }
}

it("renders trigger with button role and handles toggle via click and keyboard", () => {
  render(
    <Disclosure summary="자세히 보기">
      <p>숨겨진 내용입니다.</p>
    </Disclosure>,
  );

  const trigger = screen.getByRole("button", { name: "자세히 보기" });
  expect(trigger).toBeDefined();
  expect(trigger.tagName).toBe("BUTTON");
  expect(trigger.getAttribute("type")).toBe("button");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");

  // Enter to open
  pressKey(trigger, "Enter");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");

  // Space to close
  pressKey(trigger, " ");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");

  // Click to open
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");

  // Click to close
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("supports controlled open state via open and onOpenChange", () => {
  function Controlled() {
    const [open, setOpen] = useState(false);
    return (
      <Disclosure open={open} onOpenChange={setOpen} summary="제어 디스클로저">
        <p>제어 내용</p>
      </Disclosure>
    );
  }

  render(<Controlled />);
  const trigger = screen.getByRole("button", { name: "제어 디스클로저" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
});
