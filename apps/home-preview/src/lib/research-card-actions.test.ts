import { describe, expect, it } from "vitest";
import {
  researchCardActions,
  researchListView,
  researchStatusBadge,
} from "./research-card-actions";

const ids = (view: Parameters<typeof researchCardActions>[0], owner: boolean) =>
  researchCardActions(view, owner).map((a) => a.id);

describe("research card actions", () => {
  it("lets only the owner archive or move a research to the trash", () => {
    expect(ids("active", true)).toEqual([
      "open",
      "open-tab",
      "settings",
      "archive",
      "trash",
    ]);
    expect(ids("active", false)).toEqual(["open", "open-tab", "settings"]);
    expect(ids("archived", true)).toEqual([
      "open",
      "open-tab",
      "settings",
      "unarchive",
      "trash",
    ]);
  });

  it("offers only restore in the trash, and nothing to non-owners", () => {
    expect(ids("trash", true)).toEqual(["restore"]);
    expect(ids("trash", false)).toEqual([]);
  });

  it("reads unknown views as active and labels each list", () => {
    expect(researchListView(null)).toBe("active");
    expect(researchListView("weird")).toBe("active");
    expect(researchListView("trash")).toBe("trash");
    expect(researchStatusBadge("archived").tone).toBe("neutral");
    expect(researchStatusBadge("trash").tone).toBe("red");
  });
});
