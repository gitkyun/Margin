import { describe, expect, it } from "vitest";
import { filterCounts } from "./filter-counts";

describe("filterCounts", () => {
  const items = [
    { status: "todo" },
    { status: "done" },
    { status: "todo" },
  ] as const;
  const matches = (item: { status: string }, value: string) =>
    value === "all" || item.status === value;

  it("counts the items each filter option would show", () => {
    expect(
      filterCounts(["all", "todo", "done", "held"], items, matches),
    ).toEqual({ all: 3, todo: 2, done: 1, held: 0 });
  });

  it("returns zero for every option when there are no items", () => {
    expect(filterCounts(["all", "todo"], [], matches)).toEqual({
      all: 0,
      todo: 0,
    });
  });
});
