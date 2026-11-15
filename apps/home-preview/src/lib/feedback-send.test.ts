import { describe, expect, it } from "vitest";
import { professorSendTarget } from "./feedback-progress";

describe("피드백 상세의 ‘교수에게 보내기’", () => {
  it("수정 결과가 없으면 꺼지고 이유를 준다", () => {
    const target = professorSendTarget([], []);
    expect(target.resultIds).toEqual([]);
    expect(target.reason).toBeTruthy();
  });

  it("아직 검토 요청에 넣지 않은 결과만 골라 둔다", () => {
    const target = professorSendTarget(
      [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
      [{ resultId: "r2" }],
    );
    expect(target).toEqual({ resultIds: ["r1", "r3"], reason: null });
  });

  it("모두 보냈으면 꺼지고 재확인은 검토 요청에서 하라고 알린다", () => {
    const target = professorSendTarget([{ id: "r1" }], [{ resultId: "r1" }]);
    expect(target.resultIds).toEqual([]);
    expect(target.reason).toContain("검토 요청");
  });
});
