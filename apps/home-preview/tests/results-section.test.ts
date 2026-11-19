import { describe, expect, it } from "vitest";
import {
  parseResultView,
  parseReviewShare,
  resultCounts,
  resultRows,
  reviewMatchesShare,
} from "@/lib/results-section";
import type { RevisionResult } from "@/lib/domain";

const result = (
  id: string,
  patch: Partial<RevisionResult> = {},
): RevisionResult =>
  ({
    id,
    researchId: "r1",
    title: id,
    description: "",
    feedbackIds: [],
    taskIds: [],
    kind: "document",
    location: "",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...patch,
  }) as RevisionResult;

const results = [
  result("pending-old"),
  result("pending-new", { updatedAt: "2026-11-10T00:00:00.000Z" }),
  result("requested", { description: "비교표 보완" }),
  result("archived", { archivedAt: "2026-11-05T00:00:00.000Z" }),
  result("other-research", { researchId: "r2" }),
];
const items = [{ resultId: "requested" }];

describe("검토 보기의 수정 결과 구획(04 §2.4)", () => {
  it("요청 전·요청에 포함·보관함으로 나누고 최근 고친 순", () => {
    expect(
      resultRows(results, items, "r1", "pending").map((r) => r.id),
    ).toEqual(["pending-new", "pending-old"]);
    expect(
      resultRows(results, items, "r1", "requested").map((r) => r.id),
    ).toEqual(["requested"]);
    expect(
      resultRows(results, items, "r1", "archived").map((r) => r.id),
    ).toEqual(["archived"]);
    expect(resultCounts(results, items, "r1")).toEqual({
      pending: 2,
      requested: 1,
      archived: 1,
    });
  });

  it("찾기는 제목과 수정한 내용에서", () => {
    expect(
      resultRows(results, items, "r1", "requested", "비교표").map((r) => r.id),
    ).toEqual(["requested"]);
    expect(resultRows(results, items, "r1", "pending", "비교표")).toEqual([]);
  });

  it("주소 값은 모르는 것이면 기본값", () => {
    expect(parseResultView(null)).toBe("pending");
    expect(parseResultView("archived")).toBe("archived");
    expect(parseResultView("x")).toBe("pending");
    expect(parseReviewShare("stopped")).toBe("stopped");
    expect(parseReviewShare("draft")).toBe("all");
  });

  it("검토 요청 보조 필터: 전체는 초안까지, 공유 중·공유 중지는 그 상태만", () => {
    expect(reviewMatchesShare({ status: "draft" }, "all")).toBe(true);
    expect(reviewMatchesShare({ status: "draft" }, "shared")).toBe(false);
    expect(reviewMatchesShare({ status: "shared" }, "shared")).toBe(true);
    expect(reviewMatchesShare({ status: "stopped" }, "stopped")).toBe(true);
  });
});
