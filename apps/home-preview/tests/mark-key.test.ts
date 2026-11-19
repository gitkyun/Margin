// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isMarkKey } from "@/lib/mark-key";

function key(init: KeyboardEventInit, target?: HTMLElement) {
  const event = new KeyboardEvent("keydown", { bubbles: true, ...init });
  if (target) {
    document.body.append(target);
    target.dispatchEvent(event);
  } else document.body.dispatchEvent(event);
  return event;
}

describe("isMarkKey", () => {
  it("accepts H by its physical key, also on a Korean layout", () => {
    expect(isMarkKey(key({ code: "KeyH", key: "h" }))).toBe(true);
    expect(isMarkKey(key({ code: "KeyH", key: "ㅗ" }))).toBe(true);
    expect(isMarkKey(key({ code: "KeyJ", key: "j" }))).toBe(false);
  });

  it("ignores modifier keys and composition", () => {
    expect(isMarkKey(key({ code: "KeyH", metaKey: true }))).toBe(false);
    expect(isMarkKey(key({ code: "KeyH", ctrlKey: true }))).toBe(false);
    expect(isMarkKey(key({ code: "KeyH", altKey: true }))).toBe(false);
    expect(isMarkKey(key({ code: "KeyH", shiftKey: true }))).toBe(false);
    expect(isMarkKey(key({ code: "KeyH", isComposing: true }))).toBe(false);
  });

  it("does not fire while typing in a field", () => {
    expect(
      isMarkKey(key({ code: "KeyH" }, document.createElement("input"))),
    ).toBe(false);
    expect(
      isMarkKey(key({ code: "KeyH" }, document.createElement("textarea"))),
    ).toBe(false);
  });

  it("leaves G H to the home shortcut", () => {
    expect(isMarkKey(key({ code: "KeyH" }), "KeyG")).toBe(false);
    expect(isMarkKey(key({ code: "KeyH" }), "KeyJ")).toBe(true);
  });
});
