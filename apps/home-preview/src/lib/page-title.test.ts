import { describe, expect, it } from "vitest";
import { isWorkspaceShellPath } from "./page-title";

describe("isWorkspaceShellPath", () => {
  it("returns true for routes rendered inside the workspace shell", () => {
    for (const path of [
      "/r",
      "/account",
      "/r/9be50561-425b-4bd6-b8b2-84523e65021a",
      "/r/9be50561-425b-4bd6-b8b2-84523e65021a/meetings/abc",
      "/r/9be50561-425b-4bd6-b8b2-84523e65021a/settings",
    ]) {
      expect(isWorkspaceShellPath(path)).toBe(true);
    }
  });

  it("returns false for public, review and schedule routes that set their own title", () => {
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/guide",
      "/reviews/abc",
      "/schedule/abc",
      "/research",
      "/accounts",
      "/missing",
    ]) {
      expect(isWorkspaceShellPath(path)).toBe(false);
    }
  });
});
