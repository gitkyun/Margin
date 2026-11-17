import { describe, expect, it } from "vitest";
import {
  legacySettingsTarget,
  resolveSettingsSection,
  withSettings,
} from "./settings-sections";

describe("resolveSettingsSection", () => {
  it("returns null when there is no settings param", () => {
    expect(resolveSettingsSection(null, true)).toBeNull();
  });
  it("keeps a known account section anywhere", () => {
    expect(resolveSettingsSection("usage", false)).toBe("usage");
  });
  it("keeps a research section inside a research", () => {
    expect(resolveSettingsSection("people", true)).toBe("people");
  });
  it("falls back to profile for a research section outside a research", () => {
    expect(resolveSettingsSection("danger", false)).toBe("profile");
  });
  it("marks an unknown value invalid", () => {
    expect(resolveSettingsSection("nope", true)).toBe("invalid");
  });
});

describe("withSettings", () => {
  it("adds the section and keeps other params", () => {
    expect(withSettings("?q=1", "display")).toBe("?q=1&settings=display");
  });
  it("removes the section", () => {
    expect(withSettings("?q=1&settings=display", null)).toBe("?q=1");
    expect(withSettings("?settings=display", null)).toBe("");
  });
});

describe("legacySettingsTarget", () => {
  it("maps /account tabs onto /r?settings=", () => {
    expect(legacySettingsTarget("/account", "?tab=ai")).toBe(
      "/r?settings=assistant",
    );
    expect(legacySettingsTarget("/account", "")).toBe("/r?settings=profile");
  });
  it("maps research settings tabs onto the research home", () => {
    expect(legacySettingsTarget("/r/a1/settings", "?tab=members")).toBe(
      "/r/a1?settings=people",
    );
    expect(legacySettingsTarget("/r/a1/settings", "")).toBe(
      "/r/a1?settings=research",
    );
  });
  it("sends the phases tab to the research flow", () => {
    expect(legacySettingsTarget("/r/a1/settings", "?tab=phases")).toBe(
      "/r/a1/flow",
    );
  });
  it("returns null for other paths", () => {
    expect(legacySettingsTarget("/r/a1/tasks", "?tab=x")).toBeNull();
  });
});

describe("legacySettingsTarget query handling", () => {
  it("keeps other params and drops tab", () => {
    expect(legacySettingsTarget("/account", "?tab=usage&x=1")).toBe(
      "/r?x=1&settings=usage",
    );
  });
  it("sends an unknown research tab to the first section, never danger", () => {
    expect(legacySettingsTarget("/r/a1/settings", "?tab=zzz")).toBe(
      "/r/a1?settings=research",
    );
  });
});
