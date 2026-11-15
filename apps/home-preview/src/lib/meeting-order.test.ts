import { describe, expect, it } from "vitest";
import { moveItem, orderedBy, reorderIds } from "./meeting-order";

describe("meeting preparation order", () => {
  it("moves an item without mutating the source", () => {
    const items = ["a", "b", "c", "d"];
    expect(moveItem(items, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(items, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(items, 1, 9)).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  it("orders records by an id list and keeps unknown ones at the end", () => {
    const records = [{ id: "x" }, { id: "b" }, { id: "a" }, { id: "y" }];
    expect(orderedBy(records, ["a", "b"]).map((r) => r.id)).toEqual([
      "a",
      "b",
      "x",
      "y",
    ]);
  });

  it("reorders only the visible subset and keeps hidden ids in place", () => {
    // q2는 해결돼서 목록에 보이지 않아요.
    expect(reorderIds(["q1", "q2", "q3", "q4"], ["q4", "q1", "q3"])).toEqual([
      "q4",
      "q2",
      "q1",
      "q3",
    ]);
  });
});
