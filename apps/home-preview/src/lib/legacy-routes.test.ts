import { describe, expect, it } from "vitest";
import { legacyRedirect, LEGACY_SAMPLES } from "./legacy-routes";

describe("legacyRedirect (IA v2 01 §3.3, 0단계)", () => {
  it.each([
    ["/r/a/writing", "", "/r/a/docs?kind=writing"],
    ["/r/a/writing/d1", "", "/r/a/docs/w/d1"],
    ["/r/a/writing", "?new=1", "/r/a/docs?new=1&kind=writing"],
    ["/r/a/materials", "?folder=f1", "/r/a/docs?folder=f1&kind=material"],
    ["/r/a/materials/m1", "", "/r/a/docs/m/m1"],
    ["/r/a/planning", "?phase=p1", "/r/a/flow?phase=p1"],
    ["/r/a/planning", "?tab=calendar", "/r/a/flow?tab=calendar"],
    ["/r/a/folders/f9", "", "/r/a/docs?folder=f9"],
    ["/r/a/questions/q1", "", "/r/a?detail=question%3Aq1"],
    ["/r/a/decisions/d1", "", "/r/a?detail=decision%3Ad1"],
    ["/r/a/tasks/t1", "", "/r/a/tasks?detail=task%3At1"],
    ["/r/a/feedback", "", "/r/a/tasks?view=feedback"],
    [
      "/r/a/feedback/f1",
      "?from=x",
      "/r/a/tasks?from=x&view=feedback&detail=feedback%3Af1",
    ],
    ["/r/a/settings", "?tab=members", "/r/a?settings=people"],
    ["/account", "?tab=appearance", "/r?settings=display"],
  ])("%s%s → %s", (path, search, target) => {
    expect(legacyRedirect(path, search)).toBe(target);
  });

  it("leaves new and unrelated addresses alone", () => {
    expect(legacyRedirect("/r/a/docs", "?kind=writing")).toBeNull();
    expect(legacyRedirect("/r/a/meetings/m1", "")).toBeNull();
    expect(legacyRedirect("/r/a", "")).toBeNull();
    // 상세에서 못 하는 일을 하러 예전 화면을 여는 통로
    expect(legacyRedirect("/r/a/feedback/f1", "?full=1")).toBeNull();
    expect(legacyRedirect("/r/a/tasks/t1", "?full=1")).toBeNull();
    expect(legacyRedirect("/r/a/feedback", "?new=1")).toBeNull();
  });

  it("never redirects a target onto another legacy rule", () => {
    for (const [path, search] of LEGACY_SAMPLES) {
      const target = legacyRedirect(path, search);
      expect(target).not.toBeNull();
      const url = new URL(target!, "https://x.test");
      expect(legacyRedirect(url.pathname, url.search)).toBeNull();
    }
  });
});
