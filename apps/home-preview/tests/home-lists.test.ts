// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  homeTaskOrder,
  readHomeTab,
  rememberHomeTab,
} from "../src/lib/home-lists";
import type { Task } from "../src/lib/domain";

const task = (id: string, dueDate: string | null = null) =>
  ({ id, dueDate, createdAt: `2026-11-0${id.length}T00:00:00Z` }) as Task;

afterEach(() => localStorage.clear());

describe("홈 목록(IA v2 03 §5)", () => {
  it("다음 미팅에 가져갈 할 일을 그 순서대로 먼저, 나머지는 기한 가까운 순", () => {
    const { first, rest } = homeTaskOrder(
      [task("a"), task("b", "2026-11-20"), task("c", "2026-11-18"), task("d")],
      ["d", "b"],
    );
    expect(first.map((x) => x.id)).toEqual(["d", "b"]);
    expect(rest.map((x) => x.id)).toEqual(["c", "a"]);
  });

  it("주소의 탭 → 연구별 마지막 탭 → 할 일", () => {
    expect(readHomeTab(null, "r1")).toBe("tasks");
    rememberHomeTab("r1", "docs");
    expect(readHomeTab(null, "r1")).toBe("docs");
    expect(readHomeTab(null, "r2")).toBe("tasks");
    expect(readHomeTab("alerts", "r1")).toBe("alerts");
    expect(readHomeTab("nope", "r1")).toBe("docs");
  });
});
