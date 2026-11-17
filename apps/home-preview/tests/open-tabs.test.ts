// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  closeTab,
  moveTab,
  neighborTab,
  openTab,
  readTabs,
  writeTabs,
  type OpenTab,
} from "../src/lib/open-tabs";

const tab = (id: string, seen: number, kind: "w" | "m" = "w"): OpenTab => ({
  kind,
  id,
  seen,
});

describe("열어 둔 탭(IA v2 05 §3.2)", () => {
  afterEach(() => localStorage.clear());
  it("열면 끝에 더하고, 이미 있으면 본 때만 바꾼다", () => {
    const a = openTab([], { kind: "w", id: "a" }, 1);
    const b = openTab(a, { kind: "m", id: "b" }, 2);
    expect(openTab(b, { kind: "w", id: "a" }, 3)).toEqual([
      tab("a", 3),
      tab("b", 2, "m"),
    ]);
  });
  it("8개를 넘으면 가장 오래 안 본 탭(방금 연 것 빼고)을 뺀다", () => {
    let tabs: OpenTab[] = [];
    for (let i = 0; i < 8; i++)
      tabs = openTab(tabs, { kind: "w", id: `${i}` }, i);
    tabs = openTab(tabs, { kind: "w", id: "0" }, 100);
    tabs = openTab(tabs, { kind: "w", id: "new" }, 101);
    expect(tabs).toHaveLength(8);
    expect(tabs.map((t) => t.id)).not.toContain("1");
    expect(tabs.map((t) => t.id)).toContain("0");
    expect(tabs.at(-1)!.id).toBe("new");
  });
  it("닫기·옮기기·옆 탭", () => {
    const tabs = [tab("a", 1), tab("b", 2), tab("c", 3)];
    expect(closeTab(tabs, { kind: "w", id: "b" }).map((t) => t.id)).toEqual([
      "a",
      "c",
    ]);
    expect(moveTab(tabs, 0, 2).map((t) => t.id)).toEqual(["b", "c", "a"]);
    expect(moveTab(tabs, 2, -5).map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(neighborTab(tabs, { kind: "w", id: "b" })?.id).toBe("c");
    expect(neighborTab(tabs, { kind: "w", id: "c" })?.id).toBe("b");
    expect(neighborTab([tab("a", 1)], { kind: "w", id: "a" })).toBeUndefined();
  });
  it("연구별로 기억하고, 깨진 값은 버린다", () => {
    writeTabs("r1", [tab("a", 1)]);
    expect(readTabs("r1")).toEqual([tab("a", 1)]);
    expect(readTabs("r2")).toEqual([]);
    localStorage.setItem("margin-docs-tabs:r3", "{깨짐");
    expect(readTabs("r3")).toEqual([]);
    localStorage.setItem(
      "margin-docs-tabs:r4",
      JSON.stringify([{ kind: "x", id: "a", seen: 1 }, tab("b", 2)]),
    );
    expect(readTabs("r4")).toEqual([tab("b", 2)]);
  });
});
