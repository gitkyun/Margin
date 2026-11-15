import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-policy";

describe("passwordStrength", () => {
  it("returns 0 for an empty password", () => {
    expect(passwordStrength("")).toBe(0);
  });
  it("marks passwords under the minimum as short", () => {
    expect(passwordStrength("abc!1")).toBe(1);
  });
  it("accepts a plain 8-character password as usable", () => {
    expect(passwordStrength("abcdefgh")).toBe(2);
  });
  it("rates three character kinds or 12+ characters as good", () => {
    expect(passwordStrength("abcd1234!")).toBe(3);
    expect(passwordStrength("abcdefghijkl")).toBe(3);
  });
});
